import type { CreatedHooks } from "../create-hooks"
import type { ToolExecuteAfterOutput, ToolExecuteInput } from "./types"

export function createToolExecuteAfterHandler(hooks: CreatedHooks) {
  return async (input: ToolExecuteInput, _output: ToolExecuteAfterOutput): Promise<void> => {
    await hooks.onToolExecuteAfter?.(input)
  }
}
