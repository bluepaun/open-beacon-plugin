import type { HookName, OpenBeaconConfig } from "./config/schema"
import type { Managers } from "./create-managers"
import { createAutoSyncHook } from "./hooks/auto-sync"
import { createGcAfterBashHook } from "./hooks/gc-after-bash"
import { createGrepRedirectHook } from "./hooks/grep-redirect"
import { createInjectIndexStatusHook } from "./hooks/inject-index-status"
import { createReembedFileHook } from "./hooks/reembed-file"
import type { SessionCompactingOutput, ToolExecuteBeforeOutput } from "./plugin/types"

export type CreatedHooks = ReturnType<typeof createHooks>

export function createHooks(args: {
  directory?: string
  pluginConfig: OpenBeaconConfig
  managers: Managers
  isHookEnabled?: (hookName: HookName) => boolean
}) {
  const isHookEnabled = args.isHookEnabled ?? (() => true)

  return {
    onSessionCreated: isHookEnabled("auto-sync") && args.pluginConfig.hooks.auto_sync
      ? createAutoSyncHook(args.managers.indexingService)
      : undefined,
    onFileEdited: isHookEnabled("reembed-file") && args.pluginConfig.hooks.reembed_on_edit
      ? createReembedFileHook(args.managers.indexingService)
      : undefined,
    onToolExecuteBefore: isHookEnabled("grep-redirect") && args.pluginConfig.hooks.grep_redirect
      ? async (input: { tool: string; args?: Record<string, unknown> }, output: ToolExecuteBeforeOutput) => {
          await createGrepRedirectHook({ directory: args.directory ?? process.cwd(), pluginConfig: args.pluginConfig })(input, output)
        }
      : undefined,
    onToolExecuteAfter: isHookEnabled("gc-after-bash") && args.pluginConfig.hooks.gc_after_bash
      ? async (input: { tool: string }) => {
          if (input.tool === "bash") {
            await createGcAfterBashHook(args.managers.indexingService)()
          }
        }
      : undefined,
    onSessionCompacting: isHookEnabled("compact-status") && args.pluginConfig.hooks.compact_status
      ? async (_input: { sessionID: string }, output: SessionCompactingOutput) => {
          await createInjectIndexStatusHook(args.managers.statusService)(output)
        }
      : undefined,
  }
}
