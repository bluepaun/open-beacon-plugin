import type { OpenBeaconConfigInput } from "./schema"

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}

export function mergeConfigs(
  base: OpenBeaconConfigInput,
  override: OpenBeaconConfigInput,
): OpenBeaconConfigInput {
  const result: Record<string, unknown> = { ...base }

  for (const [key, value] of Object.entries(override)) {
    const current = result[key]

    if (Array.isArray(value) && Array.isArray(current)) {
      result[key] = [...new Set([...current, ...value])]
      continue
    }

    if (isRecord(value) && isRecord(current)) {
      result[key] = mergeConfigs(current as OpenBeaconConfigInput, value as OpenBeaconConfigInput)
      continue
    }

    result[key] = value
  }

  return result as OpenBeaconConfigInput
}
