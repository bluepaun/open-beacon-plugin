import type { ToolDefinition } from "../plugin/types"
import { toToolOutput } from "../shared/tool-output"

type StatusServiceLike = {
  getIndexOverview: () => Promise<unknown>
}

export function createBeaconIndexTool(statusService: StatusServiceLike): ToolDefinition {
  return {
    description: "Render the Beacon index overview",
    args: {},
    async execute() {
      return toToolOutput(await statusService.getIndexOverview())
    },
  }
}
