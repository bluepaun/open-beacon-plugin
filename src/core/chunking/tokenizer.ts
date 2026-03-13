const stopWords = new Set([
  "a", "an", "the", "is", "are", "was", "were", "be", "been", "being",
  "have", "has", "had", "do", "does", "did", "will", "would", "could",
  "should", "may", "might", "shall", "can", "need", "dare", "ought",
  "used", "to", "of", "in", "for", "on", "with", "at", "by", "from",
  "as", "into", "through", "during", "before", "after", "above", "below",
  "between", "out", "off", "over", "under", "again", "further", "then",
  "once", "here", "there", "when", "where", "why", "how", "all", "each",
  "every", "both", "few", "more", "most", "other", "some", "such", "no",
  "nor", "not", "only", "own", "same", "so", "than", "too", "very",
  "just", "because", "but", "and", "or", "if", "while", "about", "up",
  "what", "which", "who", "whom", "this", "that", "these", "those", "am",
  "it", "its", "i", "me", "my", "we", "our", "you", "your", "he", "him",
  "his", "she", "her", "they", "them", "their",
])

const synonyms = new Map([
  ["auth", ["authentication", "authorize", "authorization", "login"]],
  ["config", ["configuration", "settings", "preferences"]],
  ["db", ["database", "sqlite", "postgres", "mysql"]],
  ["err", ["error", "exception"]],
  ["fn", ["function", "method"]],
  ["func", ["function", "method"]],
  ["init", ["initialize", "initialization", "setup"]],
  ["msg", ["message"]],
  ["nav", ["navigation", "navigate", "router"]],
  ["param", ["parameter", "argument"]],
  ["pkg", ["package"]],
  ["req", ["request"]],
  ["res", ["response"]],
  ["repo", ["repository"]],
  ["sync", ["synchronize", "synchronization"]],
  ["util", ["utility", "utilities", "helper"]],
  ["utils", ["utility", "utilities", "helper"]],
  ["env", ["environment"]],
  ["middleware", ["interceptor", "handler"]],
  ["api", ["endpoint", "route"]],
])

function splitCamelCase(word: string): string[] {
  return word
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/([A-Z]+)([A-Z][a-z])/g, "$1 $2")
    .split(/\s+/)
}

export function extractIdentifiers(text: string): string {
  const identifierPattern = /[a-zA-Z_$][a-zA-Z0-9_$]{1,}/g
  const seen = new Set<string>()
  const parts: string[] = []

  for (const match of text.matchAll(identifierPattern)) {
    const id = match[0]
    if (seen.has(id)) {
      continue
    }
    seen.add(id)

    if (stopWords.has(id.toLowerCase()) && id.length < 6) {
      continue
    }

    const isCamel = /[a-z][A-Z]/.test(id)
    const isSnake = id.includes("_")

    if (isCamel || isSnake) {
      parts.push(id)
      if (isCamel) {
        parts.push(...splitCamelCase(id))
      }
      if (isSnake) {
        parts.push(...id.split("_").filter(Boolean))
      }
    }
  }

  return parts.join(" ")
}

function expandWithSynonyms(token: string): string[] {
  return (synonyms.get(token.toLowerCase()) ?? []).map((value) => `"${value}"`)
}

export function prepareFTSQuery(query: string): string | { andQuery: string; orQuery: string } | null {
  const tokens = query
    .replace(/[^\w\s]/g, " ")
    .split(/\s+/)
    .filter((token) => token.length > 0)
    .filter((token) => !stopWords.has(token.toLowerCase()))

  if (tokens.length === 0) {
    return null
  }

  const expanded: string[] = []
  for (const token of tokens) {
    expanded.push(`"${token}"`)
    if (/[a-z][A-Z]/.test(token)) {
      for (const part of splitCamelCase(token)) {
        if (part.length > 1 && !stopWords.has(part.toLowerCase())) {
          expanded.push(`"${part}"`)
        }
      }
    }
    if (token.includes("_")) {
      for (const part of token.split("_")) {
        if (part.length > 1 && !stopWords.has(part.toLowerCase())) {
          expanded.push(`"${part}"`)
        }
      }
    }
    expanded.push(...expandWithSynonyms(token))
  }

  const unique = [...new Set(expanded)]
  if (tokens.length >= 3) {
    const andTokens = [...new Set(tokens.map((token) => `"${token}"`))]
    return {
      andQuery: andTokens.join(" AND "),
      orQuery: unique.join(" OR "),
    }
  }

  return unique.join(" OR ")
}

export function normalizeBM25(scores: number[]): number[] {
  if (scores.length === 0) {
    return []
  }
  if (scores.length === 1) {
    return [1]
  }

  const min = Math.min(...scores)
  const max = Math.max(...scores)
  if (min === max) {
    return scores.map(() => 1)
  }

  return scores.map((score) => (max - score) / (max - min))
}

export function rrfScore(vecRank: number | null, ftsRank: number | null, k = 60): number {
  let score = 0
  if (vecRank !== null) {
    score += 1 / (k + vecRank)
  }
  if (ftsRank !== null) {
    score += 1 / (k + ftsRank)
  }
  return score
}

export function getFileTypeMultiplier(filePath: string): number {
  const lower = filePath.toLowerCase()
  const base = lower.split("/").pop() ?? lower

  if (base === "readme.md") {
    return 0.5
  }
  if (lower.endsWith(".md")) {
    return 0.7
  }
  if (/\.(test|spec)\.[^.]+$/.test(lower) || /__(tests|test)__/.test(lower) || lower.includes("/test/")) {
    return 0.85
  }
  if (/\.(json|ya?ml|toml|ini|cfg|conf)$/.test(lower) || base.startsWith(".")) {
    return 0.8
  }
  return 1
}

export function getIdentifierBoost(query: string, chunkText: string): number {
  const identifierPattern = /[a-zA-Z_$][a-zA-Z0-9_$]{2,}/g
  const queryIds: string[] = []
  for (const match of query.matchAll(identifierPattern)) {
    const id = match[0]
    if (/[a-z][A-Z]/.test(id) || id.includes("_")) {
      queryIds.push(id)
    }
  }

  if (queryIds.length === 0) {
    return 1
  }

  let boost = 1
  for (const id of queryIds) {
    if (chunkText.includes(id)) {
      boost += 0.5
    }
  }

  return Math.min(boost, 2.5)
}
