export const COVERAGE_THRESHOLD = 90

export type OverallCoverage = {
  functions: number
  lines: number
}

const OVERALL_COVERAGE_PATTERN = /^All files\s+\|\s+(\d+(?:\.\d+)?)\s+\|\s+(\d+(?:\.\d+)?)\s+\|/m

export function extractOverallCoverage(report: string): OverallCoverage | null {
  const match = report.match(OVERALL_COVERAGE_PATTERN)

  if (!match) {
    return null
  }

  const [, functions, lines] = match

  return {
    functions: Number(functions),
    lines: Number(lines),
  }
}

export function isCoverageAtLeast(coverage: OverallCoverage, threshold: number): boolean {
  return coverage.functions >= threshold && coverage.lines >= threshold
}
