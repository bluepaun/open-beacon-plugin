import fs from "node:fs"
import path from "node:path"

type FileSystemLike = Pick<typeof fs, "existsSync" | "readdirSync" | "readFileSync">

type ContentKey = "prompt" | "template"

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

function parseBundledMarkdown(content: string, contentKey: ContentKey): Record<string, unknown> {
  const match = content.match(/^---\s*\r?\n([\s\S]*?)\r?\n---\s*\r?\n?([\s\S]*)$/)

  if (!match) {
    const body = content.trim()
    return body.length > 0 ? { [contentKey]: body } : {}
  }

  const [, frontmatter, body] = match
  const parsed = parseFrontmatter(frontmatter)
  const trimmedBody = body.trim()

  if (trimmedBody.length > 0) {
    parsed[contentKey] = trimmedBody
  }

  return parsed
}

function resolveBundledDir(subdirectory: string, fileSystem: FileSystemLike): string | null {
  const candidates = [
    path.resolve(import.meta.dir, "..", "templates", ".opencode", subdirectory),
    path.resolve(import.meta.dir, "..", "..", "templates", ".opencode", subdirectory),
  ]

  for (const candidate of candidates) {
    if (fileSystem.existsSync(candidate)) {
      return candidate
    }
  }

  return null
}

export function loadBundledMarkdownEntries(
  subdirectory: string,
  contentKey: ContentKey,
  fileSystem: FileSystemLike = fs,
): Record<string, Record<string, unknown>> {
  const templatesDir = resolveBundledDir(subdirectory, fileSystem)

  if (!templatesDir) {
    return {}
  }

  const bundledEntries: Record<string, Record<string, unknown>> = {}

  for (const entry of fileSystem.readdirSync(templatesDir)) {
    if (!entry.endsWith(".md")) {
      continue
    }

    const entryName = path.basename(entry, path.extname(entry))
    const content = fileSystem.readFileSync(path.join(templatesDir, entry), "utf8")
    const parsed = parseBundledMarkdown(content, contentKey)

    if (isRecord(parsed) && Object.keys(parsed).length > 0) {
      bundledEntries[entryName] = parsed
    }
  }

  return bundledEntries
}

export { resolveBundledDir }

export type { FileSystemLike }
