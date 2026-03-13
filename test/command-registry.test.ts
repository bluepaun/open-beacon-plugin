import { describe, expect, test } from "bun:test"

import { loadBundledCommands } from "../src/plugin/command-registry"

describe("loadBundledCommands", () => {
  test("#when bundled command templates are loaded #then markdown commands become OpenCode command config", () => {
    const commands = loadBundledCommands()

    expect(commands["search-code"]).toMatchObject({
      description: "Hybrid code search using Open Beacon",
      agent: "build",
    })
    expect(commands["search-code"]?.template).toContain("Use the `beacon_search` tool")
    expect(commands["index-status"]).toMatchObject({
      description: "Show Open Beacon index status",
      agent: "build",
    })
  })
})
