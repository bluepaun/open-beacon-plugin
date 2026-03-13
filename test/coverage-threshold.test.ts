import { describe, expect, test } from "bun:test"

import { extractOverallCoverage, isCoverageAtLeast } from "../src/shared/coverage-threshold"

describe("coverage threshold helpers", () => {
  test("extracts overall line and function coverage from bun output", () => {
    const summary = extractOverallCoverage(`
---------------------------------------|---------|---------|-------------------
File                                   | % Funcs | % Lines | Uncovered Line #s
---------------------------------------|---------|---------|-------------------
All files                              |   96.68 |   95.38 |
 src/index.ts                          |  100.00 |  100.00 |
---------------------------------------|---------|---------|-------------------
`)

    expect(summary).toEqual({ functions: 96.68, lines: 95.38 })
  })

  test("returns null when the overall coverage row is missing", () => {
    expect(extractOverallCoverage("no coverage table here")).toBeNull()
  })

  test("checks line and function thresholds together", () => {
    expect(isCoverageAtLeast({ functions: 95, lines: 94 }, 90)).toBe(true)
    expect(isCoverageAtLeast({ functions: 89.99, lines: 94 }, 90)).toBe(false)
    expect(isCoverageAtLeast({ functions: 95, lines: 89.99 }, 90)).toBe(false)
  })
})
