import { existsSync } from "node:fs"
import path from "node:path"

import type { OpenBeaconConfig } from "../../config/schema"
import { OPEN_BEACON_PROVIDERS } from "../../config/providers"
import { getRepoFiles } from "../repo/git"
import { shouldIndex } from "../repo/ignore"
import { getRepoRoot } from "../repo/repo-root"
import { BeaconDatabase } from "../storage/db"
import { openDatabase } from "../storage/open-db"

export class StatusService {
  private readonly repoRoot: string
  private readonly storagePath: string

  constructor(
    private readonly directory: string,
    private readonly config: OpenBeaconConfig,
  ) {
    this.repoRoot = getRepoRoot(directory)
    this.storagePath = path.isAbsolute(config.storage.path) ? config.storage.path : path.join(this.repoRoot, config.storage.path)
  }

  async getIndexOverview(): Promise<unknown> {
    if (!existsSync(this.dbPath())) {
      return {
        status: "no_index",
        message: "No index found. It will be created on next session start.",
        config: this.getConfigSummary(),
      }
    }

    const db = openDatabase(this.dbPath(), this.config.embedding.dimensions)
    try {
      const stats = db.getStats()
      const fileStats = db.getFileStats()
      const syncProgress = db.getSyncProgress()
      const lastSync = db.getSyncState("last_sync_time")
      const eligibleFiles = getRepoFiles(this.repoRoot, this.config.indexing.max_files).filter((filePath) => shouldIndex(filePath, this.config, this.repoRoot))
      const extCounts = new Map<string, number>()
      for (const file of fileStats) {
        const ext = path.extname(file.filePath) || "(none)"
        extCounts.set(ext, (extCounts.get(ext) ?? 0) + 1)
      }
      return {
        index: {
          files_indexed: stats.fileCount,
          total_chunks: stats.chunkCount,
          eligible_files: eligibleFiles.length,
          coverage_percent: eligibleFiles.length > 0 ? Math.round((stats.fileCount / eligibleFiles.length) * 100) : null,
          avg_chunks_per_file: stats.fileCount > 0 ? Math.round((stats.chunkCount / stats.fileCount) * 10) / 10 : 0,
          extensions: [...extCounts.entries()].map(([ext, count]) => ({ ext, count })).sort((left, right) => right.count - left.count),
          db_size_bytes: db.getDbSizeBytes(),
          db_path: this.dbPath(),
        },
        sync: {
          status: syncProgress.sync_status ?? "idle",
          total: Number.parseInt(syncProgress.sync_total_files ?? "0", 10),
          completed: Number.parseInt(syncProgress.sync_completed_files ?? "0", 10),
          current_file: syncProgress.sync_current_file ?? null,
          error: syncProgress.sync_error ?? null,
          last_sync: lastSync,
        },
        config: this.getConfigSummary(),
        files: fileStats.map((file) => ({
          path: file.filePath,
          chunks: file.chunkCount,
          last_updated: file.lastUpdated,
        })),
      }
    } finally {
      db.close()
    }
  }

  async getIndexStatus(): Promise<unknown> {
    if (!existsSync(this.dbPath())) {
      return {
        files_indexed: 0,
        total_chunks: 0,
        last_sync: null,
        db_path: this.dbPath(),
        embedding_model: this.config.embedding.model,
        embedding_endpoint: this.config.embedding.api_base,
      }
    }

    const db = openDatabase(this.dbPath(), this.config.embedding.dimensions)
    try {
      const stats = db.getStats()
      return {
        files_indexed: stats.fileCount,
        total_chunks: stats.chunkCount,
        last_sync: db.getSyncState("last_sync_time"),
        db_path: this.dbPath(),
        embedding_model: this.config.embedding.model,
        embedding_endpoint: this.config.embedding.api_base,
      }
    } finally {
      db.close()
    }
  }

  async getCompactStatus(): Promise<string> {
    if (!existsSync(this.dbPath())) {
      return "Beacon: no index found yet. It will be created on next session start."
    }

    const health = BeaconDatabase.healthCheck(this.dbPath(), this.config.embedding.dimensions)
    if (!health.ok) {
      return "Beacon: index unavailable. Use grep for code search and rebuild the index if needed."
    }

    return `Beacon: hybrid code search active (${health.fileCount} files, ${health.chunkCount} chunks). Prefer beacon_search over grep for semantic code search.`
  }

  private getConfigSummary() {
    const detectedProvider = Object.entries(OPEN_BEACON_PROVIDERS).find(([, preset]) => {
      const embedding = preset.embedding
      return embedding.api_base === this.config.embedding.api_base
        && embedding.model === this.config.embedding.model
        && embedding.dimensions === this.config.embedding.dimensions
    })

    return {
      model: this.config.embedding.model,
      endpoint: this.config.embedding.api_base,
      dimensions: this.config.embedding.dimensions,
      provider: detectedProvider?.[0] ?? "custom",
      provider_description: detectedProvider?.[1].description ?? "Custom",
      chunking_strategy: this.config.chunking.strategy,
      max_tokens_per_chunk: this.config.chunking.max_tokens,
      storage_path: this.storagePath,
    }
  }

  private dbPath(): string {
    return path.join(this.storagePath, "embeddings.db")
  }
}
