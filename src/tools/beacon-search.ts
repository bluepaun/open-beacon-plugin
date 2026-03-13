import { z } from "zod"

import type { ToolDefinition } from "../plugin/types"
import { toToolOutput } from "../shared/tool-output"

type SearchServiceLike = {
  search: (args: {
    query: string
    topK?: number
    threshold?: number
    path?: string
    hybrid?: boolean
  }) => Promise<unknown>
}

export function createBeaconSearchTool(searchService: SearchServiceLike): ToolDefinition {
  return {
    description: "Semantic Beacon search across the current codebase",
    args: {
      query: z.string(),
      topK: z.number().int().positive().optional(),
      threshold: z.number().min(0).max(1).optional(),
      path: z.string().optional(),
      hybrid: z.boolean().optional(),
    },
    async execute(args) {
      return toToolOutput(await searchService.search({
        query: String(args.query),
        topK: typeof args.topK === "number" ? args.topK : undefined,
        threshold: typeof args.threshold === "number" ? args.threshold : undefined,
        path: typeof args.path === "string" ? args.path : undefined,
        hybrid: typeof args.hybrid === "boolean" ? args.hybrid : undefined,
      }))
    },
  }
}
