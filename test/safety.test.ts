import { describe, expect, test } from "bun:test"
import { mkdtempSync, rmSync } from "node:fs"
import { tmpdir } from "node:os"
import path from "node:path"

import {
  getDefaultBlacklist,
  getEffectiveBlacklist,
  isPathBlacklisted,
  loadGlobalSafetyConfig,
} from "../src/core/safety/safety"

describe("safety", () => {
  test("#given no safety config file #when loading #then defaults are created", () => {
    const root = mkdtempSync(path.join(tmpdir(), "open-beacon-safety-"))
    const configPath = path.join(root, "open-beacon-global.json")

    const config = loadGlobalSafetyConfig(configPath)
    expect(config.blacklist).toEqual([])
    expect(config.whitelist).toEqual([])

    rmSync(root, { recursive: true, force: true })
  })

  test("#given a home directory #when computing defaults #then ancestors are blacklisted", () => {
    const blacklist = getDefaultBlacklist("/Users/tester")
    expect(blacklist).toContain("/")
    expect(blacklist).toContain("/Users")
    expect(blacklist).toContain("/Users/tester")
  })

  test("#given a project directory under home #when checking blacklist #then subdirectories are allowed", () => {
    const root = mkdtempSync(path.join(tmpdir(), "open-beacon-safety-"))
    const configPath = path.join(root, "open-beacon-global.json")
    loadGlobalSafetyConfig(configPath)

    expect(isPathBlacklisted("/Users/tester/project", configPath, "/Users/tester")).toBe(false)
    expect(getEffectiveBlacklist(configPath, "/Users/tester")).toContain("/Users/tester")

    rmSync(root, { recursive: true, force: true })
  })
})
