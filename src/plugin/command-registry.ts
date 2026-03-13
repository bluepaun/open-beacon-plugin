import fs from "node:fs"

import { loadBundledMarkdownEntries, type FileSystemLike } from "./template-registry"

export function loadBundledCommands(
  fileSystem: FileSystemLike = fs,
): Record<string, Record<string, unknown>> {
  return loadBundledMarkdownEntries("commands", "template", fileSystem)
}
