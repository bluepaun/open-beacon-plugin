import type { ToolDefinition } from "../plugin/types"

type IndexingServiceLike = {
  runIndexer: () => Promise<string>
}

export function createBeaconRunIndexerTool(indexingService: IndexingServiceLike): ToolDefinition {
  return {
    description: "Force-run Beacon indexing for the current project",
    args: {},
    async execute() {
      return await indexingService.runIndexer()
    },
  }
}
