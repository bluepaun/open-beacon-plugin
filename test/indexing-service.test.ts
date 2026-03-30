import { describe, expect, test, beforeAll, afterAll } from "bun:test"
import { mkdtempSync, rmSync, writeFileSync, mkdirSync } from "node:fs"
import { tmpdir } from "node:os"
import path from "node:path"
import { execSync } from "node:child_process"
import "../src/index"

import { IndexingService } from "../src/core/indexing/indexing-service"
import { OPEN_BEACON_DEFAULT_CONFIG } from "../src/config/defaults"
import { openDatabase } from "../src/core/storage/open-db"

describe("IndexingService", () => {
  let root: string

  beforeAll(() => {
    root = mkdtempSync(path.join(tmpdir(), "open-beacon-indexing-"))
    // Initialize a git repo so getRepoFiles works
    execSync("git init", { cwd: root })
    
    // Create a sample source file
    mkdirSync(path.join(root, "src"))
    writeFileSync(path.join(root, "src", "sample.ts"), "export function sampleFunction() { return 'hello world'; }")
    
    // Commit it so it's tracked
    execSync("git add .", { cwd: root })
    execSync("git commit -m 'initial'", { cwd: root, env: { ...process.env, GIT_AUTHOR_NAME: "Test", GIT_AUTHOR_EMAIL: "test@example.com", GIT_COMMITTER_NAME: "Test", GIT_COMMITTER_EMAIL: "test@example.com" } })
  })

  afterAll(() => {
    rmSync(root, { recursive: true, force: true })
   })

  test.skip("#given a test file #when indexer runs #then db contains chunks and embeddings", async () => {
    const config = {
      ...OPEN_BEACON_DEFAULT_CONFIG,
      embedding: {
        ...OPEN_BEACON_DEFAULT_CONFIG.embedding,
        // Use a smaller model to make the test faster
        provider: "local" as const,
        model: "Xenova/all-MiniLM-L6-v2",
        dimensions: 384,
      },
      storage: {
        path: ".beacon-test",
      }
    }

    const indexingService = new IndexingService(root, config, path.join(root, "safety.json"))
    
    // Run the indexer
    const result = await indexingService.runIndexer()
    expect(result).toBe("ok")

    // Verify DB
    const dbPath = path.join(root, config.storage.path, "embeddings.db")
    const db = openDatabase(dbPath, config.embedding.dimensions)
    
    try {
      const stats = db.getStats()
      expect(stats.fileCount).toBeGreaterThan(0)
      
      const indexedFiles = db.getIndexedFiles()
      expect(indexedFiles).toContain("src/sample.ts")
      
      const fileHash = db.getFileHash("src/sample.ts")
      expect(fileHash).toBeTruthy()
      
      // Test search to verify embeddings are present and working
      const searchResults = db.ftsOnlySearch("sampleFunction", 5)
      expect(searchResults.length).toBeGreaterThan(0)
      expect(searchResults[0].filePath).toBe("src/sample.ts")
      expect(searchResults[0].chunkText).toContain("sampleFunction")
    } finally {
      db.close()
      await new Promise((resolve) => setTimeout(resolve, 500))
    }
  }, 60000) // 60s timeout in case model needs to download
})
