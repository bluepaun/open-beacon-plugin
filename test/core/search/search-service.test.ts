import { describe, expect, test } from "bun:test"
import { mergeAdjacentChunks } from "../../../src/core/search/search-service"

describe("mergeAdjacentChunks", () => {
  test("returns original array if 1 or 0 items", () => {
    expect(mergeAdjacentChunks([])).toEqual([])
    expect(mergeAdjacentChunks([{ file: "a", lines: "1-5", similarity: "0.5", preview: "test" }])).toEqual([{ file: "a", lines: "1-5", similarity: "0.5", preview: "test" }])
  })

  test("merges adjacent chunks in the same file", () => {
    const input = [
      { file: "a.ts", lines: "1-10", similarity: "0.800", score: "0.900", preview: "p1" },
      { file: "a.ts", lines: "11-20", similarity: "0.700", score: "0.850", preview: "p2" },
    ]
    const merged = mergeAdjacentChunks(input)
    expect(merged).toHaveLength(1)
    expect(merged[0].lines).toBe("1-20")
    expect(merged[0].similarity).toBe("0.800")
    expect(merged[0].score).toBe("0.900")
  })

  test("does not merge chunks further apart than 5 lines", () => {
    const input = [
      { file: "a.ts", lines: "1-10", similarity: "0.800", score: "0.900", preview: "p1" },
      { file: "a.ts", lines: "16-25", similarity: "0.700", score: "0.850", preview: "p2" },
    ]
    const merged = mergeAdjacentChunks(input)
    expect(merged).toHaveLength(2)
  })

  test("does not merge chunks from different files", () => {
    const input = [
      { file: "a.ts", lines: "1-10", similarity: "0.800", preview: "p1" },
      { file: "b.ts", lines: "1-10", similarity: "0.700", preview: "p2" },
    ]
    const merged = mergeAdjacentChunks(input)
    expect(merged).toHaveLength(2)
  })
})
