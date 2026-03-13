import { loadBundledAgents } from "./agent-registry"
import { log } from "../shared/logger"

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}

export function createConfigHandler() {
  return async (config: Record<string, unknown>) => {
    const bundledAgents = loadBundledAgents()

    if (Object.keys(bundledAgents).length === 0) {
      return
    }

    const existingAgents = isRecord(config.agent)
      ? (config.agent as Record<string, unknown>)
      : {}

    config.agent = {
      ...bundledAgents,
      ...existingAgents,
    }

    log("registered bundled agents", {
      bundledAgentCount: Object.keys(bundledAgents).length,
      agentKeys: Object.keys(config.agent as Record<string, unknown>),
    })
  }
}
