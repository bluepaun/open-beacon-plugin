import type { CreatedHooks } from "./create-hooks"
import { createEventHandler } from "./plugin/event"
import { createToolExecuteAfterHandler } from "./plugin/tool-execute-after"
import { createToolExecuteBeforeHandler } from "./plugin/tool-execute-before"
import type { ToolsRecord } from "./plugin/types"

export function createPluginInterface(args: {
  hooks: CreatedHooks
  tools: ToolsRecord
}) {
  return {
    tool: args.tools,
    event: createEventHandler(args.hooks),
    "tool.execute.before": createToolExecuteBeforeHandler(args.hooks),
    "tool.execute.after": createToolExecuteAfterHandler(args.hooks),
    "experimental.session.compacting": async (
      input: { sessionID: string },
      output: { context: string[] },
    ): Promise<void> => {
      await args.hooks.onSessionCompacting?.(input, output)
    },
  }
}
