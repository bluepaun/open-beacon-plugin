import type { ToolDefinition } from "../plugin/types"

type StatusServiceLike = {
  getIndexOverview: () => Promise<unknown>
}

export function createBeaconIndexTool(statusService: StatusServiceLike): ToolDefinition {
  return {
    description: "Render the Beacon index overview",
    args: {},
    async execute() {
      return await statusService.getIndexOverview()
    },
  }
}
