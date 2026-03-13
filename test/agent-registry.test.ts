import { describe, expect, test } from "bun:test"

import { loadBundledAgents } from "../src/plugin/agent-registry"

describe("loadBundledAgents", () => {
  test("#when bundled agent templates are loaded #then markdown agents become OpenCode agent config", () => {
    const agents = loadBundledAgents()

    expect(agents["code-explorer"]).toMatchObject({
      description: "Explore a codebase using Open Beacon semantic search first, then direct file reads for confirmation.",
      mode: "subagent",
      tools: {
        bash: false,
      },
    })
    expect(agents["code-explorer"]?.prompt).toContain("Start with `beacon_search`")
  })
})
