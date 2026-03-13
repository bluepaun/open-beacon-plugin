import path from "node:path"

import {
  getEffectiveBlacklist,
  isPathWhitelisted,
  loadGlobalSafetyConfig,
  saveGlobalSafetyConfig,
} from "./safety"

export class SafetyService {
  constructor(private readonly configPath: string) {}

  showBlacklist(): unknown {
    const config = loadGlobalSafetyConfig(this.configPath)
    return {
      effective_blacklist: getEffectiveBlacklist(this.configPath),
      user_additions: config.blacklist ?? [],
      note: "Default blacklist includes all ancestor directories from / to your home directory. User additions are merged on top.",
    }
  }

  addBlacklist(targetPath: string): unknown {
    const config = loadGlobalSafetyConfig(this.configPath)
    const resolved = path.resolve(targetPath)
    config.blacklist = [...new Set([...(config.blacklist ?? []), resolved])]
    saveGlobalSafetyConfig(this.configPath, config)
    return { action: "added", path: resolved, blacklist: config.blacklist }
  }

  removeBlacklist(targetPath: string): unknown {
    const config = loadGlobalSafetyConfig(this.configPath)
    const resolved = path.resolve(targetPath)
    config.blacklist = (config.blacklist ?? []).filter((entry) => entry !== resolved)
    saveGlobalSafetyConfig(this.configPath, config)
    return { action: "removed", path: resolved, blacklist: config.blacklist }
  }

  resetBlacklist(): unknown {
    const config = loadGlobalSafetyConfig(this.configPath)
    config.blacklist = []
    saveGlobalSafetyConfig(this.configPath, config)
    return { action: "reset", blacklist: [], note: "User additions cleared. Default blacklist still applies." }
  }

  showWhitelist(): unknown {
    const config = loadGlobalSafetyConfig(this.configPath)
    return {
      whitelist: config.whitelist ?? [],
      note: "Whitelisted paths override the blacklist. Subdirectories of whitelisted paths are also allowed.",
    }
  }

  addWhitelist(targetPath: string): unknown {
    const config = loadGlobalSafetyConfig(this.configPath)
    const resolved = path.resolve(targetPath)
    config.whitelist = [...new Set([...(config.whitelist ?? []), resolved])]
    saveGlobalSafetyConfig(this.configPath, config)
    return { action: "added", path: resolved, whitelist: config.whitelist }
  }

  removeWhitelist(targetPath: string): unknown {
    const config = loadGlobalSafetyConfig(this.configPath)
    const resolved = path.resolve(targetPath)
    config.whitelist = (config.whitelist ?? []).filter((entry) => entry !== resolved)
    saveGlobalSafetyConfig(this.configPath, config)
    return { action: "removed", path: resolved, whitelist: config.whitelist }
  }

  clearWhitelist(): unknown {
    const config = loadGlobalSafetyConfig(this.configPath)
    config.whitelist = []
    saveGlobalSafetyConfig(this.configPath, config)
    return { action: "cleared", whitelist: [] }
  }

  isWhitelisted(targetPath: string): boolean {
    return isPathWhitelisted(targetPath, this.configPath)
  }
}
