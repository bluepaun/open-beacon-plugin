import { describe, expect, test, beforeAll, afterAll } from "bun:test"
import { openDatabase } from "../../../src/core/storage/open-db"
import { mkdtempSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import path from "node:path"

describe("openDatabase", () => {
  let root: string

  beforeAll(() => {
    root = mkdtempSync(path.join(tmpdir(), "open-beacon-opendb-"))
  })

  afterAll(() => {
    rmSync(root, { recursive: true, force: true })
  })

  test("opens a valid database", () => {
    const dbPath = path.join(root, "valid.db")
    const db = openDatabase(dbPath, 384)
    expect(db).toBeDefined()
    db.close()
  })

  test("deletes and recreates malformed database", () => {
    const dbPath = path.join(root, "malformed.db")
    
    // Write invalid data to the file to make it not a database
    writeFileSync(dbPath, "this is not a sqlite database")
    writeFileSync(`${dbPath}-wal`, "garbage")
    writeFileSync(`${dbPath}-shm`, "garbage")

    // This should catch the error, delete the files, and recreate
    const db = openDatabase(dbPath, 384)
    expect(db).toBeDefined()
    
    // Check that it's a valid DB now
    const stats = db.getStats()
    expect(stats).toBeDefined()
    db.close()
  })
  
  test("throws on other errors", () => {
    // A directory path cannot be opened as a SQLite DB
    const dirPath = path.join(root, "somedir")
    require("node:fs").mkdirSync(dirPath)
    
    expect(() => openDatabase(dirPath, 384)).toThrow()
  })
})
