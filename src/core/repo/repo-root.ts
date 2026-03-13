import { execSync } from "node:child_process"

export function getRepoRoot(cwd: string): string {
  try {
    return execSync("git rev-parse --show-toplevel", {
      cwd,
      encoding: "utf8",
      stdio: "pipe",
    }).trim()
  } catch {
    return cwd
  }
}
