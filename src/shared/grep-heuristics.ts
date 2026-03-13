export type GrepRedirectInput = {
  pattern: string
  path?: string
  outputMode?: string
  minPatternLength: number
}

export function shouldRedirectGrep(input: GrepRedirectInput): boolean {
  const pattern = input.pattern ?? ""
  const searchPath = input.path ?? ""
  const outputMode = input.outputMode ?? "files_with_matches"

  if (pattern.length < input.minPatternLength) {
    return false
  }

  if (/[*+?\[\]{}()|\\^$]/.test(pattern.replace(/\\\./g, ""))) {
    return false
  }

  if (searchPath && !searchPath.endsWith("/") && /\.[a-z0-9]+$/i.test(searchPath)) {
    return false
  }

  if (outputMode === "count" || outputMode === "content") {
    return false
  }

  if (/\w\.\w/.test(pattern)) {
    return false
  }

  if (/[/\\]/.test(pattern)) {
    return false
  }

  if (/^["']|["']$/.test(pattern)) {
    return false
  }

  if (/^[@#]|TODO|FIXME|HACK|XXX|DEPRECATED/.test(pattern)) {
    return false
  }

  if (/:\/{2}|localhost/.test(pattern)) {
    return false
  }

  return true
}
