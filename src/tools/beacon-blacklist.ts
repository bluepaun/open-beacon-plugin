import { z } from "zod"

import type { ToolDefinition } from "../plugin/types"

type SafetyServiceLike = {
  showBlacklist: () => unknown
  addBlacklist: (path: string) => unknown
  removeBlacklist: (path: string) => unknown
  resetBlacklist: () => unknown
}

export function createBeaconBlacklistTool(safetyService: SafetyServiceLike): ToolDefinition {
  return {
    description: "Manage Open Beacon indexing blacklist",
    args: {
      action: z.enum(["show", "add", "remove", "reset"]).default("show"),
      path: z.string().optional(),
    },
    async execute(args) {
      const action = String(args.action ?? "show")
      switch (action) {
        case "show":
          return safetyService.showBlacklist()
        case "add":
          return safetyService.addBlacklist(String(args.path ?? ""))
        case "remove":
          return safetyService.removeBlacklist(String(args.path ?? ""))
        case "reset":
          return safetyService.resetBlacklist()
        default:
          return { error: `Unknown action: ${action}` }
      }
    },
  }
}
