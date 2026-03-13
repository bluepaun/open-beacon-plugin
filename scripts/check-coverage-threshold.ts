import { COVERAGE_THRESHOLD, extractOverallCoverage, isCoverageAtLeast } from "../src/shared/coverage-threshold"

const testProcess = Bun.spawn(["bun", "test", "--coverage"], {
  cwd: process.cwd(),
  stdout: "pipe",
  stderr: "pipe",
})

const [stdout, stderr, exitCode] = await Promise.all([
  new Response(testProcess.stdout).text(),
  new Response(testProcess.stderr).text(),
  testProcess.exited,
])

const combinedOutput = `${stdout}\n${stderr}`

if (stdout.length > 0) {
  process.stdout.write(stdout)
}

if (stderr.length > 0) {
  process.stderr.write(stderr)
}

const coverage = extractOverallCoverage(combinedOutput)

if (!coverage) {
  process.stderr.write("Failed to parse overall Bun coverage output.\n")
  process.exit(typeof exitCode === "number" && exitCode > 0 ? exitCode : 1)
}

if (!isCoverageAtLeast(coverage, COVERAGE_THRESHOLD)) {
  process.stderr.write(
    `Coverage gate failed: lines ${coverage.lines.toFixed(2)}% and functions ${coverage.functions.toFixed(2)}% must both be at least ${COVERAGE_THRESHOLD}%.\n`,
  )
  process.exit(1)
}

if (exitCode !== 0) {
  process.exit(exitCode)
}
