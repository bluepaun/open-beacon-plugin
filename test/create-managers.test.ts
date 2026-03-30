import { describe, expect, test } from "bun:test"
import { createManagers } from "../src/create-managers"
import { OPEN_BEACON_DEFAULT_CONFIG } from "../src/config/defaults"
import path from "node:path"

describe("createManagers", () => {
  test("creates and returns all expected services", () => {
    const managers = createManagers({
      ctx: { directory: "/test/dir" },
      pluginConfig: OPEN_BEACON_DEFAULT_CONFIG,
      homeDir: "/fake/home",
    })

    expect(managers.searchService).toBeDefined()
    expect(managers.indexingService).toBeDefined()
    expect(managers.statusService).toBeDefined()
    expect(managers.configService).toBeDefined()
    expect(managers.safetyService).toBeDefined()
    expect(managers.safetyConfigPath).toBe(path.join("/fake/home", ".config/opencode/open-beacon-global.json"))
  })
})
