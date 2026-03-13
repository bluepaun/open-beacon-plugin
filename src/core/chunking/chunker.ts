import path from "node:path"

import type { OpenBeaconConfig } from "../../config/schema"

const boundaries: Record<string, RegExp> = {
  ".ts": /^(?:export\s+)?(?:async\s+)?(?:function|class|interface|type|const\s+\w+\s*=\s*(?:async\s+)?\(|enum)\b/m,
  ".tsx": /^(?:export\s+)?(?:async\s+)?(?:function|class|interface|type|const\s+\w+\s*=\s*(?:async\s+)?\(|enum)\b/m,
  ".js": /^(?:export\s+)?(?:async\s+)?(?:function|class|const\s+\w+\s*=\s*(?:async\s+)?\()\b/m,
  ".jsx": /^(?:export\s+)?(?:async\s+)?(?:function|class|const\s+\w+\s*=\s*(?:async\s+)?\()\b/m,
  ".py": /^(?:def |class |async def )/m,
  ".go": /^(?:func |type )/m,
  ".rs": /^(?:pub\s+)?(?:fn |struct |enum |impl |trait |mod )/m,
  ".java": /^(?:public |private |protected )?(?:static\s+)?(?:class |interface |enum |.*\s+\w+\s*\()/m,
  ".rb": /^(?:def |class |module )/m,
  ".php": /^(?:function |class |interface |trait )/m,
  ".sql": /^(?:CREATE |ALTER |DROP |INSERT |SELECT |WITH |-- ===)/im,
}

export type CodeChunk = {
  index: number
  text: string
  startLine: number
  endLine: number
}

export function chunkCode(content: string, filePath: string, config: OpenBeaconConfig): CodeChunk[] {
  const ext = path.extname(filePath)
  const strategy = config.chunking.strategy

  if (strategy === "syntax" || strategy === "hybrid") {
    const syntaxChunks = trySyntaxChunk(content, ext)
    if (syntaxChunks.length > 0) {
      return syntaxChunks
    }
  }

  return fixedChunk(content, config.chunking.max_tokens, config.chunking.overlap_tokens)
}

function trySyntaxChunk(content: string, ext: string): CodeChunk[] {
  const pattern = boundaries[ext]
  if (!pattern) {
    return []
  }

  const lines = content.split("\n")
  const boundaryIndices: number[] = []

  for (const [index, line] of lines.entries()) {
    if (pattern.test(line)) {
      boundaryIndices.push(index)
    }
  }

  if (boundaryIndices.length < 2) {
    return []
  }

  return boundaryIndices.map((start, index) => {
    const end = index + 1 < boundaryIndices.length ? boundaryIndices[index + 1] - 1 : lines.length - 1
    return {
      index,
      text: lines.slice(start, end + 1).join("\n"),
      startLine: start + 1,
      endLine: end + 1,
    }
  })
}

function fixedChunk(content: string, maxTokens: number, overlapTokens: number): CodeChunk[] {
  const maxChars = maxTokens * 4
  const overlapChars = overlapTokens * 4
  const lines = content.split("\n")
  const chunks: CodeChunk[] = []

  let currentChunk: string[] = []
  let currentLen = 0
  let startLine = 1
  let chunkIndex = 0

  for (const [index, line] of lines.entries()) {
    currentChunk.push(line)
    currentLen += line.length + 1

    if (currentLen >= maxChars) {
      chunks.push({
        index: chunkIndex,
        text: currentChunk.join("\n"),
        startLine,
        endLine: index + 1,
      })

      chunkIndex += 1

      const overlapLines: string[] = []
      let overlapLen = 0
      for (let lineIndex = currentChunk.length - 1; lineIndex >= 0 && overlapLen < overlapChars; lineIndex -= 1) {
        overlapLines.unshift(currentChunk[lineIndex])
        overlapLen += currentChunk[lineIndex].length + 1
      }

      currentChunk = overlapLines
      currentLen = overlapLen
      startLine = Math.max(1, index + 1 - overlapLines.length + 1)
    }
  }

  if (currentChunk.length > 0) {
    chunks.push({
      index: chunkIndex,
      text: currentChunk.join("\n"),
      startLine,
      endLine: lines.length,
    })
  }

  return chunks
}
