import { execSync } from "node:child_process"
import { createHash } from "node:crypto"
import { readdirSync, readFileSync } from "node:fs"
import path from "node:path"

function isGitRepo(cwd: string): boolean {
  try {
    execSync("git rev-parse --git-dir", { cwd, encoding: "utf8", stdio: "pipe" })
    return true
  } catch {
    return false
  }
}

function walkDirectory(dir: string, baseDir: string, maxFiles: number, counter: { count: number }): string[] {
  const skipDirs = new Set([
    "node_modules", ".git", ".venv", "venv", "__pycache__", ".next",
    "dist", "build", ".claude", ".opencode", ".beacon", ".DS_Store", ".vscode", ".idea",
  ])

  let entries: Array<{ name: string; isDirectory(): boolean; isFile(): boolean; isSymbolicLink(): boolean }>
  try {
    entries = readdirSync(dir, { withFileTypes: true }) as Array<{ name: string; isDirectory(): boolean; isFile(): boolean; isSymbolicLink(): boolean }>
  } catch {
    return []
  }

  const results: string[] = []

  for (const entry of entries) {
    if (counter.count >= maxFiles) {
      break
    }
    if (skipDirs.has(entry.name)) {
      continue
    }
    if (entry.name.startsWith(".") && entry.isDirectory()) {
      continue
    }
    if (entry.isSymbolicLink()) {
      continue
    }

    const fullPath = path.join(dir, entry.name)
    if (entry.isDirectory()) {
      results.push(...walkDirectory(fullPath, baseDir, maxFiles, counter))
      continue
    }

    if (entry.isFile()) {
      results.push(path.relative(baseDir, fullPath))
      counter.count += 1
    }
  }

  return results
}

export function getRepoFiles(cwd: string, maxFiles = 10000): string[] {
  if (isGitRepo(cwd)) {
    try {
      const tracked = execSync("git ls-files", { cwd, encoding: "utf8" })
      const untracked = execSync("git ls-files --others --exclude-standard", { cwd, encoding: "utf8" })
      const all = new Set([...tracked.trim().split("\n"), ...untracked.trim().split("\n")].filter(Boolean))
      return [...all].slice(0, maxFiles)
    } catch {
      // Fall through to directory walk.
    }
  }

  return walkDirectory(cwd, cwd, maxFiles, { count: 0 })
}

export function getFileHash(filePath: string): string {
  return createHash("sha256").update(readFileSync(filePath)).digest("hex")
}

export function getModifiedFilesSince(cwd: string, isoTimestamp: string): string[] {
  if (!isGitRepo(cwd)) {
    return getRepoFiles(cwd)
  }

  try {
    const committed = execSync(`git log --since="${isoTimestamp}" --name-only --pretty=format:""`, {
      cwd,
      encoding: "utf8",
    })
    const modified = execSync("git diff --name-only HEAD", { cwd, encoding: "utf8" })
    const untracked = execSync("git ls-files --others --exclude-standard", { cwd, encoding: "utf8" })

    return [...new Set([...committed.trim().split("\n"), ...modified.trim().split("\n"), ...untracked.trim().split("\n")].filter(Boolean))]
  } catch {
    return []
  }
}
