import { describe, expect, test } from "bun:test"

import { createHooks } from "../src/create-hooks"
import type { Managers } from "../src/create-managers"
import { OPEN_BEACON_DEFAULT_CONFIG } from "../src/config/defaults"
import { createPluginInterface } from "../src/plugin-interface"

function createManagersWithCounters(counters: { sync: number; reembed: string[]; gc: number }): Managers {
  return {
    searchService: {
      async search() {
        return []
      },
    },
    indexingService: {
      async autoSync() {
        counters.sync += 1
        return "auto-sync"
      },
      async runIndexer() {
        return "run-indexer"
      },
      async reembedFile(filePath: string) {
        counters.reembed.push(filePath)
        return "reembed-file"
      },
      async collectGarbage() {
        counters.gc += 1
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
        return { files_indexed: 1 }
      },
      async getCompactStatus() {
        return "Beacon: healthy"
      },
    },
    configService: {
      getEffectiveConfig() {
        return OPEN_BEACON_DEFAULT_CONFIG
      },
      show() {
        return { show: true }
      },
      set() {
        return { ok: true }
      },
      provider() {
        return { ok: true }
      },
      reset() {
        return { ok: true }
      },
    },
    safetyService: {
      showBlacklist() {
        return { blacklist: [] }
      },
      addBlacklist() {
        return { ok: true }
      },
      removeBlacklist() {
        return { ok: true }
      },
      resetBlacklist() {
        return { ok: true }
      },
      showWhitelist() {
        return { whitelist: [] }
      },
      addWhitelist() {
        return { ok: true }
      },
      removeWhitelist() {
        return { ok: true }
      },
      clearWhitelist() {
        return { ok: true }
      },
      isWhitelisted() {
        return false
      },
    },
    safetyConfigPath: "/tmp/open-beacon-global.json",
  }
}

describe("createPluginInterface", () => {
  describe("#given active Beacon hooks", () => {
    test("#when event and lifecycle handlers are called #then work is dispatched to the right services", async () => {
      const counters = { sync: 0, reembed: [] as string[], gc: 0 }
      const managers = createManagersWithCounters(counters)
      const hooks = createHooks({ directory: process.cwd(), pluginConfig: OPEN_BEACON_DEFAULT_CONFIG, managers })
      const pluginInterface = createPluginInterface({ hooks, tools: {} })

      await pluginInterface.event({ event: { type: "session.created" } })
      await pluginInterface.event({ event: { type: "file.edited", properties: { filePath: "src/app.ts" } } })
      await pluginInterface["tool.execute.after"]({ tool: "bash" }, {})

      const compactOutput = { context: [] as string[] }
      await pluginInterface["experimental.session.compacting"]({ sessionID: "s1" }, compactOutput)

      expect(counters.sync).toBe(1)
      expect(counters.reembed).toEqual(["src/app.ts"])
      expect(counters.gc).toBe(1)
      expect(compactOutput.context).toEqual(["Beacon: healthy"])
    })

    test("#when config hook runs #then bundled agents are registered without overriding user config", async () => {
      const managers = createManagersWithCounters({ sync: 0, reembed: [], gc: 0 })
      const hooks = createHooks({ directory: process.cwd(), pluginConfig: OPEN_BEACON_DEFAULT_CONFIG, managers })
      const pluginInterface = createPluginInterface({ hooks, tools: {} })
      const config = {
        agent: {
          "code-explorer": {
            description: "Custom explorer",
            mode: "subagent",
          },
          reviewer: {
            description: "Review only",
            mode: "subagent",
          },
        },
      }

      await pluginInterface.config(config)

      expect(config.agent["code-explorer"]).toEqual({
        description: "Custom explorer",
        mode: "subagent",
      })
      expect(config.agent.reviewer).toEqual({
        description: "Review only",
        mode: "subagent",
      })
    })
  })
})
