import { describe, expect, test } from "bun:test"
import { OpenBeaconPlugin } from "../src/index"
import { mkdtempSync, rmSync, writeFileSync, mkdirSync } from "node:fs"
import { tmpdir } from "node:os"
import path from "node:path"

describe("OpenBeaconPlugin", () => {
  let root: string

  test("initializes successfully", async () => {
    root = mkdtempSync(path.join(tmpdir(), "open-beacon-index-"))
    
    // create fake opencode config to prevent errors
    const configDir = path.join(root, ".opencode")
    mkdirSync(configDir)
    writeFileSync(path.join(configDir, "open-beacon.json"), JSON.stringify({ disabled_hooks: [] }))

    const plugin = await OpenBeaconPlugin({ directory: root } as any)
    expect(plugin).toBeDefined()
    expect(plugin.tool).toBeDefined()
    expect(plugin["tool.execute.before"]).toBeDefined()
    expect(plugin["tool.execute.after"]).toBeDefined()
    
    rmSync(root, { recursive: true, force: true })
  })
})
