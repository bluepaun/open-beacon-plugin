import type { CreatedHooks } from "../create-hooks"
import type { ToolExecuteBeforeOutput, ToolExecuteInput } from "./types"

export function createToolExecuteBeforeHandler(hooks: CreatedHooks) {
  return async (input: ToolExecuteInput, output: ToolExecuteBeforeOutput): Promise<void> => {
    await hooks.onToolExecuteBefore?.(input, output)
  }
}
