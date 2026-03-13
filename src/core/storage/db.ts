import { existsSync, statSync } from "node:fs"

import { Database } from "bun:sqlite"

import {
  extractIdentifiers,
  getFileTypeMultiplier,
  getIdentifierBoost,
  normalizeBM25,
  prepareFTSQuery,
  rrfScore,
} from "../chunking/tokenizer"

const schemaVersion = 2

function cosineSimilarity(left: number[], right: number[]): number {
  let dot = 0
  let leftNorm = 0
  let rightNorm = 0
  const length = Math.min(left.length, right.length)
  for (let index = 0; index < length; index += 1) {
    dot += left[index] * right[index]
    leftNorm += left[index] * left[index]
    rightNorm += right[index] * right[index]
  }
  if (leftNorm === 0 || rightNorm === 0) {
    return 0
  }
  return dot / (Math.sqrt(leftNorm) * Math.sqrt(rightNorm))
}

type ChunkRow = {
  id: number
  file_path: string
  chunk_index: number
  chunk_text: string
  start_line: number
  end_line: number
  embedding: string
  file_hash: string
  identifiers: string
  updated_at: string
}

export class BeaconDatabase {
  readonly db: Database

  constructor(
    readonly dbPath: string,
    readonly dimensions: number,
  ) {
    this.db = new Database(dbPath, { create: true })
    this.init()
  }

