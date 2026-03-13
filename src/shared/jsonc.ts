import { parse } from "jsonc-parser"

export function parseJsonc<T>(content: string): T {
  return parse(content) as T
}
