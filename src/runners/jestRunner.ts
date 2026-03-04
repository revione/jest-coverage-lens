import * as path from "path";
import { buildCommand, escapeQuotes, quoteArg } from "./commandUtils";
import { RunnerBuildInput } from "./types";

export function buildJestCommand(input: RunnerBuildInput): string {
  const runArgs = [input.relativeSpecFile, "-t", escapeQuotes(input.pattern), "--coverage=false"];
  const coverageArgs = [input.relativeSpecFile, "-t", escapeQuotes(input.pattern), "--coverage"];

  if (!input.options.coverage) {
    return buildCommand(input.baseCmd, runArgs);
  }

  const args = [...coverageArgs];
  if (input.relativeSourceFile) {
    args.push("--collectCoverageFrom", input.relativeSourceFile);
  }

  if (!input.options.openBrowser) {
    return `${buildCommand(input.baseCmd, args)} && echo ${quoteArg(
      `Coverage report generated: ${path.posix.join(input.coverageDir, "lcov-report", "index.html")}`,
    )}`;
  }

  return `${buildCommand(
    input.baseCmd,
    [...args, "--coverageReporters=html"],
  )} && ${input.openCmd} ${quoteArg(path.posix.join(input.coverageDir, "lcov-report", "index.html"))}`;
}
