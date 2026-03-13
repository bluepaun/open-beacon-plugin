import { z } from "zod"

import type { ToolDefinition } from "../plugin/types"
import { toToolOutput } from "../shared/tool-output"

type ConfigServiceLike = {
  show: () => unknown
  set: (key: string, value: string) => unknown
  provider: (name?: string) => unknown
  reset: (section?: string) => unknown
}

export function createBeaconConfigTool(configService: ConfigServiceLike): ToolDefinition {
  return {
    description: "Show or modify Open Beacon configuration",
    args: {
      action: z.enum(["show", "set", "provider", "reset"]).default("show"),
      key: z.string().optional(),
      value: z.string().optional(),
      name: z.string().optional(),
      section: z.string().optional(),
    },
    async execute(args) {
      const action = String(args.action ?? "show")
      switch (action) {
        case "show":
          return toToolOutput(configService.show())
        case "set":
          return toToolOutput(configService.set(String(args.key ?? ""), String(args.value ?? "")))
        case "provider":
          return toToolOutput(configService.provider(typeof args.name === "string" ? args.name : undefined))
        case "reset":
          return toToolOutput(configService.reset(typeof args.section === "string" ? args.section : undefined))
        default:
          return toToolOutput({ error: `Unknown action: ${action}` })
      }
    },
  }
}
