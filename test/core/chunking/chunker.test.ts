import { describe, expect, test } from "bun:test"
import { chunkCode } from "../../../src/core/chunking/chunker"
import { OPEN_BEACON_DEFAULT_CONFIG } from "../../../src/config/defaults"

describe("Chunker", () => {
  test("chunks code by syntax for known extensions", () => {
    const code = `
export function first() {
  console.log("first")
}

export function second() {
  console.log("second")
}
    `
    const chunks = chunkCode(code, "test.ts", {
      ...OPEN_BEACON_DEFAULT_CONFIG,
      chunking: {
        ...OPEN_BEACON_DEFAULT_CONFIG.chunking,
        strategy: "syntax",
      },
    })

    expect(chunks.length).toBe(2)
    expect(chunks[0].text).toContain("first")
    expect(chunks[1].text).toContain("second")
  })

  test("falls back to fixed chunking if syntax chunking fails or yields 1 chunk", () => {
    const code = `
const a = 1;
const b = 2;
const c = 3;
    `
    // Using a tiny max_tokens to force it to split
    const chunks = chunkCode(code, "test.ts", {
      ...OPEN_BEACON_DEFAULT_CONFIG,
      chunking: {
        ...OPEN_BEACON_DEFAULT_CONFIG.chunking,
        strategy: "syntax",
        max_tokens: 2,
        overlap_tokens: 1,
      },
    })

    expect(chunks.length).toBeGreaterThan(0)
  })

  test("uses fixed chunking if strategy is fixed", () => {
    const code = `
function first() { return 1; }
function second() { return 2; }
    `
    const chunks = chunkCode(code, "test.ts", {
      ...OPEN_BEACON_DEFAULT_CONFIG,
      chunking: {
        ...OPEN_BEACON_DEFAULT_CONFIG.chunking,
        strategy: "fixed",
        max_tokens: 5,
        overlap_tokens: 2,
      },
    })

    expect(chunks.length).toBeGreaterThan(0)
    expect(chunks[0].text).toBeDefined()
  })

  test("handles empty or very small files", () => {
    const chunks = chunkCode("let x = 1;", "test.js", OPEN_BEACON_DEFAULT_CONFIG)
    expect(chunks.length).toBe(1)
    expect(chunks[0].text).toBe("let x = 1;")
  })
})
