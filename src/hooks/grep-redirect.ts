import path from "node:path"

import type { OpenBeaconConfig } from "../config/schema"
import { BeaconDatabase } from "../core/storage/db"
import { getRepoRoot } from "../core/repo/repo-root"
import type { ToolExecuteBeforeOutput } from "../plugin/types"
import { shouldRedirectGrep } from "../shared/grep-heuristics"

type GrepRedirectHookArgs = {
  directory: string
  pluginConfig: OpenBeaconConfig
}

type GrepToolInput = {
  tool: string
  args?: Record<string, unknown>
}

export function createGrepRedirectHook(args: GrepRedirectHookArgs) {
  return async (
    input: GrepToolInput,
    output: ToolExecuteBeforeOutput,
  ): Promise<void> => {
    if (input.tool !== "grep" || args.pluginConfig.intercept.enabled === false) {
      return
    }

    const pattern = typeof input.args?.pattern === "string" ? input.args.pattern : ""
    const searchPath = typeof input.args?.path === "string" ? input.args.path : undefined
    const outputMode = typeof input.args?.output_mode === "string" ? input.args.output_mode : undefined

    const redirect = shouldRedirectGrep({
      pattern,
      path: searchPath,
      outputMode,
      minPatternLength: args.pluginConfig.intercept.min_pattern_length,
    })

    if (!redirect || !isBeaconHealthy(args.directory, args.pluginConfig)) {
      return
    }

    output.blocked = true
    output.message = "Beacon can handle this query better. Use `beacon_search` first, then grep inside matched files if needed."
    output.metadata = {
      ...(output.metadata ?? {}),
      beacon_redirect: {
        pattern,
        suggested_tool: "beacon_search",
      },
    }
  }
}

function isBeaconHealthy(directory: string, config: OpenBeaconConfig): boolean {
  const repoRoot = getRepoRoot(directory)
  const dbPath = path.join(repoRoot, config.storage.path, "embeddings.db")
  return BeaconDatabase.healthCheck(dbPath, config.embedding.dimensions).ok
}
