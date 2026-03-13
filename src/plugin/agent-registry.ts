import fs from "node:fs"
import path from "node:path"

type FileSystemLike = Pick<typeof fs, "existsSync" | "readdirSync" | "readFileSync">

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}

function parseScalar(rawValue: string): unknown {
  const value = rawValue.trim()

  if (value === "true") {
    return true
  }

  if (value === "false") {
    return false
  }

  if (/^-?\d+(?:\.\d+)?$/.test(value)) {
    return Number(value)
  }

  if (
    (value.startsWith('"') && value.endsWith('"')) ||
    (value.startsWith("'") && value.endsWith("'"))
  ) {
    return value.slice(1, -1)
  }

  return value
}

function parseFrontmatter(frontmatter: string): Record<string, unknown> {
  const root: Record<string, unknown> = {}
  const stack: Array<{ indent: number; value: Record<string, unknown> }> = [
    { indent: -1, value: root },
  ]

  for (const line of frontmatter.split(/\r?\n/)) {
    if (line.trim().length === 0) {
      continue
    }

    const indent = line.length - line.trimStart().length
    const trimmed = line.trim()
    const separatorIndex = trimmed.indexOf(":")

    if (separatorIndex === -1) {
      continue
    }

    const key = trimmed.slice(0, separatorIndex).trim()
    const rawValue = trimmed.slice(separatorIndex + 1).trim()

    while (stack.length > 1 && indent <= stack[stack.length - 1]?.indent) {
      stack.pop()
    }

    const parent = stack[stack.length - 1]?.value

    if (!parent) {
      continue
    }

    if (rawValue.length === 0) {
      parent[key] = {}
      stack.push({ indent, value: parent[key] as Record<string, unknown> })
      continue
    }

    parent[key] = parseScalar(rawValue)
  }

  return root
}

function parseBundledAgent(content: string): Record<string, unknown> {
  const match = content.match(/^---\s*\r?\n([\s\S]*?)\r?\n---\s*\r?\n?([\s\S]*)$/)

  if (!match) {
    const prompt = content.trim()
    return prompt.length > 0 ? { prompt } : {}
  }

  const [, frontmatter, body] = match
  const parsed = parseFrontmatter(frontmatter)
  const prompt = body.trim()

  if (prompt.length > 0) {
    parsed.prompt = prompt
  }

  return parsed
}

function resolveBundledAgentsDir(fileSystem: FileSystemLike): string | null {
  const candidates = [
    path.resolve(import.meta.dir, "..", "templates", ".opencode", "agents"),
    path.resolve(import.meta.dir, "..", "..", "templates", ".opencode", "agents"),
  ]

  for (const candidate of candidates) {
    if (fileSystem.existsSync(candidate)) {
      return candidate
    }
  }

  return null
}

export function loadBundledAgents(
  fileSystem: FileSystemLike = fs,
): Record<string, Record<string, unknown>> {
  const agentsDir = resolveBundledAgentsDir(fileSystem)

  if (!agentsDir) {
    return {}
  }

  const entries = fileSystem.readdirSync(agentsDir)
  const bundledAgents: Record<string, Record<string, unknown>> = {}

  for (const entry of entries) {
    if (!entry.endsWith(".md")) {
      continue
    }

    const agentName = path.basename(entry, path.extname(entry))
    const content = fileSystem.readFileSync(path.join(agentsDir, entry), "utf8")
    const parsed = parseBundledAgent(content)

    if (isRecord(parsed) && Object.keys(parsed).length > 0) {
      bundledAgents[agentName] = parsed
    }
  }

  return bundledAgents
}
