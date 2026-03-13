import { describe, expect, test } from "bun:test"

import type { Managers } from "../src/create-managers"
import { createTools } from "../src/create-tools"
import { OPEN_BEACON_DEFAULT_CONFIG } from "../src/config/defaults"

function createFakeManagers(): Managers {
  return {
    searchService: {
      async search() {
        return [{ file: "src/auth.ts", lines: "1-10", similarity: "0.900", preview: "export function signIn() {}" }]
      },
    },
    indexingService: {
      async autoSync() {
        return "auto-sync"
      },
      async runIndexer() {
        return "run-indexer"
      },
      async reembedFile() {
        return "reembed-file"
      },
      async collectGarbage() {
        return "gc"
      },
      async reindex() {
        return "reindex"
      },
      async terminateIndexer() {
        return { status: "no_process", message: "none" }
      },
    },
    statusService: {
      async getIndexOverview() {
        return { overview: true }
      },
      async getIndexStatus() {
        return { files_indexed: 12 }
      },
      async getCompactStatus() {
        return "compact"
      },
    },
    configService: {
      getEffectiveConfig() {
        return OPEN_BEACON_DEFAULT_CONFIG
      },
      show() {
        return { show: true }
      },
      set(key: string, value: string) {
        return { key, value }
      },
      provider(name?: string) {
        return { name }
      },
      reset(section?: string) {
        return { section }
      },
    },
    safetyService: {
      showBlacklist() {
        return { blacklist: [] }
      },
      addBlacklist(targetPath: string) {
        return { action: "added", path: targetPath }
      },
      removeBlacklist(targetPath: string) {
        return { action: "removed", path: targetPath }
      },
      resetBlacklist() {
        return { action: "reset" }
      },
      showWhitelist() {
        return { whitelist: [] }
      },
      addWhitelist(targetPath: string) {
        return { action: "added", path: targetPath }
      },
      removeWhitelist(targetPath: string) {
        return { action: "removed", path: targetPath }
      },
      clearWhitelist() {
        return { action: "cleared" }
      },
      isWhitelisted() {
        return false
      },
    },
    safetyConfigPath: "/tmp/open-beacon-global.json",
  }
}

describe("createTools", () => {
  describe("#given disabled tool configuration", () => {
    test("#when the registry is created #then disabled tools are filtered out", async () => {
      const managers = createFakeManagers()
      const { tools } = createTools({
        pluginConfig: {
          ...OPEN_BEACON_DEFAULT_CONFIG,
          disabled_tools: ["beacon_index"],
        },
        managers,
      })

      expect(Object.keys(tools)).not.toContain("beacon_index")
      expect(Object.keys(tools)).toContain("beacon_search")
      expect(Object.keys(tools)).toContain("beacon_blacklist")

      const results = await tools.beacon_search.execute({ query: "auth flow" })
      expect(results).toEqual([{ file: "src/auth.ts", lines: "1-10", similarity: "0.900", preview: "export function signIn() {}" }])
    })
  })
})
