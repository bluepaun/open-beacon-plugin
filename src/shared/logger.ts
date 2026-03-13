const PREFIX = "[open-beacon]"

export function log(message: string, extra?: Record<string, unknown>): void {
  if (!process.env.OPEN_BEACON_DEBUG) {
    return
  }

  if (extra) {
    console.log(PREFIX, message, extra)
    return
  }

  console.log(PREFIX, message)
}
