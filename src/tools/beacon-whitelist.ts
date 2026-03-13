import { z } from "zod"

import type { ToolDefinition } from "../plugin/types"

type SafetyServiceLike = {
  showWhitelist: () => unknown
  addWhitelist: (path: string) => unknown
  removeWhitelist: (path: string) => unknown
  clearWhitelist: () => unknown
}

export function createBeaconWhitelistTool(safetyService: SafetyServiceLike): ToolDefinition {
  return {
    description: "Manage Open Beacon indexing whitelist",
    args: {
      action: z.enum(["show", "add", "remove", "clear"]).default("show"),
      path: z.string().optional(),
    },
    async execute(args, context) {
      const action = String(args.action ?? "show")
      const defaultPath = typeof args.path === "string" && args.path.length > 0
        ? args.path
        : typeof context === "object" && context && "directory" in (context as Record<string, unknown>)
          ? String((context as Record<string, unknown>).directory)
          : process.cwd()
      switch (action) {
        case "show":
          return safetyService.showWhitelist()
        case "add":
          return safetyService.addWhitelist(defaultPath)
        case "remove":
          return safetyService.removeWhitelist(defaultPath)
        case "clear":
          return safetyService.clearWhitelist()
        default:
          return { error: `Unknown action: ${action}` }
      }
    },
  }
}
