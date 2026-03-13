import { describe, expect, test } from "bun:test"
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import path from "node:path"

import { loadPluginConfig } from "../src/plugin-config"

describe("loadPluginConfig", () => {
  describe("#given layered config files", () => {
    test("#when project config is loaded #then defaults global legacy and project values are merged in order", () => {
      const root = mkdtempSync(path.join(tmpdir(), "open-beacon-config-"))
      const projectDir = path.join(root, "project")
      const homeDir = path.join(root, "home")

      mkdirSync(path.join(projectDir, ".opencode"), { recursive: true })
      mkdirSync(path.join(projectDir, ".claude"), { recursive: true })
      mkdirSync(path.join(homeDir, ".config", "opencode"), { recursive: true })

      writeFileSync(
        path.join(homeDir, ".config", "opencode", "open-beacon.jsonc"),
        `{
          "search": { "top_k": 15 },
          "disabled_tools": ["beacon_config"]
        }`,
      )

      writeFileSync(
        path.join(projectDir, ".claude", "beacon.json"),
        JSON.stringify({
          storage: { path: ".claude/.beacon" },
          search: { top_k: 20 },
          disabled_hooks: ["compact-status"],
        }),
      )

      writeFileSync(
        path.join(projectDir, ".opencode", "open-beacon.json"),
        JSON.stringify({
          search: { top_k: 25 },
          disabled_tools: ["beacon_index"],
        }),
      )

      const config = loadPluginConfig(projectDir, { homeDir })

      expect(config.search.top_k).toBe(25)
      expect(config.storage.path).toBe(".claude/.beacon")
      expect(config.disabled_tools).toEqual(["beacon_config", "beacon_index"])
      expect(config.disabled_hooks).toEqual(["compact-status"])
      expect(config.embedding.model).toBe("nomic-embed-text")

      rmSync(root, { recursive: true, force: true })
    })
  })
})
