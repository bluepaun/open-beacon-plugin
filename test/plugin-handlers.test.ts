import { describe, expect, test } from "bun:test"

import { createEventHandler } from "../src/plugin/event"
import { createToolExecuteAfterHandler } from "../src/plugin/tool-execute-after"
import { createToolExecuteBeforeHandler } from "../src/plugin/tool-execute-before"

describe("plugin handlers", () => {
  test("dispatches supported events and ignores unknown events", async () => {
    const calls = {
      sessionCreated: 0,
      fileEdited: [] as string[],
    }

    const handler = createEventHandler({
      onSessionCreated: async () => {
        calls.sessionCreated += 1
      },
      onFileEdited: async (filePath: string) => {
        calls.fileEdited.push(filePath)
      },
      onToolExecuteBefore: undefined,
      onToolExecuteAfter: undefined,
      onSessionCompacting: undefined,
    })

    await handler({ event: { type: "session.created" } })
    await handler({ event: { type: "file.edited", properties: { filePath: "src/app.ts" } } })
    await handler({ event: { type: "file.edited", properties: { file: "src/legacy.ts" } } })
    await handler({ event: { type: "file.edited", properties: {} } })
    await handler({ event: { type: "other.event" } })

    expect(calls.sessionCreated).toBe(1)
    expect(calls.fileEdited).toEqual(["src/app.ts", "src/legacy.ts", ""])
  })

  test("forwards tool lifecycle callbacks when hooks exist", async () => {
    const beforeCalls: Array<{ tool: string; args?: Record<string, unknown> }> = []
    const afterCalls: Array<{ tool: string; args?: Record<string, unknown> }> = []
    const beforeOutput = { metadata: {} as Record<string, unknown> }

    const beforeHandler = createToolExecuteBeforeHandler({
      onSessionCreated: undefined,
      onFileEdited: undefined,
      onToolExecuteBefore: async (input, output) => {
        beforeCalls.push(input)
        output.metadata = { redirected: true }
      },
      onToolExecuteAfter: undefined,
      onSessionCompacting: undefined,
    })
    const afterHandler = createToolExecuteAfterHandler({
      onSessionCreated: undefined,
      onFileEdited: undefined,
      onToolExecuteBefore: undefined,
      onToolExecuteAfter: async (input) => {
        afterCalls.push(input)
      },
      onSessionCompacting: undefined,
    })

    await beforeHandler({ tool: "grep", args: { pattern: "Beacon" } }, beforeOutput)
    await afterHandler({ tool: "bash", args: { command: "bun test" } }, { metadata: {} })

    expect(beforeCalls).toEqual([{ tool: "grep", args: { pattern: "Beacon" } }])
    expect(beforeOutput.metadata).toEqual({ redirected: true })
    expect(afterCalls).toEqual([{ tool: "bash", args: { command: "bun test" } }])
  })

  test("safely no-ops when lifecycle hooks are absent", async () => {
    const beforeHandler = createToolExecuteBeforeHandler({
      onSessionCreated: undefined,
      onFileEdited: undefined,
      onToolExecuteBefore: undefined,
      onToolExecuteAfter: undefined,
      onSessionCompacting: undefined,
    })
    const afterHandler = createToolExecuteAfterHandler({
      onSessionCreated: undefined,
      onFileEdited: undefined,
      onToolExecuteBefore: undefined,
      onToolExecuteAfter: undefined,
      onSessionCompacting: undefined,
    })

    await expect(beforeHandler({ tool: "grep" }, { metadata: {} })).resolves.toBeUndefined()
    await expect(afterHandler({ tool: "bash" }, { metadata: {} })).resolves.toBeUndefined()
  })
})
