import { describe, expect, test, beforeAll, afterAll } from "bun:test"
import { shouldIndex } from "../../../src/core/repo/ignore"
import { OPEN_BEACON_DEFAULT_CONFIG } from "../../../src/config/defaults"
import { mkdtempSync, rmSync, writeFileSync, mkdirSync } from "node:fs"
import { tmpdir } from "node:os"
import path from "node:path"

describe("shouldIndex", () => {
  let root: string

  beforeAll(() => {
    root = mkdtempSync(path.join(tmpdir(), "open-beacon-ignore-"))
    writeFileSync(path.join(root, "test.ts"), "const x = 1;")
    writeFileSync(path.join(root, "large.ts"), "A".repeat(1024 * 60)) // 60KB
    mkdirSync(path.join(root, "dist"))
    writeFileSync(path.join(root, "dist", "out.js"), "const y = 2;")
    writeFileSync(path.join(root, ".beaconignore"), "dist/\n*.log\n")
    writeFileSync(path.join(root, "test.log"), "log file")
  })

  afterAll(() => {
    rmSync(root, { recursive: true, force: true })
  })

  test("returns true for matching include pattern and not excluded/ignored", () => {
    expect(shouldIndex("test.ts", OPEN_BEACON_DEFAULT_CONFIG, root)).toBe(true)
  })

  test("returns false for files not in include pattern", () => {
    expect(shouldIndex("random.txt", OPEN_BEACON_DEFAULT_CONFIG, root)).toBe(false)
  })

  test("returns false for excluded patterns in config", () => {
    // node_modules is default excluded
    expect(shouldIndex("node_modules/pkg/index.js", OPEN_BEACON_DEFAULT_CONFIG, root)).toBe(false)
  })

  test("returns false for ignored patterns in .beaconignore", () => {
    expect(shouldIndex("dist/out.js", OPEN_BEACON_DEFAULT_CONFIG, root)).toBe(false)
    expect(shouldIndex("test.log", OPEN_BEACON_DEFAULT_CONFIG, root)).toBe(false)
  })

  test("returns false for files exceeding max_file_size_kb", () => {
    const config = {
      ...OPEN_BEACON_DEFAULT_CONFIG,
      indexing: {
        ...OPEN_BEACON_DEFAULT_CONFIG.indexing,
        max_file_size_kb: 50, // 50KB limit
      },
    }
    expect(shouldIndex("large.ts", config, root)).toBe(false)
  })

  test("returns false if file doesn't exist (stat fails)", () => {
    expect(shouldIndex("does-not-exist.ts", OPEN_BEACON_DEFAULT_CONFIG, root)).toBe(false)
  })
})
