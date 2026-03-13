import type { ToolDefinition } from "../plugin/types"
import { toToolOutput } from "../shared/tool-output"

type IndexingServiceLike = {
  reindex: () => Promise<string>
}

export function createBeaconReindexTool(indexingService: IndexingServiceLike): ToolDefinition {
  return {
    description: "Delete Beacon embeddings and rebuild the index",
    args: {},
    async execute() {
      return toToolOutput(await indexingService.reindex())
    },
  }
}
