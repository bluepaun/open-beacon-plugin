import type { ToolDefinition } from "../plugin/types"

type IndexingServiceLike = {
  reindex: () => Promise<string>
}

export function createBeaconReindexTool(indexingService: IndexingServiceLike): ToolDefinition {
  return {
    description: "Delete Beacon embeddings and rebuild the index",
    args: {},
    async execute() {
      return await indexingService.reindex()
    },
  }
}
