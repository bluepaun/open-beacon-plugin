import type { CreatedHooks } from "../create-hooks"
import type { OpenCodeEventEnvelope } from "./types"

export function createEventHandler(hooks: CreatedHooks) {
  return async (input: OpenCodeEventEnvelope): Promise<void> => {
    switch (input.event.type) {
      case "session.created":
        await hooks.onSessionCreated?.()
        return
      case "file.edited": {
        const filePath = typeof input.event.properties?.filePath === "string"
          ? input.event.properties.filePath
          : typeof input.event.properties?.file === "string"
            ? input.event.properties.file
            : ""

        await hooks.onFileEdited?.(filePath)
        return
      }
      default:
        return
    }
  }
}
