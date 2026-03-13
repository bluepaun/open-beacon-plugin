import { describe, expect, test } from "bun:test"
import { mkdtempSync, rmSync } from "node:fs"
import { tmpdir } from "node:os"
import path from "node:path"

import { BeaconDatabase } from "../src/core/storage/db"

const dimensions = 4

describe("BeaconDatabase", () => {
  test("#given a fresh database #when initialized #then schema and migration state are created", () => {
    const root = mkdtempSync(path.join(tmpdir(), "open-beacon-db-"))
    const db = new BeaconDatabase(path.join(root, "test.db"), dimensions)

    expect(db.getSyncState("schema_version")).toBe("2")
    expect((db.db.query("PRAGMA table_info(chunks)").all() as Array<{ name: string }>).some((column) => column.name === "identifiers")).toBe(true)

    db.close()
    rmSync(root, { recursive: true, force: true })
  })

  test("#given populated chunks #when hybrid and FTS-only search run #then relevant code is ranked and returned", () => {
    const root = mkdtempSync(path.join(tmpdir(), "open-beacon-db-"))
    const db = new BeaconDatabase(path.join(root, "test.db"), dimensions)

    db.upsertChunk("src/auth.ts", 0, "export function signInWithGoogle() {}", 1, 1, [0.9, 0.1, 0, 0], "hash1")
    db.upsertChunk("README.md", 0, "This project uses signInWithGoogle.", 1, 1, [0.8, 0.2, 0, 0], "hash2")

    const hybridResults = db.search([0.9, 0.1, 0, 0], 10, 0, "signInWithGoogle function", {
      search: {
        hybrid: {
          enabled: true,
          weight_vector: 0.4,
          weight_bm25: 0.3,
          weight_rrf: 0.3,
        },
      },
    })

    expect(hybridResults[0]?.filePath).toBe("src/auth.ts")

    const ftsResults = db.ftsOnlySearch("signInWithGoogle", 10)
    expect(ftsResults[0]?._note).toContain("FTS-only")

    db.close()
    rmSync(root, { recursive: true, force: true })
  })
})
