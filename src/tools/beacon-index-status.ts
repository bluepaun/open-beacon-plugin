import type { ToolDefinition } from "../plugin/types"

type StatusServiceLike = {
  getIndexStatus: () => Promise<unknown>
}

export function createBeaconIndexStatusTool(statusService: StatusServiceLike): ToolDefinition {
  return {
    description: "Return Beacon index health and sync metadata",
    args: {},
    async execute() {
      return await statusService.getIndexStatus()
    },
  }
}
