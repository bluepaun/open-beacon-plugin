import { describe, expect, test } from "bun:test"

import {
  extractIdentifiers,
  getFileTypeMultiplier,
  getIdentifierBoost,
  normalizeBM25,
  prepareFTSQuery,
  rrfScore,
} from "../src/core/chunking/tokenizer"

describe("tokenizer", () => {
  test("#given camelCase and snake_case identifiers #when extracting #then parts are preserved and expanded", () => {
    expect(extractIdentifiers("function signInWithGoogle() {}")).toContain("signInWithGoogle")
    expect(extractIdentifiers("const user_auth_token = 1")).toContain("user_auth_token")
  })

  test("#given prose only #when extracting identifiers #then empty string is returned", () => {
    expect(extractIdentifiers("the quick brown fox")).toBe("")
  })

  test("#given a natural language query #when preparing FTS #then stop words are removed and synonyms included", () => {
    const result = prepareFTSQuery("auth login")
    expect(String(result)).toContain("authentication")
    expect(String(result)).toContain("login")
  })

  test("#given BM25 scores #when normalizing #then best score becomes 1 and worst becomes 0", () => {
    const normalized = normalizeBM25([-20, -10, -1])
    expect(normalized[0]).toBeCloseTo(1)
    expect(normalized[2]).toBeCloseTo(0)
  })

  test("#given vector and FTS ranks #when fusing with RRF #then combined score is deterministic", () => {
    expect(rrfScore(1, 1, 60)).toBeCloseTo(2 / 61)
  })

  test("#given file kinds and identifier matches #when scoring #then code files and exact identifiers are favored", () => {
    expect(getFileTypeMultiplier("README.md")).toBe(0.5)
    expect(getIdentifierBoost("signInWithGoogle function", "export function signInWithGoogle() {} ")).toBe(1.5)
  })
})
