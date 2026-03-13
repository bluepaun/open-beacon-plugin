import { existsSync, mkdirSync, readFileSync, unlinkSync, writeFileSync } from "node:fs"
import path from "node:path"

import type { OpenBeaconConfig } from "../../config/schema"
import { chunkCode } from "../chunking/chunker"
import { extractIdentifiers } from "../chunking/tokenizer"
import { Embedder } from "../embedding/embedder"
import { getFileHash, getModifiedFilesSince, getRepoFiles } from "../repo/git"
import { shouldIndex } from "../repo/ignore"
import { getRepoRoot } from "../repo/repo-root"
import { isPathBlacklisted } from "../safety/safety"
import { openDatabase } from "../storage/open-db"

export class IndexingService {
  private readonly repoRoot: string
  private readonly storagePath: string
  private readonly pidFile: string

  constructor(
    private readonly directory: string,
    private readonly config: OpenBeaconConfig,
    private readonly safetyConfigPath: string,
  ) {
    this.repoRoot = getRepoRoot(directory)
    this.storagePath = path.isAbsolute(config.storage.path)
      ? config.storage.path
      : path.join(this.repoRoot, config.storage.path)
    this.pidFile = path.join(this.storagePath, "sync.pid")
  }

  async autoSync(): Promise<string> {
    return await this.sync(false)
  }

  async runIndexer(): Promise<string> {
    return await this.sync(true)
  }

  async reembedFile(filePath: string): Promise<string> {
    const relativePath = path.isAbsolute(filePath) ? path.relative(this.repoRoot, filePath) : filePath
    if (!shouldIndex(relativePath, this.config, this.repoRoot)) {
      return "skipped"
    }

    const dbPath = this.dbPath()
    if (!existsSync(dbPath)) {
      return "skipped"
    }

    const db = openDatabase(dbPath, this.config.embedding.dimensions)
    const embedder = new Embedder(this.config)

    try {
      const absolutePath = path.join(this.repoRoot, relativePath)
      const content = readFileSync(absolutePath, "utf8")
      const fileHash = getFileHash(absolutePath)
      if (fileHash === db.getFileHash(relativePath)) {
        return "unchanged"
      }

      const chunks = chunkCode(content, relativePath, this.config)
      if (chunks.length === 0) {
        return "empty"
      }

      const embeddings = await embedder.embedDocuments(chunks.map((chunk) => chunk.text))
      for (const [index, chunk] of chunks.entries()) {
        db.upsertChunk(relativePath, chunk.index, chunk.text, chunk.startLine, chunk.endLine, embeddings[index], fileHash, extractIdentifiers(chunk.text))
      }
      db.deleteOrphanChunks(relativePath, chunks.length - 1)
      return "reembedded"
    } finally {
      db.close()
    }
  }

  async collectGarbage(): Promise<string> {
    const dbPath = this.dbPath()
    if (!existsSync(dbPath)) {
      return "skipped"
    }

    const db = openDatabase(dbPath, this.config.embedding.dimensions)
    try {
      const lastGc = db.getSyncState("last_gc_time")
      if (lastGc && Date.now() - new Date(lastGc).getTime() < 60_000) {
        return "debounced"
      }

      let removed = 0
      for (const filePath of db.getIndexedFiles()) {
        if (!existsSync(path.join(this.repoRoot, filePath))) {
          db.deleteFileChunks(filePath)
          removed += 1
        }
      }

      db.setSyncState("last_gc_time", new Date().toISOString())
      return `removed:${removed}`
    } finally {
      db.close()
    }
  }

  async reindex(): Promise<string> {
    try {
      unlinkSync(this.dbPath())
    } catch {
      // Ignore.
    }
    return await this.sync(true)
  }

  async terminateIndexer(): Promise<{ status: string; pid?: number; message: string }> {
    if (!existsSync(this.pidFile)) {
      return { status: "no_process", message: "No sync process is currently running (no PID file found)." }
    }

    const pid = Number.parseInt(readFileSync(this.pidFile, "utf8").trim(), 10)
    if (Number.isNaN(pid)) {
      try {
        unlinkSync(this.pidFile)
      } catch {
        // Ignore.
      }
      return { status: "error", message: "Invalid PID file contents." }
    }

    let killed = false
    try {
      process.kill(pid, "SIGTERM")
      killed = true
    } catch (error) {
      const code = typeof error === "object" && error && "code" in error ? (error as { code?: string }).code : undefined
      if (code !== "ESRCH") {
        return { status: "error", message: error instanceof Error ? error.message : String(error), pid }
      }
    }

    try {
      unlinkSync(this.pidFile)
    } catch {
      // Ignore.
    }

    const dbPath = this.dbPath()
    if (existsSync(dbPath)) {
      const db = openDatabase(dbPath, this.config.embedding.dimensions)
      try {
        db.clearSyncProgress()
        db.setSyncState("sync_status", "idle")
      } finally {
        db.close()
      }
    }

    return killed
      ? { status: "terminated", pid, message: `Sync process ${pid} terminated and state cleaned up.` }
      : { status: "cleaned", pid, message: `Sync process ${pid} was not running (stale PID). Cleaned up state.` }
  }

