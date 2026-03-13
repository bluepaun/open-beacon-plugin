import { describe, expect, test } from "bun:test"

import { createBeaconBlacklistTool } from "../src/tools/beacon-blacklist"
import { createBeaconConfigTool } from "../src/tools/beacon-config"
import { createBeaconIndexStatusTool } from "../src/tools/beacon-index-status"
import { createBeaconIndexTool } from "../src/tools/beacon-index"
import { createBeaconReindexTool } from "../src/tools/beacon-reindex"
import { createBeaconRunIndexerTool } from "../src/tools/beacon-run-indexer"
import { createBeaconTerminateIndexerTool } from "../src/tools/beacon-terminate-indexer"
import { createBeaconWhitelistTool } from "../src/tools/beacon-whitelist"

describe("tool wrappers", () => {
  test("executes blacklist actions", async () => {
    const calls: Array<[string, string?]> = []
    const tool = createBeaconBlacklistTool({
      showBlacklist() {
        calls.push(["show"])
        return { blacklist: ["/tmp"] }
      },
      addBlacklist(targetPath: string) {
        calls.push(["add", targetPath])
        return { added: targetPath }
      },
      removeBlacklist(targetPath: string) {
        calls.push(["remove", targetPath])
        return { removed: targetPath }
      },
      resetBlacklist() {
        calls.push(["reset"])
        return { reset: true }
      },
    })

    expect(await tool.execute({ action: "show" })).toBe(JSON.stringify({ blacklist: ["/tmp"] }, null, 2))
    expect(await tool.execute({ action: "add", path: "src" })).toBe(JSON.stringify({ added: "src" }, null, 2))
    expect(await tool.execute({ action: "remove", path: "src" })).toBe(JSON.stringify({ removed: "src" }, null, 2))
    expect(await tool.execute({ action: "reset" })).toBe(JSON.stringify({ reset: true }, null, 2))
    expect(await tool.execute({ action: "invalid" } as never)).toBe(JSON.stringify({ error: "Unknown action: invalid" }, null, 2))
    expect(calls).toEqual([
      ["show"],
      ["add", "src"],
      ["remove", "src"],
      ["reset"],
    ])
  })

  test("executes whitelist actions and resolves default paths", async () => {
    const calls: Array<[string, string?]> = []
    const tool = createBeaconWhitelistTool({
      showWhitelist() {
        calls.push(["show"])
        return { whitelist: ["/repo"] }
      },
      addWhitelist(targetPath: string) {
        calls.push(["add", targetPath])
        return { added: targetPath }
      },
      removeWhitelist(targetPath: string) {
        calls.push(["remove", targetPath])
        return { removed: targetPath }
      },
      clearWhitelist() {
        calls.push(["clear"])
        return { cleared: true }
      },
    })

    expect(await tool.execute({ action: "show" }, {})).toBe(JSON.stringify({ whitelist: ["/repo"] }, null, 2))
    expect(await tool.execute({ action: "add", path: "src" }, {})).toBe(JSON.stringify({ added: "src" }, null, 2))
    expect(await tool.execute({ action: "remove" }, { directory: "/workspace/project" })).toBe(JSON.stringify({ removed: "/workspace/project" }, null, 2))
    expect(await tool.execute({ action: "remove" }, null)).toBe(JSON.stringify({ removed: process.cwd() }, null, 2))
    expect(await tool.execute({ action: "clear" }, {})).toBe(JSON.stringify({ cleared: true }, null, 2))
    expect(await tool.execute({ action: "invalid" } as never, {})).toBe(JSON.stringify({ error: "Unknown action: invalid" }, null, 2))
    expect(calls).toEqual([
      ["show"],
      ["add", "src"],
      ["remove", "/workspace/project"],
      ["remove", process.cwd()],
      ["clear"],
    ])
  })

  test("executes config actions", async () => {
    const calls: Array<[string, string?, string?]> = []
    const tool = createBeaconConfigTool({
      show() {
        calls.push(["show"])
        return { mode: "show" }
      },
      set(key: string, value: string) {
        calls.push(["set", key, value])
        return { key, value }
      },
      provider(name?: string) {
        calls.push(["provider", name])
        return { provider: name ?? "default" }
      },
      reset(section?: string) {
        calls.push(["reset", section])
        return { section: section ?? "all" }
      },
    })

    expect(await tool.execute({ action: "show" })).toBe(JSON.stringify({ mode: "show" }, null, 2))
    expect(await tool.execute({ action: "set", key: "search.top_k", value: "25" })).toBe(JSON.stringify({ key: "search.top_k", value: "25" }, null, 2))
    expect(await tool.execute({ action: "provider", name: "openai" })).toBe(JSON.stringify({ provider: "openai" }, null, 2))
    expect(await tool.execute({ action: "reset", section: "hooks" })).toBe(JSON.stringify({ section: "hooks" }, null, 2))
    expect(await tool.execute({ action: "provider" })).toBe(JSON.stringify({ provider: "default" }, null, 2))
    expect(await tool.execute({ action: "reset" })).toBe(JSON.stringify({ section: "all" }, null, 2))
    expect(await tool.execute({ action: "invalid" } as never)).toBe(JSON.stringify({ error: "Unknown action: invalid" }, null, 2))
    expect(calls).toEqual([
      ["show"],
      ["set", "search.top_k", "25"],
      ["provider", "openai"],
      ["reset", "hooks"],
      ["provider", undefined],
      ["reset", undefined],
    ])
  })

  test("executes status and indexing wrappers", async () => {
    const indexTool = createBeaconIndexTool({
      async getIndexOverview() {
        return { files: 12 }
      },
    })
    const indexStatusTool = createBeaconIndexStatusTool({
      async getIndexStatus() {
        return { healthy: true }
      },
    })
    const reindexTool = createBeaconReindexTool({
      async reindex() {
        return "reindexed"
      },
    })
    const runIndexerTool = createBeaconRunIndexerTool({
      async runIndexer() {
        return "started"
      },
    })
    const terminateIndexerTool = createBeaconTerminateIndexerTool({
      async terminateIndexer() {
        return { status: "terminated", pid: 123, message: "done" }
      },
    })

    expect(await indexTool.execute({})).toBe(JSON.stringify({ files: 12 }, null, 2))
    expect(await indexStatusTool.execute({})).toBe(JSON.stringify({ healthy: true }, null, 2))
    expect(await reindexTool.execute({})).toBe("reindexed")
    expect(await runIndexerTool.execute({})).toBe("started")
    expect(await terminateIndexerTool.execute({})).toBe(JSON.stringify({ status: "terminated", pid: 123, message: "done" }, null, 2))
  })
})
