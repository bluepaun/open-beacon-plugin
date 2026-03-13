import { createHooks } from "./create-hooks"
import { createManagers } from "./create-managers"
import { createTools } from "./create-tools"
import { createPluginInterface } from "./plugin-interface"
import { loadPluginConfig } from "./plugin-config"
import type { PluginContext } from "./plugin/types"

export const OpenBeaconPlugin = async (ctx: PluginContext) => {
  const pluginConfig = loadPluginConfig(ctx.directory)
  const disabledHooks = new Set(pluginConfig.disabled_hooks)

  const managers = createManagers({
    ctx,
    pluginConfig,
  })

  const hooks = createHooks({
    directory: ctx.directory,
    pluginConfig,
    managers,
    isHookEnabled: (hookName) => !disabledHooks.has(hookName),
  })

  const tools = createTools({
    pluginConfig,
    managers,
  })

  return createPluginInterface({
    hooks,
    tools: tools.tools,
  })
}

export default OpenBeaconPlugin

export type { OpenBeaconConfig, HookName } from "./config/schema"