  private async sync(force: boolean): Promise<string> {
    if (isPathBlacklisted(this.repoRoot, this.safetyConfigPath)) {
      return "blacklisted"
    }

    if (!force && this.config.indexing.auto_index === false) {
      return "auto-index-disabled"
    }

    mkdirSync(this.storagePath, { recursive: true })
    writeFileSync(this.pidFile, String(process.pid))

    const db = openDatabase(this.dbPath(), this.config.embedding.dimensions)
    const embedder = new Embedder(this.config)

    try {
      const dimensionCheck = db.checkDimensions()
      if (!dimensionCheck.ok) {
        db.setSyncState("sync_status", "error")
        db.setSyncState("sync_error", `Dimension mismatch: stored=${dimensionCheck.stored}, config=${dimensionCheck.current}`)
        return "dimension-mismatch"
      }

      const health = await embedder.ping()
      if (!health.ok) {
        db.setSyncState("sync_status", "error")
        db.setSyncState("sync_error", `Embedding endpoint unreachable: ${health.error}`)
        return "embedder-unreachable"
      }

      const syncStartTime = new Date().toISOString()
      db.setSyncState("sync_status", "in_progress")
      db.setSyncState("sync_started_at", syncStartTime)

      const stats = db.getStats()
      const lastSyncTime = db.getSyncState("last_sync_time")
      if (stats.fileCount === 0) {
        const files = getRepoFiles(this.repoRoot, this.config.indexing.max_files)
          .filter((filePath) => shouldIndex(filePath, this.config, this.repoRoot))
        db.setSyncState("sync_total_files", String(files.length))
        db.setSyncState("sync_completed_files", "0")
        await this.indexFiles(files, db, embedder)
      } else {
        const changedFiles = lastSyncTime
          ? getModifiedFilesSince(this.repoRoot, lastSyncTime).filter((filePath) => shouldIndex(filePath, this.config, this.repoRoot))
          : []

        const toIndex: string[] = []
        for (const filePath of changedFiles) {
          const absolutePath = path.join(this.repoRoot, filePath)
          if (!existsSync(absolutePath)) {
            db.deleteFileChunks(filePath)
            continue
          }
          const currentHash = getFileHash(absolutePath)
          if (currentHash !== db.getFileHash(filePath)) {
            toIndex.push(filePath)
          }
        }

        db.setSyncState("sync_total_files", String(toIndex.length))
        db.setSyncState("sync_completed_files", "0")
        await this.indexFiles(toIndex, db, embedder)
      }

      db.clearSyncProgress()
      db.setSyncState("sync_status", "idle")
      db.setSyncState("last_sync_time", syncStartTime)
      db.storeDimensions()
      return "ok"
    } finally {
      db.close()
      try {
        unlinkSync(this.pidFile)
      } catch {
        // Ignore.
      }
    }
  }

  private async indexFiles(files: string[], db: ReturnType<typeof openDatabase>, embedder: Embedder): Promise<void> {
    let processed = 0
    for (const filePath of files) {
      db.setSyncState("sync_current_file", filePath)
      const absolutePath = path.join(this.repoRoot, filePath)
      const content = readFileSync(absolutePath, "utf8")
      const fileHash = getFileHash(absolutePath)
      const chunks = chunkCode(content, filePath, this.config)
      if (chunks.length === 0) {
        processed += 1
        db.setSyncState("sync_completed_files", String(processed))
        continue
      }

      const embeddings = await embedder.embedDocuments(chunks.map((chunk) => chunk.text))
      for (const [index, chunk] of chunks.entries()) {
        db.upsertChunk(filePath, chunk.index, chunk.text, chunk.startLine, chunk.endLine, embeddings[index], fileHash, extractIdentifiers(chunk.text))
      }
      db.deleteOrphanChunks(filePath, chunks.length - 1)
      processed += 1
      db.setSyncState("sync_completed_files", String(processed))
    }
  }

  private dbPath(): string {
    return path.join(this.storagePath, "embeddings.db")
  }
}
