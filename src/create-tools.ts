import type { OpenBeaconConfig } from "./config/schema"
import type { Managers } from "./create-managers"
import { createToolRegistry } from "./plugin/tool-registry"
import type { ToolsRecord } from "./plugin/types"

export function createTools(args: {
  pluginConfig: OpenBeaconConfig
  managers: Managers
}): { tools: ToolsRecord } {
  return {
    tools: createToolRegistry(args),
  }
}
