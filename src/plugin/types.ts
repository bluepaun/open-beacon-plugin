import type { Plugin } from "@opencode-ai/plugin"
import type { ZodTypeAny } from "zod"

export type PluginContext = Parameters<Plugin>[0]
export type PluginInstance = Awaited<ReturnType<Plugin>>

export type ToolDefinition = {
  description: string
  args: Record<string, ZodTypeAny>
  execute: (args: Record<string, unknown>, context?: unknown) => Promise<unknown> | unknown
}

export type ToolsRecord = Record<string, ToolDefinition>

export type OpenCodeEventEnvelope = {
  event: {
    type: string
    properties?: Record<string, unknown>
  }
}

export type ToolExecuteInput = {
  tool: string
  args?: Record<string, unknown>
}

export type ToolExecuteBeforeOutput = {
  blocked?: boolean
  message?: string
  metadata?: Record<string, unknown>
}

export type ToolExecuteAfterOutput = {
  metadata?: Record<string, unknown>
}

export type SessionCompactingInput = {
  sessionID: string
}

export type SessionCompactingOutput = {
  context: string[]
}
