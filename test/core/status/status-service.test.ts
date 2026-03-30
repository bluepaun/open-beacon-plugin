import { describe, expect, test, beforeAll, afterAll } from "bun:test"
import { StatusService } from "../../../src/core/status/status-service"
import { OPEN_BEACON_DEFAULT_CONFIG } from "../../../src/config/defaults"
import { mkdtempSync, rmSync, mkdirSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import path from "node:path"
import { openDatabase } from "../../../src/core/storage/open-db"
import { execSync } from "node:child_process"

describe("StatusService", () => {
  let root: string
  let service: StatusService

  beforeAll(() => {
    root = mkdtempSync(path.join(tmpdir(), "open-beacon-status-"))
    
    // Initialize git repo
    execSync("git init", { cwd: root })
    writeFileSync(path.join(root, "test.ts"), "const x = 1;")
    execSync("git add .", { cwd: root })
    execSync("git commit -m 'initial'", { cwd: root, env: { ...process.env, GIT_AUTHOR_NAME: "Test", GIT_AUTHOR_EMAIL: "test@example.com", GIT_COMMITTER_NAME: "Test", GIT_COMMITTER_EMAIL: "test@example.com" } })

    const config = {
      ...OPEN_BEACON_DEFAULT_CONFIG,
      storage: {
        path: ".beacon-test",
      }
    }
    mkdirSync(path.join(root, config.storage.path))
    service = new StatusService(root, config)
  })

  afterAll(() => {
    rmSync(root, { recursive: true, force: true })
  })

  test("returns no_index when db does not exist", async () => {
    const res = await service.getIndexOverview() as any
    expect(res.status).toBe("no_index")
    expect(res.message).toContain("No index found")
  })

  test("getIndexStatus returns zeroes when db does not exist", async () => {
    const res = await service.getIndexStatus() as any
    expect(res.files_indexed).toBe(0)
    expect(res.total_chunks).toBe(0)
  })

  test("getCompactStatus returns generic message when db does not exist", async () => {
    const res = await service.getCompactStatus()
    expect(res).toContain("no index found yet")
  })

  test("returns accurate stats when db exists", async () => {
    // Create the DB
    const dbPath = path.join(root, ".beacon-test", "embeddings.db")
    const db = openDatabase(dbPath, OPEN_BEACON_DEFAULT_CONFIG.embedding.dimensions)
    
    // Insert some mock data using the public API
    const embedding = Array(OPEN_BEACON_DEFAULT_CONFIG.embedding.dimensions).fill(0.1)
    db.upsertChunk("test.ts", 0, "const x = 1;", 1, 1, embedding, "hash1", "x")
    db.setSyncState("last_sync_time", new Date().toISOString())
    db.setSyncState("sync_status", "completed")
    db.setSyncState("sync_total_files", "1")
    db.setSyncState("sync_completed_files", "1")
    
    db.close()

    // Now test the service
    const overview = await service.getIndexOverview() as any
    expect(overview.index.files_indexed).toBe(1)
    expect(overview.index.total_chunks).toBe(1)
    expect(overview.index.eligible_files).toBeGreaterThan(0) // 1 file test.ts
    
    const status = await service.getIndexStatus() as any
    expect(status.files_indexed).toBe(1)
    expect(status.total_chunks).toBe(1)
    
    const compact = await service.getCompactStatus()
    expect(compact).toContain("hybrid code search active (1 files, 1 chunks)")
  })
})
