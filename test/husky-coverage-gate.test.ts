import { describe, expect, test } from "bun:test"
import path from "node:path"

const projectRoot = path.join(import.meta.dir, "..")

describe("coverage gate tooling", () => {
  test("configures a coverage script and husky prepare step", async () => {
    const packageJsonPath = path.join(projectRoot, "package.json")
    const packageJson = JSON.parse(await Bun.file(packageJsonPath).text()) as {
      scripts?: Record<string, string>
    }

    expect(packageJson.scripts?.prepare).toBe("husky")
    expect(packageJson.scripts?.["test:coverage"]).toBe("bun run scripts/check-coverage-threshold.ts")
  })

  test("uses a dedicated coverage gate script", async () => {
    const scriptPath = path.join(projectRoot, "scripts", "check-coverage-threshold.ts")
    const script = await Bun.file(scriptPath).text()

    expect(script).toContain('Bun.spawn(["bun", "test", "--coverage"]')
    expect(script).toContain("COVERAGE_THRESHOLD")
  })

  test("runs the coverage check before git push", async () => {
    const prePushPath = path.join(projectRoot, ".husky", "pre-push")
    const hook = await Bun.file(prePushPath).text()

    expect(hook).toContain("bun run test:coverage")
  })
})
