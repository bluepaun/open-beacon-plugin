import { z } from "zod"

import type { ToolDefinition } from "../plugin/types"

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
          return configService.show()
        case "set":
          return configService.set(String(args.key ?? ""), String(args.value ?? ""))
        case "provider":
          return configService.provider(typeof args.name === "string" ? args.name : undefined)
        case "reset":
          return configService.reset(typeof args.section === "string" ? args.section : undefined)
        default:
          return { error: `Unknown action: ${action}` }
      }
    },
  }
}
