import type { ToolDefinition } from "../plugin/types"
import { toToolOutput } from "../shared/tool-output"

type IndexingServiceLike = {
  terminateIndexer: () => Promise<{ status: string; pid?: number; message: string }>
}

export function createBeaconTerminateIndexerTool(indexingService: IndexingServiceLike): ToolDefinition {
  return {
    description: "Kill a running Open Beacon sync process and clean up state",
    args: {},
    async execute() {
      return toToolOutput(await indexingService.terminateIndexer())
    },
  }
}
