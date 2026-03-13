import { loadBundledAgents } from "./agent-registry"
import { loadBundledCommands } from "./command-registry"
import { loadBundledSkillPaths } from "./skill-registry"
import { log } from "../shared/logger"

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}

export function createConfigHandler() {
  return async (config: Record<string, unknown>) => {
    const bundledAgents = loadBundledAgents()
    const bundledCommands = loadBundledCommands()
    const bundledSkillPaths = loadBundledSkillPaths()

    if (
      Object.keys(bundledAgents).length === 0
      && Object.keys(bundledCommands).length === 0
      && bundledSkillPaths.length === 0
    ) {
      return
    }

    if (Object.keys(bundledAgents).length > 0) {
      const existingAgents = isRecord(config.agent)
        ? (config.agent as Record<string, unknown>)
        : {}

      config.agent = {
        ...bundledAgents,
        ...existingAgents,
      }
    }

    if (Object.keys(bundledCommands).length > 0) {
      const existingCommands = isRecord(config.command)
        ? (config.command as Record<string, unknown>)
        : {}

      config.command = {
        ...bundledCommands,
        ...existingCommands,
      }
    }

    if (bundledSkillPaths.length > 0) {
      const existingSkills = isRecord(config.skills)
        ? (config.skills as Record<string, unknown>)
        : {}
      const mergedPaths = Array.isArray(existingSkills.paths)
        ? [...existingSkills.paths]
        : []

      for (const bundledSkillPath of bundledSkillPaths) {
        if (!mergedPaths.includes(bundledSkillPath)) {
          mergedPaths.push(bundledSkillPath)
        }
      }

      config.skills = {
        ...existingSkills,
        paths: mergedPaths,
      }
    }

    log("registered bundled plugin config", {
      bundledAgentCount: Object.keys(bundledAgents).length,
      bundledCommandCount: Object.keys(bundledCommands).length,
      bundledSkillPathCount: bundledSkillPaths.length,
      agentKeys: isRecord(config.agent) ? Object.keys(config.agent) : [],
      commandKeys: isRecord(config.command) ? Object.keys(config.command) : [],
      skillPaths: isRecord(config.skills) && Array.isArray(config.skills.paths) ? config.skills.paths : [],
    })
  }
}
