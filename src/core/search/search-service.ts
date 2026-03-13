import path from "node:path"

import type { OpenBeaconConfig } from "../../config/schema"
import { chunkCode } from "../chunking/chunker"
import { Embedder } from "../embedding/embedder"
import { getRepoRoot } from "../repo/repo-root"
import { openDatabase } from "../storage/open-db"

export type SearchArgs = {
  query: string
  topK?: number
  threshold?: number
  path?: string
  hybrid?: boolean
}

type SearchMatch = {
  file: string
  lines: string
  similarity: string
  score?: string
  preview: string
  _note?: string
}

type SearchRow = {
  filePath: string
  chunkText: string
  startLine: number
  endLine: number
  similarity: number
  score?: number
}

export class SearchService {
  private readonly repoRoot: string

  constructor(
    private readonly directory: string,
    private readonly config: OpenBeaconConfig,
  ) {
    this.repoRoot = getRepoRoot(directory)
  }

  async search(args: SearchArgs): Promise<SearchMatch[]> {
    const dbPath = path.join(this.resolveStoragePath(), "embeddings.db")
    const db = openDatabase(dbPath, this.config.embedding.dimensions)

    try {
      const dimensionCheck = db.checkDimensions()
      if (!dimensionCheck.ok) {
        throw new Error(`Dimension mismatch: DB has ${dimensionCheck.stored}d embeddings but config specifies ${dimensionCheck.current}d. Run reindex.`)
      }

      const effectiveConfig: OpenBeaconConfig = {
        ...this.config,
        search: {
          ...this.config.search,
          top_k: args.topK ?? this.config.search.top_k,
          similarity_threshold: args.threshold ?? this.config.search.similarity_threshold,
          hybrid: {
            ...this.config.search.hybrid,
            enabled: args.hybrid ?? this.config.search.hybrid.enabled,
          },
        },
      }

      const embedder = new Embedder(effectiveConfig)
      try {
        const queryEmbedding = await embedder.embedQuery(args.query)
        return mergeAdjacentChunks(
          (db.search(
            queryEmbedding,
            effectiveConfig.search.top_k,
            effectiveConfig.search.similarity_threshold,
            args.query,
            effectiveConfig,
            args.path,
          ) as SearchRow[]).map((row) => ({
            file: row.filePath,
            lines: `${row.startLine}-${row.endLine}`,
            similarity: row.similarity.toFixed(3),
            ...(row.score !== undefined ? { score: row.score.toFixed(3) } : {}),
            preview: row.chunkText.slice(0, 300),
          })),
        )
      } catch {
        return mergeAdjacentChunks(
          db.ftsOnlySearch(args.query, effectiveConfig.search.top_k, args.path).map((row) => ({
            file: row.filePath,
            lines: `${row.startLine}-${row.endLine}`,
            similarity: "0.000",
            score: row.score.toFixed(3),
            preview: row.chunkText.slice(0, 300),
            _note: row._note,
          })),
        )
      }
    } finally {
      db.close()
    }
  }

  getPreviewChunks(content: string, filePath: string): ReturnType<typeof chunkCode> {
    return chunkCode(content, filePath, this.config)
  }

  private resolveStoragePath(): string {
    return path.isAbsolute(this.config.storage.path)
      ? this.config.storage.path
      : path.join(this.repoRoot, this.config.storage.path)
  }
}

export function mergeAdjacentChunks(matches: SearchMatch[]): SearchMatch[] {
  if (matches.length <= 1) {
    return matches
  }

  const sorted = matches
    .map((match) => {
      const [start, end] = match.lines.split("-").map(Number)
      return { ...match, _start: start, _end: end }
    })
    .sort((left, right) => left.file.localeCompare(right.file) || left._start - right._start)

  const merged: Array<SearchMatch & { _start: number; _end: number }> = []
  let current = sorted[0]

  for (let index = 1; index < sorted.length; index += 1) {
    const next = sorted[index]
    if (next.file === current.file && next._start <= current._end + 5) {
      current = {
        ...current,
        _end: Math.max(current._end, next._end),
        lines: `${current._start}-${Math.max(current._end, next._end)}`,
        score: current.score && next.score ? Math.max(Number(current.score), Number(next.score)).toFixed(3) : current.score,
        similarity: Math.max(Number(current.similarity), Number(next.similarity)).toFixed(3),
      }
      continue
    }

    merged.push(current)
    current = next
  }

  merged.push(current)
  return merged
    .map(({ _start, _end, ...rest }) => rest)
    .sort((left, right) => Number(right.score ?? right.similarity) - Number(left.score ?? left.similarity))
}
