import { describe, expect, test } from "bun:test"
import { mkdtempSync, mkdirSync, rmSync } from "node:fs"
import { tmpdir } from "node:os"
import path from "node:path"

import { OPEN_BEACON_DEFAULT_CONFIG } from "../../src/config/defaults"
import { BeaconDatabase } from "../../src/core/storage/db"
import { createGrepRedirectHook } from "../../src/hooks/grep-redirect"

describe("createGrepRedirectHook", () => {
  describe("#given a semantic grep query and a healthy Beacon index", () => {
    test("#when Beacon intercept is enabled #then grep is blocked and redirected", async () => {
      const root = mkdtempSync(path.join(tmpdir(), "open-beacon-grep-"))
      const storageDir = path.join(root, ".opencode", ".beacon")
      mkdirSync(storageDir, { recursive: true })
      const db = new BeaconDatabase(path.join(storageDir, "embeddings.db"), 4)
      db.upsertChunk("src/auth.ts", 0, "function signIn() {}", 1, 1, [1, 0, 0, 0], "hash", "signIn")
      db.storeDimensions()
      db.setSyncState("sync_status", "idle")
      db.close()

      const hook = createGrepRedirectHook({
        directory: root,
        pluginConfig: {
          ...OPEN_BEACON_DEFAULT_CONFIG,
          embedding: { ...OPEN_BEACON_DEFAULT_CONFIG.embedding, dimensions: 4 },
        },
      })

      const output: { blocked?: boolean; message?: string } = {}
      await hook({ tool: "grep", args: { pattern: "authentication flow" } }, output)

      expect(output.blocked).toBe(true)
      expect(output.message).toContain("beacon_search")

      rmSync(root, { recursive: true, force: true })
    })
  })

  describe("#given a regex style grep query", () => {
    test("#when regex syntax is present #then grep is allowed through", async () => {
      const hook = createGrepRedirectHook({
        directory: process.cwd(),
        pluginConfig: OPEN_BEACON_DEFAULT_CONFIG,
      })

      const output: { blocked?: boolean; message?: string } = {}
      await hook({ tool: "grep", args: { pattern: "function\\s+\\w+" } }, output)

      expect(output.blocked).toBeUndefined()
      expect(output.message).toBeUndefined()
    })
  })
})
