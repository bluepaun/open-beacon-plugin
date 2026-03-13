import type { ToolDefinition } from "../plugin/types"
import { toToolOutput } from "../shared/tool-output"

type IndexingServiceLike = {
  runIndexer: () => Promise<string>
}

export function createBeaconRunIndexerTool(indexingService: IndexingServiceLike): ToolDefinition {
  return {
    description: "Force-run Beacon indexing for the current project",
    args: {},
    async execute() {
      return toToolOutput(await indexingService.runIndexer())
    },
  }
}
