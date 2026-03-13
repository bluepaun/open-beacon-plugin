import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs"
import path from "node:path"

import { OPEN_BEACON_DEFAULT_CONFIG } from "../../config/defaults"
import { OPEN_BEACON_PROVIDERS } from "../../config/providers"
import type { OpenBeaconConfig, OpenBeaconConfigInput } from "../../config/schema"
import { mergeConfigs } from "../../config/merge-config"

function getNestedValue(target: Record<string, unknown>, dotPath: string): unknown {
  return dotPath.split(".").reduce<unknown>((current, key) => {
    if (!current || typeof current !== "object") {
      return undefined
    }
    return (current as Record<string, unknown>)[key]
  }, target)
}

function setNestedValue(target: Record<string, unknown>, dotPath: string, value: unknown): void {
  const keys = dotPath.split(".")
  let current = target
  for (let index = 0; index < keys.length - 1; index += 1) {
    const key = keys[index]
    if (!current[key] || typeof current[key] !== "object") {
      current[key] = {}
    }
    current = current[key] as Record<string, unknown>
  }
  current[keys[keys.length - 1]] = value
}

function deleteNestedValue(target: Record<string, unknown>, dotPath: string): void {
  const keys = dotPath.split(".")
  let current = target
  for (let index = 0; index < keys.length - 1; index += 1) {
    const next = current[keys[index]]
    if (!next || typeof next !== "object") {
      return
    }
    current = next as Record<string, unknown>
  }
  delete current[keys[keys.length - 1]]
}

function flattenConfig(target: Record<string, unknown>, prefix = ""): Array<{ key: string; value: unknown }> {
  const rows: Array<{ key: string; value: unknown }> = []
  for (const [key, value] of Object.entries(target)) {
    const fullKey = prefix ? `${prefix}.${key}` : key
    if (value && typeof value === "object" && !Array.isArray(value)) {
      rows.push(...flattenConfig(value as Record<string, unknown>, fullKey))
      continue
    }
    rows.push({ key: fullKey, value })
  }
  return rows
}

function parseValue(rawValue: string, defaultValue: unknown): unknown {
  if (typeof defaultValue === "number") {
    const value = Number(rawValue)
    if (Number.isNaN(value)) {
      throw new Error(`Expected a number, got \"${rawValue}\"`)
    }
    return value
  }
  if (typeof defaultValue === "boolean") {
    if (rawValue === "true") return true
    if (rawValue === "false") return false
    throw new Error(`Expected true/false, got \"${rawValue}\"`)
  }
  if (Array.isArray(defaultValue)) {
    if (rawValue.startsWith("[")) {
      return JSON.parse(rawValue)
    }
    return rawValue.split(",").map((part) => part.trim()).filter(Boolean)
  }
  return rawValue
}

export class ConfigService {
  private readonly projectConfigPath: string

  constructor(
    private readonly directory: string,
    private readonly effectiveConfig: OpenBeaconConfig,
  ) {
    this.projectConfigPath = path.join(directory, ".opencode", "open-beacon.json")
  }

  getEffectiveConfig(): OpenBeaconConfig {
    return this.effectiveConfig
  }

  show(): unknown {
    const userConfig = this.loadProjectConfig()
    const merged = mergeConfigs(OPEN_BEACON_DEFAULT_CONFIG, userConfig) as OpenBeaconConfig
    const userKeys = new Set(flattenConfig(userConfig as Record<string, unknown>).map((row) => row.key))
    return {
      settings: flattenConfig(OPEN_BEACON_DEFAULT_CONFIG as unknown as Record<string, unknown>).map(({ key }) => ({
        key,
        value: getNestedValue(merged as unknown as Record<string, unknown>, key),
        source: userKeys.has(key) ? "user" : "default",
      })),
      active_provider: this.detectProvider(merged),
      available_providers: Object.entries(OPEN_BEACON_PROVIDERS).map(([name, preset]) => ({ name, description: preset.description })),
      override_file: this.projectConfigPath,
      override_exists: existsSync(this.projectConfigPath),
    }
  }

