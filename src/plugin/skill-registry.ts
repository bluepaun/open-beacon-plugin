import fs from "node:fs"

import { resolveBundledDir, type FileSystemLike } from "./template-registry"

export function loadBundledSkillPaths(fileSystem: FileSystemLike = fs): string[] {
  const skillsDir = resolveBundledDir("skills", fileSystem)

  return skillsDir ? [skillsDir] : []
}
