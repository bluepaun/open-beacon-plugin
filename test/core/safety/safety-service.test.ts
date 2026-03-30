import { describe, expect, test, beforeAll, afterAll } from "bun:test"
import { SafetyService } from "../../../src/core/safety/safety-service"
import { mkdtempSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import path from "node:path"

describe("SafetyService", () => {
  let configPath: string
  let service: SafetyService
  let tempDir: string

  beforeAll(() => {
    tempDir = mkdtempSync(path.join(tmpdir(), "open-beacon-safety-"))
    configPath = path.join(tempDir, "safety.json")
    writeFileSync(configPath, "{}")
    service = new SafetyService(configPath)
  })

  afterAll(() => {
    rmSync(tempDir, { recursive: true, force: true })
  })

  test("showBlacklist returns effective and user blacklist", () => {
    const res = service.showBlacklist() as any
    expect(res.effective_blacklist).toBeDefined()
    expect(res.user_additions).toEqual([])
  })

  test("addBlacklist adds to user additions", () => {
    const res = service.addBlacklist("/test/dir") as any
    expect(res.action).toBe("added")
    expect(res.blacklist.length).toBe(1)
  })

  test("removeBlacklist removes from user additions", () => {
    const target = "/test/dir"
    service.addBlacklist(target)
    const res = service.removeBlacklist(target) as any
    expect(res.action).toBe("removed")
    expect(res.blacklist.includes(path.resolve(target))).toBe(false)
  })

  test("resetBlacklist clears user additions", () => {
    service.addBlacklist("/test/dir")
    const res = service.resetBlacklist() as any
    expect(res.action).toBe("reset")
    expect(res.blacklist.length).toBe(0)
  })

  test("showWhitelist returns current whitelist", () => {
    const res = service.showWhitelist() as any
    expect(res.whitelist).toEqual([])
  })

  test("addWhitelist adds to whitelist", () => {
    const res = service.addWhitelist("/whitelist/dir") as any
    expect(res.action).toBe("added")
    expect(res.whitelist.length).toBeGreaterThan(0)
  })

  test("removeWhitelist removes from whitelist", () => {
    const target = "/whitelist/dir"
    service.addWhitelist(target)
    const res = service.removeWhitelist(target) as any
    expect(res.action).toBe("removed")
    expect(res.whitelist.includes(path.resolve(target))).toBe(false)
  })

  test("clearWhitelist empties the whitelist", () => {
    service.addWhitelist("/test")
    const res = service.clearWhitelist() as any
    expect(res.action).toBe("cleared")
    expect(res.whitelist.length).toBe(0)
  })

  test("isWhitelisted returns true for whitelisted path", () => {
    service.addWhitelist(tempDir)
    expect(service.isWhitelisted(tempDir)).toBe(true)
  })
})
