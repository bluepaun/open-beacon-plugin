import { existsSync, readFileSync, statSync } from "node:fs"
import path from "node:path"

import picomatch from "picomatch"

import type { OpenBeaconConfig } from "../../config/schema"

function loadBeaconIgnore(repoRoot: string): string[] {
  const beaconIgnorePath = path.join(repoRoot, ".beaconignore")
  if (!existsSync(beaconIgnorePath)) {
    return []
  }

  return readFileSync(beaconIgnorePath, "utf8")
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith("#"))
}

export function shouldIndex(filePath: string, config: OpenBeaconConfig, repoRoot: string): boolean {
  const normalized = filePath.replace(/\\/g, "/")
  const included = config.indexing.include.some((pattern) => picomatch.isMatch(normalized, pattern))
  if (!included) {
    return false
  }

  const excluded = config.indexing.exclude.some((pattern) => picomatch.isMatch(normalized, pattern))
  if (excluded) {
    return false
  }

  const ignored = loadBeaconIgnore(repoRoot).some((pattern) => picomatch.isMatch(normalized, pattern))
  if (ignored) {
    return false
  }

  try {
    const stats = statSync(path.join(repoRoot, filePath))
    if (stats.size > config.indexing.max_file_size_kb * 1024) {
      return false
    }
  } catch {
    return false
  }

  return true
}
