export function toToolOutput(value: unknown): string {
  if (typeof value === "string") {
    return value
  }

  return JSON.stringify(value, null, 2)
}
