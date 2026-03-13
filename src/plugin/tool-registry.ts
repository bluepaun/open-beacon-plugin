import type { OpenBeaconConfig } from "../config/schema"
import type { Managers } from "../create-managers"
import type { ToolsRecord } from "./types"
import { createBeaconBlacklistTool } from "../tools/beacon-blacklist"
import { createBeaconConfigTool } from "../tools/beacon-config"
import { createBeaconIndexTool } from "../tools/beacon-index"
import { createBeaconIndexStatusTool } from "../tools/beacon-index-status"
import { createBeaconReindexTool } from "../tools/beacon-reindex"
import { createBeaconRunIndexerTool } from "../tools/beacon-run-indexer"
import { createBeaconSearchTool } from "../tools/beacon-search"
import { createBeaconTerminateIndexerTool } from "../tools/beacon-terminate-indexer"
import { createBeaconWhitelistTool } from "../tools/beacon-whitelist"

export function createToolRegistry(args: {
  pluginConfig: OpenBeaconConfig
  managers: Managers
}): ToolsRecord {
  const registry: ToolsRecord = {
    beacon_search: createBeaconSearchTool(args.managers.searchService),
    beacon_index: createBeaconIndexTool(args.managers.statusService),
    beacon_index_status: createBeaconIndexStatusTool(args.managers.statusService),
    beacon_reindex: createBeaconReindexTool(args.managers.indexingService),
    beacon_run_indexer: createBeaconRunIndexerTool(args.managers.indexingService),
    beacon_terminate_indexer: createBeaconTerminateIndexerTool(args.managers.indexingService),
    beacon_config: createBeaconConfigTool(args.managers.configService),
    beacon_blacklist: createBeaconBlacklistTool(args.managers.safetyService),
    beacon_whitelist: createBeaconWhitelistTool(args.managers.safetyService),
  }

  const disabled = new Set(args.pluginConfig.disabled_tools)

  return Object.fromEntries(
    Object.entries(registry).filter(([name]) => !disabled.has(name)),
  )
}
