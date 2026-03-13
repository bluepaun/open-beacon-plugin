import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs"
import os from "node:os"
import path from "node:path"

import type { OpenBeaconConfig } from "../../config/schema"
import { resolveHomePath } from "../../shared/paths"

export type BeaconSafetyConfig = {
  blacklist: string[]
  whitelist: string[]
}

function defaultSafetyConfig(): BeaconSafetyConfig {
  return { blacklist: [], whitelist: [] }
}

export function getSafetyConfigPath(config: OpenBeaconConfig, homeDir = os.homedir()): string {
  return resolveHomePath(homeDir, config.safety.global_config_path)
}

export function loadGlobalSafetyConfig(configPath: string): BeaconSafetyConfig {
  if (!existsSync(configPath)) {
    mkdirSync(path.dirname(configPath), { recursive: true })
    const defaults = defaultSafetyConfig()
    writeFileSync(configPath, JSON.stringify(defaults, null, 2))
    return defaults
  }

  try {
    return JSON.parse(readFileSync(configPath, "utf8")) as BeaconSafetyConfig
  } catch {
    return defaultSafetyConfig()
  }
}

export function saveGlobalSafetyConfig(configPath: string, config: BeaconSafetyConfig): void {
  mkdirSync(path.dirname(configPath), { recursive: true })
  writeFileSync(configPath, JSON.stringify(config, null, 2))
}

export function getDefaultBlacklist(homeDir = os.homedir()): string[] {
  const parts = homeDir.split(path.sep).filter(Boolean)
  const ancestors: string[] = [path.sep]
  let current: string = path.sep
  for (const part of parts) {
    current = path.join(current, part)
    ancestors.push(current)
  }
  return ancestors
}

export function getEffectiveBlacklist(configPath: string, homeDir = os.homedir()): string[] {
  const defaults = getDefaultBlacklist(homeDir)
  const userEntries = loadGlobalSafetyConfig(configPath).blacklist ?? []
  return [...new Set([...defaults, ...userEntries])]
}

export function isPathWhitelisted(targetPath: string, configPath: string): boolean {
  const resolvedTarget = path.resolve(targetPath)
  const whitelist = loadGlobalSafetyConfig(configPath).whitelist ?? []
  return whitelist.some((entry) => {
    const resolved = path.resolve(entry)
    return resolvedTarget === resolved || resolvedTarget.startsWith(`${resolved}${path.sep}`)
  })
}

export function isPathBlacklisted(targetPath: string, configPath: string, homeDir = os.homedir()): boolean {
  const resolvedTarget = path.resolve(targetPath)
  if (isPathWhitelisted(resolvedTarget, configPath)) {
    return false
  }
  return getEffectiveBlacklist(configPath, homeDir).some((entry) => resolvedTarget === path.resolve(entry))
}
