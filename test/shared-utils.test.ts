import { describe, expect, test } from "bun:test"

import { log } from "../src/shared/logger"
import { getUserOpenCodeConfigDir, resolveFromProject, resolveHomePath } from "../src/shared/paths"

describe("shared utils", () => {
  describe("paths", () => {
    test("resolves project-relative and absolute paths", () => {
      expect(resolveFromProject("/repo/project", "src/index.ts")).toBe("/repo/project/src/index.ts")
      expect(resolveFromProject("/repo/project", "/tmp/file.ts")).toBe("/tmp/file.ts")
    })

    test("expands home-prefixed paths and returns config dir", () => {
      expect(resolveHomePath("/Users/tester", "~/config.json")).toBe("/Users/tester/config.json")
      expect(resolveHomePath("/Users/tester", ".opencode/open-beacon.json")).toBe(".opencode/open-beacon.json")
      expect(getUserOpenCodeConfigDir("/Users/tester")).toBe("/Users/tester/.config/opencode")
    })
  })

  describe("logger", () => {
    test("logs only when debug mode is enabled", () => {
      const previous = process.env.OPEN_BEACON_DEBUG
      const calls: unknown[][] = []
      const originalLog = console.log

      console.log = (...args: unknown[]) => {
        calls.push(args)
      }

      try {
        delete process.env.OPEN_BEACON_DEBUG
        log("hidden")

        process.env.OPEN_BEACON_DEBUG = "1"
        log("visible")
        log("visible with extra", { scope: "test" })
      } finally {
        console.log = originalLog
        if (previous === undefined) {
          delete process.env.OPEN_BEACON_DEBUG
        } else {
          process.env.OPEN_BEACON_DEBUG = previous
        }
      }

      expect(calls).toEqual([
        ["[open-beacon]", "visible"],
        ["[open-beacon]", "visible with extra", { scope: "test" }],
      ])
    })
  })
})
