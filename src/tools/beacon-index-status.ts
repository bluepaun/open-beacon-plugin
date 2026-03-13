import type { ToolDefinition } from "../plugin/types"
import { toToolOutput } from "../shared/tool-output"

type StatusServiceLike = {
  getIndexStatus: () => Promise<unknown>
}

export function createBeaconIndexStatusTool(statusService: StatusServiceLike): ToolDefinition {
  return {
    description: "Return Beacon index health and sync metadata",
    args: {},
    async execute() {
      return toToolOutput(await statusService.getIndexStatus())
    },
  }
}
