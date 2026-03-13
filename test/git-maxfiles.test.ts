import { describe, expect, test } from "bun:test"
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import path from "node:path"

import { getRepoFiles } from "../src/core/repo/git"

describe("getRepoFiles", () => {
  test("#given a non-git directory #when maxFiles is small #then directory walking respects the cap", () => {
    const root = mkdtempSync(path.join(tmpdir(), "open-beacon-git-"))
    const srcDir = path.join(root, "src")
    mkdirSync(srcDir)
    for (let index = 0; index < 20; index += 1) {
      writeFileSync(path.join(srcDir, `file${index}.js`), `// file ${index}`)
    }

    const files = getRepoFiles(root, 10)
    expect(files.length).toBeLessThanOrEqual(10)

    rmSync(root, { recursive: true, force: true })
  })
})
