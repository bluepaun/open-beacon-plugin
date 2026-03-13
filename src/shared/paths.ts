import path from "node:path"

export function resolveFromProject(directory: string, targetPath: string): string {
  if (path.isAbsolute(targetPath)) {
    return targetPath
  }

  return path.resolve(directory, targetPath)
}

export function resolveHomePath(homeDir: string, targetPath: string): string {
  if (targetPath.startsWith("~/")) {
    return path.join(homeDir, targetPath.slice(2))
  }

  return targetPath
}

export function getUserOpenCodeConfigDir(homeDir: string): string {
  return path.join(homeDir, ".config", "opencode")
}
