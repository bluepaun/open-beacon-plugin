import { describe, expect, test, beforeAll, afterAll } from "bun:test"
import { ConfigService } from "../../../src/core/config/config-service"
import { OPEN_BEACON_DEFAULT_CONFIG } from "../../../src/config/defaults"
import { OPEN_BEACON_PROVIDERS } from "../../../src/config/providers"
import { mkdtempSync, rmSync, mkdirSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import path from "node:path"

describe("ConfigService", () => {
  let root: string
  let service: ConfigService

  beforeAll(() => {
    root = mkdtempSync(path.join(tmpdir(), "open-beacon-config-"))
    service = new ConfigService(root, OPEN_BEACON_DEFAULT_CONFIG)
  })

  afterAll(() => {
    rmSync(root, { recursive: true, force: true })
  })

  test("getEffectiveConfig returns the config passed in", () => {
    expect(service.getEffectiveConfig()).toBe(OPEN_BEACON_DEFAULT_CONFIG)
  })

  test("show() returns current config info without overrides", () => {
    const result = service.show() as any
    expect(result.settings).toBeDefined()
    expect(result.active_provider).toBe("ollama") // ollama is the default in defaults.ts
    expect(result.override_exists).toBe(false)
  })

  test("set() creates an override and updates the config", () => {
    const result = service.set("chunking.max_tokens", "500") as any
    expect(result.action).toBe("set")
    expect(result.new_value).toBe(500)
    expect(result.dimensions_changed).toBe(false)

    // Now show should indicate override exists and source is user
    const showResult = service.show() as any
    expect(showResult.override_exists).toBe(true)
    
    const chunkingMaxTokens = showResult.settings.find((s: any) => s.key === "chunking.max_tokens")
    expect(chunkingMaxTokens.value).toBe(500)
    expect(chunkingMaxTokens.source).toBe("user")
  })

  test("set() throws on invalid boolean", () => {
    expect(() => service.set("embedding.batch_size", "not-a-number")).toThrow()
  })

  test("set() returns error on unknown key", () => {
    const result = service.set("unknown.key", "value") as any
    expect(result.error).toBeDefined()
    expect(result.valid_keys).toBeDefined()
  })

  test("provider() without name lists providers", () => {
    const result = service.provider() as any
    expect(result.action).toBe("list_providers")
    expect(result.providers.length).toBeGreaterThan(0)
  })

  test("provider() with unknown name returns error", () => {
    const result = service.provider("unknown") as any
    expect(result.error).toBeDefined()
  })

  test("provider() with valid name sets provider settings", () => {
    // Assuming 'openai' is a valid provider in OPEN_BEACON_PROVIDERS
    const openaiProvider = OPEN_BEACON_PROVIDERS["openai"]
    if (!openaiProvider) {
      console.warn("Skipping openai provider test since it doesn't exist in providers.ts")
      return
    }
    
    const result = service.provider("openai") as any
    expect(result.action).toBe("provider")
    expect(result.provider).toBe("openai")
    
    // Check if it's considered dimensions change
    if (openaiProvider.embedding.dimensions !== OPEN_BEACON_DEFAULT_CONFIG.embedding.dimensions) {
      expect(result.dimensions_changed).toBe(true)
    }

    const showResult = service.show() as any
    expect(showResult.active_provider).toBe("openai")
  })

  test("reset() clears a specific section", () => {
    service.set("indexing.max_file_size_kb", "999")
    let showResult = service.show() as any
    expect(showResult.settings.find((s: any) => s.key === "indexing.max_file_size_kb").value).toBe(999)

    const result = service.reset("indexing") as any
    expect(result.action).toBe("reset")
    expect(result.section).toBe("indexing")

    showResult = service.show() as any
    expect(showResult.settings.find((s: any) => s.key === "indexing.max_file_size_kb").source).toBe("default")
  })

  test("reset() clears all overrides if no section provided", () => {
    service.set("chunking.overlap_tokens", "10")
    service.set("embedding.batch_size", "20")
    
    const result = service.reset() as any
    expect(result.action).toBe("reset")
    expect(result.section).toBe("all")

    const showResult = service.show() as any
    expect(showResult.settings.find((s: any) => s.key === "chunking.overlap_tokens").source).toBe("default")
    expect(showResult.settings.find((s: any) => s.key === "embedding.batch_size").source).toBe("default")
  })
})
