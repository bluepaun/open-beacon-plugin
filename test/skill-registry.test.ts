import { describe, expect, test } from "bun:test"

import { loadBundledSkillPaths } from "../src/plugin/skill-registry"

describe("loadBundledSkillPaths", () => {
  test("#when bundled skills are available #then returns the packaged skills directory", () => {
    const paths = loadBundledSkillPaths()

    expect(paths).toHaveLength(1)
    expect(paths[0]).toEndWith("templates/.opencode/skills")
  })
})