  set(dotPath: string, rawValue: string): unknown {
    const defaultValue = getNestedValue(OPEN_BEACON_DEFAULT_CONFIG as unknown as Record<string, unknown>, dotPath)
    if (defaultValue === undefined) {
      return {
        error: `Unknown config key: \"${dotPath}\"`,
        valid_keys: flattenConfig(OPEN_BEACON_DEFAULT_CONFIG as unknown as Record<string, unknown>).map((row) => row.key),
      }
    }

    const userConfig = this.loadProjectConfig() as Record<string, unknown>
    const mergedBefore = mergeConfigs(OPEN_BEACON_DEFAULT_CONFIG, userConfig as OpenBeaconConfigInput) as OpenBeaconConfig
    const parsedValue = parseValue(rawValue, defaultValue)
    setNestedValue(userConfig, dotPath, parsedValue)
    this.saveProjectConfig(userConfig)
    const mergedAfter = mergeConfigs(OPEN_BEACON_DEFAULT_CONFIG, userConfig as OpenBeaconConfigInput) as OpenBeaconConfig
    return {
      action: "set",
      key: dotPath,
      old_value: getNestedValue(mergedBefore as unknown as Record<string, unknown>, dotPath),
      new_value: parsedValue,
      dimensions_changed: mergedBefore.embedding.dimensions !== mergedAfter.embedding.dimensions,
      old_dimensions: mergedBefore.embedding.dimensions,
      new_dimensions: mergedAfter.embedding.dimensions,
    }
  }

  provider(name?: string): unknown {
    if (!name) {
      return {
        action: "list_providers",
        providers: Object.entries(OPEN_BEACON_PROVIDERS).map(([providerName, preset]) => ({
          name: providerName,
          description: preset.description,
          model: preset.embedding.model,
          dimensions: preset.embedding.dimensions,
        })),
      }
    }

    const preset = OPEN_BEACON_PROVIDERS[name as keyof typeof OPEN_BEACON_PROVIDERS]
    if (!preset) {
      return {
        error: `Unknown provider: \"${name}\"`,
        available_providers: Object.keys(OPEN_BEACON_PROVIDERS),
      }
    }

    const userConfig = this.loadProjectConfig()
    const mergedBefore = mergeConfigs(OPEN_BEACON_DEFAULT_CONFIG, userConfig) as OpenBeaconConfig
    userConfig.embedding = { ...preset.embedding }
    this.saveProjectConfig(userConfig)
    return {
      action: "provider",
      provider: name,
      description: preset.description,
      applied_settings: preset.embedding,
      dimensions_changed: mergedBefore.embedding.dimensions !== preset.embedding.dimensions,
      old_dimensions: mergedBefore.embedding.dimensions,
      new_dimensions: preset.embedding.dimensions,
    }
  }

  reset(section?: string): unknown {
    const userConfig = this.loadProjectConfig() as Record<string, unknown>
    const mergedBefore = mergeConfigs(OPEN_BEACON_DEFAULT_CONFIG, userConfig as OpenBeaconConfigInput) as OpenBeaconConfig
    if (section) {
      deleteNestedValue(userConfig, section)
    } else {
      for (const key of Object.keys(userConfig)) {
        delete userConfig[key]
      }
    }
    this.saveProjectConfig(userConfig)
    const mergedAfter = mergeConfigs(OPEN_BEACON_DEFAULT_CONFIG, userConfig as OpenBeaconConfigInput) as OpenBeaconConfig
    return {
      action: "reset",
      section: section ?? "all",
      dimensions_changed: mergedBefore.embedding.dimensions !== mergedAfter.embedding.dimensions,
      old_dimensions: mergedBefore.embedding.dimensions,
      new_dimensions: mergedAfter.embedding.dimensions,
    }
  }

  private loadProjectConfig(): OpenBeaconConfigInput {
    if (!existsSync(this.projectConfigPath)) {
      return {}
    }
    return JSON.parse(readFileSync(this.projectConfigPath, "utf8")) as OpenBeaconConfigInput
  }

  private saveProjectConfig(config: Record<string, unknown>): void {
    mkdirSync(path.dirname(this.projectConfigPath), { recursive: true })
    writeFileSync(this.projectConfigPath, `${JSON.stringify(config, null, 2)}\n`)
  }

  private detectProvider(config: OpenBeaconConfig): string {
    for (const [name, preset] of Object.entries(OPEN_BEACON_PROVIDERS)) {
      if (
        config.embedding.api_base === preset.embedding.api_base
        && config.embedding.model === preset.embedding.model
        && config.embedding.dimensions === preset.embedding.dimensions
      ) {
        return name
      }
    }

    return "custom"
  }
}