  private init(): void {
    this.db.exec("PRAGMA journal_mode = WAL")
    this.db.exec("PRAGMA busy_timeout = 5000")
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS chunks (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        file_path TEXT NOT NULL,
        chunk_index INTEGER NOT NULL,
        chunk_text TEXT NOT NULL,
        start_line INTEGER NOT NULL,
        end_line INTEGER NOT NULL,
        embedding TEXT NOT NULL,
        file_hash TEXT NOT NULL,
        identifiers TEXT DEFAULT '',
        updated_at TEXT DEFAULT (datetime('now')),
        UNIQUE(file_path, chunk_index)
      );

      CREATE TABLE IF NOT EXISTS sync_state (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL
      );

      CREATE INDEX IF NOT EXISTS idx_chunks_file ON chunks(file_path);

      CREATE VIRTUAL TABLE IF NOT EXISTS chunks_fts USING fts5(
        file_path,
        chunk_text,
        identifiers,
        content='chunks',
        content_rowid='id',
        tokenize='porter unicode61'
      );
    `)
    this.migrateToV2()
  }

  private migrateToV2(): void {
    const currentVersion = Number.parseInt(this.getSyncState("schema_version") ?? "1", 10)
    if (currentVersion >= schemaVersion) {
      return
    }

    const allChunks = this.db.query("SELECT id, file_path, chunk_text FROM chunks").all() as Array<{ id: number; file_path: string; chunk_text: string }>
    if (allChunks.length > 0) {
      const updateIdentifiers = this.db.query("UPDATE chunks SET identifiers = ? WHERE id = ?")
      const insertFts = this.db.query("INSERT INTO chunks_fts(rowid, file_path, chunk_text, identifiers) VALUES (?, ?, ?, ?)")
      const tx = this.db.transaction(() => {
        for (const row of allChunks) {
          const identifiers = extractIdentifiers(row.chunk_text)
          updateIdentifiers.run(identifiers, row.id)
          insertFts.run(row.id, row.file_path, row.chunk_text, identifiers)
        }
      })
      tx()
    }

    this.setSyncState("schema_version", String(schemaVersion))
  }

  upsertChunk(
    filePath: string,
    chunkIndex: number,
    chunkText: string,
    startLine: number,
    endLine: number,
    embedding: number[],
    fileHash: string,
    identifiers?: string,
  ): void {
    const resolvedIdentifiers = identifiers ?? extractIdentifiers(chunkText)
    const existing = this.db.query("SELECT id FROM chunks WHERE file_path = ? AND chunk_index = ?").get(filePath, chunkIndex) as { id?: number } | null
    if (existing?.id) {
      this.db.query("INSERT INTO chunks_fts(chunks_fts, rowid, file_path, chunk_text, identifiers) VALUES('delete', ?, ?, (SELECT chunk_text FROM chunks WHERE id = ?), (SELECT identifiers FROM chunks WHERE id = ?))").run(existing.id, filePath, existing.id, existing.id)
      this.db.query(`
        UPDATE chunks SET chunk_text = ?, start_line = ?, end_line = ?, embedding = ?, file_hash = ?, identifiers = ?, updated_at = datetime('now')
        WHERE file_path = ? AND chunk_index = ?
      `).run(chunkText, startLine, endLine, JSON.stringify(embedding), fileHash, resolvedIdentifiers, filePath, chunkIndex)
      this.db.query("INSERT INTO chunks_fts(rowid, file_path, chunk_text, identifiers) VALUES(?, ?, ?, ?)").run(existing.id, filePath, chunkText, resolvedIdentifiers)
      return
    }

    const result = this.db.query(`
      INSERT INTO chunks (file_path, chunk_index, chunk_text, start_line, end_line, embedding, file_hash, identifiers)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      RETURNING id
    `).get(filePath, chunkIndex, chunkText, startLine, endLine, JSON.stringify(embedding), fileHash, resolvedIdentifiers) as { id: number }

    this.db.query("INSERT INTO chunks_fts(rowid, file_path, chunk_text, identifiers) VALUES(?, ?, ?, ?)").run(result.id, filePath, chunkText, resolvedIdentifiers)
  }

  deleteFileChunks(filePath: string): void {
    const rows = this.db.query("SELECT id, chunk_text, identifiers FROM chunks WHERE file_path = ?").all(filePath) as Array<{ id: number; chunk_text: string; identifiers: string }>
    const tx = this.db.transaction(() => {
      for (const row of rows) {
        this.db.query("INSERT INTO chunks_fts(chunks_fts, rowid, file_path, chunk_text, identifiers) VALUES('delete', ?, ?, ?, ?)").run(row.id, filePath, row.chunk_text, row.identifiers ?? "")
      }
      this.db.query("DELETE FROM chunks WHERE file_path = ?").run(filePath)
    })
    tx()
  }

  deleteOrphanChunks(filePath: string, maxChunkIndex: number): void {
    const rows = this.db.query("SELECT id, chunk_text, identifiers FROM chunks WHERE file_path = ? AND chunk_index > ?").all(filePath, maxChunkIndex) as Array<{ id: number; chunk_text: string; identifiers: string }>
    const tx = this.db.transaction(() => {
      for (const row of rows) {
        this.db.query("INSERT INTO chunks_fts(chunks_fts, rowid, file_path, chunk_text, identifiers) VALUES('delete', ?, ?, ?, ?)").run(row.id, filePath, row.chunk_text, row.identifiers ?? "")
      }
      this.db.query("DELETE FROM chunks WHERE file_path = ? AND chunk_index > ?").run(filePath, maxChunkIndex)
    })
    tx()
  }

  search(queryEmbedding: number[], topK: number, threshold: number, queryText: string | null, config: { search: { hybrid: { enabled: boolean; weight_vector: number; weight_bm25: number; weight_rrf: number; debug?: boolean } } }, pathPrefix?: string) {
    const hybrid = config.search.hybrid
    if (!hybrid?.enabled || !queryText) {
      return this.vectorSearch(queryEmbedding, topK, threshold, pathPrefix)
    }

    const vectorResults = this.vectorSearchRaw(queryEmbedding, topK * 2, pathPrefix)
    const ftsQuery = prepareFTSQuery(queryText)
    let ftsResults: Array<{ id: number; filePath: string; chunkText: string; startLine: number; endLine: number; bm25Score: number }> = []
    if (ftsQuery) {
      if (typeof ftsQuery === "object") {
        ftsResults = this.ftsSearch(ftsQuery.andQuery, topK * 2, pathPrefix)
        if (ftsResults.length === 0) {
          ftsResults = this.ftsSearch(ftsQuery.orQuery, topK * 2, pathPrefix)
        }
      } else {
        ftsResults = this.ftsSearch(ftsQuery, topK * 2, pathPrefix)
      }
    }

    const candidates = new Map<number, {
      id: number
      filePath: string
      chunkText: string
      startLine: number
      endLine: number
      vecRank: number | null
      vecSimilarity: number | null
      ftsRank: number | null
      bm25Score: number | null
      bm25Normalized?: number
    }>()

    vectorResults.forEach((result, index) => {
      candidates.set(result.id, { ...result, vecRank: index + 1, vecSimilarity: result.similarity, ftsRank: null, bm25Score: null })
    })
    ftsResults.forEach((result, index) => {
      const existing = candidates.get(result.id)
      if (existing) {
        existing.ftsRank = index + 1
        existing.bm25Score = result.bm25Score
      } else {
        candidates.set(result.id, { ...result, vecRank: null, vecSimilarity: null, ftsRank: index + 1, bm25Score: result.bm25Score })
      }
    })

    const bm25Scores: number[] = []
    const bm25Ids: number[] = []
    for (const [id, candidate] of candidates.entries()) {
      if (candidate.bm25Score !== null) {
        bm25Scores.push(candidate.bm25Score)
        bm25Ids.push(id)
      }
    }
    normalizeBM25(bm25Scores).forEach((score, index) => {
      candidates.get(bm25Ids[index])!.bm25Normalized = score
    })

    const scored = [...candidates.values()].map((candidate) => {
      const vecComponent = candidate.vecSimilarity !== null ? hybrid.weight_vector * candidate.vecSimilarity : 0
      const bm25Component = candidate.bm25Normalized !== undefined ? hybrid.weight_bm25 * candidate.bm25Normalized : 0
      const rrfComponent = hybrid.weight_rrf * rrfScore(candidate.vecRank, candidate.ftsRank)
      const fileMultiplier = getFileTypeMultiplier(candidate.filePath)
      const identifierBoost = getIdentifierBoost(queryText, candidate.chunkText)
      return {
        filePath: candidate.filePath,
        chunkText: candidate.chunkText,
        startLine: candidate.startLine,
        endLine: candidate.endLine,
        similarity: candidate.vecSimilarity ?? 0,
        score: (vecComponent + bm25Component + rrfComponent) * fileMultiplier * identifierBoost,
      }
    })

    return scored
      .sort((a, b) => b.score - a.score)
      .filter((row) => row.similarity >= threshold || (row.similarity === 0 && row.score > 0))
      .slice(0, topK)
  }

  private vectorSearch(queryEmbedding: number[], topK: number, threshold: number, pathPrefix?: string) {
    return this.vectorSearchRaw(queryEmbedding, topK, pathPrefix)
      .map((row) => ({
        filePath: row.filePath,
        chunkText: row.chunkText,
        startLine: row.startLine,
        endLine: row.endLine,
        similarity: row.similarity,
      }))
      .filter((row) => row.similarity >= threshold)
      .slice(0, topK)
  }

  private vectorSearchRaw(queryEmbedding: number[], limit: number, pathPrefix?: string) {
    const rows = this.db.query(
      pathPrefix
        ? "SELECT id, file_path, chunk_text, start_line, end_line, embedding FROM chunks WHERE file_path LIKE ?"
        : "SELECT id, file_path, chunk_text, start_line, end_line, embedding FROM chunks",
    ).all(...(pathPrefix ? [`${pathPrefix}%`] : [])) as Array<Pick<ChunkRow, "id" | "file_path" | "chunk_text" | "start_line" | "end_line" | "embedding">>

    return rows
      .map((row) => ({
        id: row.id,
        filePath: row.file_path,
        chunkText: row.chunk_text,
        startLine: row.start_line,
        endLine: row.end_line,
        similarity: cosineSimilarity(queryEmbedding, JSON.parse(row.embedding) as number[]),
      }))
      .sort((a, b) => b.similarity - a.similarity)
      .slice(0, limit)
  }

  private ftsSearch(ftsQuery: string, limit: number, pathPrefix?: string) {
    try {
      const rows = this.db.query(
        pathPrefix
          ? `
              SELECT chunks.id, chunks.file_path, chunks.chunk_text, chunks.start_line, chunks.end_line, chunks_fts.rank AS bm25_rank
              FROM chunks_fts
              JOIN chunks ON chunks.id = chunks_fts.rowid
              WHERE chunks_fts MATCH ? AND chunks.file_path LIKE ?
              ORDER BY chunks_fts.rank
              LIMIT ?
            `
          : `
              SELECT chunks.id, chunks.file_path, chunks.chunk_text, chunks.start_line, chunks.end_line, chunks_fts.rank AS bm25_rank
              FROM chunks_fts
              JOIN chunks ON chunks.id = chunks_fts.rowid
              WHERE chunks_fts MATCH ?
              ORDER BY chunks_fts.rank
              LIMIT ?
            `,
      ).all(...(pathPrefix ? [ftsQuery, `${pathPrefix}%`, limit] : [ftsQuery, limit])) as Array<{
        id: number
        file_path: string
        chunk_text: string
        start_line: number
        end_line: number
        bm25_rank: number
      }>

      return rows.map((row) => ({
        id: row.id,
        filePath: row.file_path,
        chunkText: row.chunk_text,
        startLine: row.start_line,
        endLine: row.end_line,
        bm25Score: row.bm25_rank,
      }))
    } catch {
      return []
    }
  }

  getIndexedFiles(): string[] {
    return (this.db.query("SELECT DISTINCT file_path FROM chunks").all() as Array<{ file_path: string }>).map((row) => row.file_path)
  }

  getFileHash(filePath: string): string | null {
    const row = this.db.query("SELECT file_hash FROM chunks WHERE file_path = ? LIMIT 1").get(filePath) as { file_hash?: string } | null
    return row?.file_hash ?? null
  }

  getSyncState(key: string): string | null {
    const row = this.db.query("SELECT value FROM sync_state WHERE key = ?").get(key) as { value?: string } | null
    return row?.value ?? null
  }

  setSyncState(key: string, value: string): void {
    this.db.query("INSERT OR REPLACE INTO sync_state (key, value) VALUES (?, ?)").run(key, String(value))
  }

  getStats(): { fileCount: number; chunkCount: number } {
    const fileCount = (this.db.query("SELECT COUNT(DISTINCT file_path) as n FROM chunks").get() as { n: number }).n
    const chunkCount = (this.db.query("SELECT COUNT(*) as n FROM chunks").get() as { n: number }).n
    return { fileCount, chunkCount }
  }

  getFileStats(): Array<{ filePath: string; chunkCount: number; lastUpdated: string }> {
    return (this.db.query(`
      SELECT file_path, COUNT(*) as chunk_count, MAX(updated_at) as last_updated
      FROM chunks
      GROUP BY file_path
      ORDER BY last_updated DESC
    `).all() as Array<{ file_path: string; chunk_count: number; last_updated: string }>).map((row) => ({
      filePath: row.file_path,
      chunkCount: row.chunk_count,
      lastUpdated: row.last_updated,
    }))
  }

  getDbSizeBytes(): number {
    return existsSync(this.dbPath) ? statSync(this.dbPath).size : 0
  }

  getSyncProgress(): Record<string, string> {
    const rows = this.db.query("SELECT key, value FROM sync_state WHERE key LIKE 'sync_%'").all() as Array<{ key: string; value: string }>
    return Object.fromEntries(rows.map((row) => [row.key, row.value]))
  }

  clearSyncProgress(): void {
    this.db.query("DELETE FROM sync_state WHERE key IN ('sync_status', 'sync_total_files', 'sync_completed_files', 'sync_current_file', 'sync_started_at', 'sync_error')").run()
  }

  ftsOnlySearch(queryText: string, topK: number, pathPrefix?: string) {
    const ftsQuery = prepareFTSQuery(queryText)
    if (!ftsQuery) {
      return []
    }

    let results: ReturnType<BeaconDatabase["ftsSearch"]>
    if (typeof ftsQuery === "object") {
      results = this.ftsSearch(ftsQuery.andQuery, topK * 2, pathPrefix)
      if (results.length === 0) {
        results = this.ftsSearch(ftsQuery.orQuery, topK * 2, pathPrefix)
      }
    } else {
      results = this.ftsSearch(ftsQuery, topK * 2, pathPrefix)
    }

    const normalized = normalizeBM25(results.map((row) => row.bm25Score))
    return results
      .map((row, index) => ({
        filePath: row.filePath,
        chunkText: row.chunkText,
        startLine: row.startLine,
        endLine: row.endLine,
        similarity: 0,
        score: normalized[index] * getFileTypeMultiplier(row.filePath) * getIdentifierBoost(queryText, row.chunkText),
        _note: "FTS-only result (embedding server unavailable)",
      }))
      .sort((a, b) => b.score - a.score)
      .slice(0, topK)
  }

  checkDimensions(): { ok: boolean; stored: number | null; current: number } {
    const stored = this.getSyncState("embedding_dimensions")
    if (stored === null) {
      return { ok: true, stored: null, current: this.dimensions }
    }
    const storedNumber = Number.parseInt(stored, 10)
    return { ok: storedNumber === this.dimensions, stored: storedNumber, current: this.dimensions }
  }

  storeDimensions(): void {
    this.setSyncState("embedding_dimensions", String(this.dimensions))
  }

  static healthCheck(dbPath: string, dimensions: number): { ok: boolean; fileCount: number; chunkCount: number; syncStatus: string | null; dimensionMismatch: boolean } {
    if (!existsSync(dbPath)) {
      return { ok: false, fileCount: 0, chunkCount: 0, syncStatus: null, dimensionMismatch: false }
    }

    try {
      const db = new Database(dbPath)
      const tableExists = db.query("SELECT name FROM sqlite_master WHERE type='table' AND name='chunks'").get() as { name?: string } | null
      if (!tableExists) {
        db.close()
        return { ok: false, fileCount: 0, chunkCount: 0, syncStatus: null, dimensionMismatch: false }
      }
      const fileCount = (db.query("SELECT COUNT(DISTINCT file_path) as n FROM chunks").get() as { n: number }).n
      const chunkCount = (db.query("SELECT COUNT(*) as n FROM chunks").get() as { n: number }).n
      const syncStatus = ((db.query("SELECT value FROM sync_state WHERE key = 'sync_status'").get() as { value?: string } | null)?.value ?? "idle")
      const storedDimensionsValue = (db.query("SELECT value FROM sync_state WHERE key = 'embedding_dimensions'").get() as { value?: string } | null)?.value
      db.close()
      const storedDimensions = storedDimensionsValue ? Number.parseInt(storedDimensionsValue, 10) : null
      const dimensionMismatch = storedDimensions !== null && storedDimensions !== dimensions
      return {
        ok: fileCount > 0 && syncStatus !== "error" && !dimensionMismatch,
        fileCount,
        chunkCount,
        syncStatus,
        dimensionMismatch,
      }
    } catch {
      return { ok: false, fileCount: 0, chunkCount: 0, syncStatus: null, dimensionMismatch: false }
    }
  }

  close(): void {
    this.db.close()
  }
}
