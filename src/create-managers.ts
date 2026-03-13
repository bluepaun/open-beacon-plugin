import os from "node:os"

import type { OpenBeaconConfig } from "./config/schema"
import { ConfigService } from "./core/config/config-service"
import { IndexingService } from "./core/indexing/indexing-service"
import { SearchService } from "./core/search/search-service"
import { SafetyService } from "./core/safety/safety-service"
import { getSafetyConfigPath } from "./core/safety/safety"
import { StatusService } from "./core/status/status-service"
import type { PluginContext } from "./plugin/types"

export type SearchServiceLike = Pick<SearchService, "search">
export type IndexingServiceLike = Pick<
  IndexingService,
  "autoSync" | "runIndexer" | "reembedFile" | "collectGarbage" | "reindex" | "terminateIndexer"
>
export type StatusServiceLike = Pick<
  StatusService,
  "getIndexOverview" | "getIndexStatus" | "getCompactStatus"
>
export type ConfigServiceLike = Pick<ConfigService, "getEffectiveConfig" | "show" | "set" | "provider" | "reset">
export type SafetyServiceLike = Pick<
  SafetyService,
  | "showBlacklist"
  | "addBlacklist"
  | "removeBlacklist"
  | "resetBlacklist"
  | "showWhitelist"
  | "addWhitelist"
  | "removeWhitelist"
  | "clearWhitelist"
  | "isWhitelisted"
>

export type Managers = {
  searchService: SearchServiceLike
  indexingService: IndexingServiceLike
  statusService: StatusServiceLike
  configService: ConfigServiceLike
  safetyService: SafetyServiceLike
  safetyConfigPath: string
}

export function createManagers(args: {
  ctx: Pick<PluginContext, "directory">
  pluginConfig: OpenBeaconConfig
  homeDir?: string
}): Managers {
  const safetyConfigPath = getSafetyConfigPath(args.pluginConfig, args.homeDir ?? os.homedir())

  return {
    searchService: new SearchService(args.ctx.directory, args.pluginConfig),
    indexingService: new IndexingService(args.ctx.directory, args.pluginConfig, safetyConfigPath),
    statusService: new StatusService(args.ctx.directory, args.pluginConfig),
    configService: new ConfigService(args.ctx.directory, args.pluginConfig),
    safetyService: new SafetyService(safetyConfigPath),
    safetyConfigPath,
  }
}
