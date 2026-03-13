import fs from "node:fs"
import path from "node:path"

import { OPEN_BEACON_DEFAULT_CONFIG } from "./config/defaults"
import { mergeConfigs } from "./config/merge-config"
import {
  OpenBeaconConfigSchema,
  type OpenBeaconConfig,
  type OpenBeaconConfigInput,
} from "./config/schema"
import { parseJsonc } from "./shared/jsonc"
import { log } from "./shared/logger"
import { getUserOpenCodeConfigDir } from "./shared/paths"

type FileSystemLike = Pick<typeof fs, "existsSync" | "readFileSync">

type LoadPluginConfigOptions = {
  fs?: FileSystemLike
  homeDir?: string
}

function normalizeLegacyConfig(config: OpenBeaconConfigInput): OpenBeaconConfigInput {
  return config
}

function readConfigFile(
  fileSystem: FileSystemLike,
  filePath: string,
): OpenBeaconConfigInput {
  if (!fileSystem.existsSync(filePath)) {
    return {}
  }

  const content = fileSystem.readFileSync(filePath, "utf8")
  return parseJsonc<OpenBeaconConfigInput>(content)
}

function detectConfigFile(fileSystem: FileSystemLike, basePath: string): string | null {
  const candidates = [`${basePath}.jsonc`, `${basePath}.json`]

  for (const candidate of candidates) {
    if (fileSystem.existsSync(candidate)) {
      return candidate
    }
  }

  return null
}

export function loadPluginConfig(
  directory: string,
  options: LoadPluginConfigOptions = {},
): OpenBeaconConfig {
  const fileSystem = options.fs ?? fs
  const homeDir = options.homeDir ?? process.env.HOME ?? ""
  const globalConfigDir = getUserOpenCodeConfigDir(homeDir)

  const globalConfigPath = detectConfigFile(fileSystem, path.join(globalConfigDir, "open-beacon"))
  const projectConfigPath = detectConfigFile(fileSystem, path.join(directory, ".opencode", "open-beacon"))
  const legacyConfigPath = path.join(directory, ".claude", "beacon.json")

  let merged: OpenBeaconConfigInput = OPEN_BEACON_DEFAULT_CONFIG

  if (globalConfigPath) {
    merged = mergeConfigs(merged, normalizeLegacyConfig(readConfigFile(fileSystem, globalConfigPath)))
  }

  if (merged.compat?.claude_config_fallback !== false && fileSystem.existsSync(legacyConfigPath)) {
    merged = mergeConfigs(merged, normalizeLegacyConfig(readConfigFile(fileSystem, legacyConfigPath)))
  }

  if (projectConfigPath) {
    merged = mergeConfigs(merged, normalizeLegacyConfig(readConfigFile(fileSystem, projectConfigPath)))
  }

  if (
    merged.compat?.claude_storage_fallback !== false &&
    merged.storage?.path === OPEN_BEACON_DEFAULT_CONFIG.storage.path &&
    fileSystem.existsSync(legacyConfigPath)
  ) {
    merged = mergeConfigs(merged, {
      storage: {
        path: ".claude/.beacon",
      },
    })
  }

  const parsed = OpenBeaconConfigSchema.parse(merged)
  log("loaded config", { directory, embeddingModel: parsed.embedding.model })
  return parsed
}
