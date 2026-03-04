import * as fs from "fs";
import * as path from "path";
import { buildCommand, escapeQuotes } from "./commandUtils";
import { RunnerBuildInput } from "./types";

export function buildReactScriptsCommand(input: RunnerBuildInput): string {
  const reactScriptsBaseCmd = toReactScriptsBaseCmd(input.baseCmd);
  const runArgs = [
    input.relativeSpecFile,
    "-t",
    escapeQuotes(input.pattern),
    "--ci",
    "--coverage=false",
    "--watch=false",
  ];
  // For CRA we keep a deterministic non-watch single run. Coverage actions are downgraded upstream.
  return buildCommand(reactScriptsBaseCmd, runArgs);
}

export function isReactScriptsCommand(baseCmd: string, projectRoot: string | null): boolean {
  const normalized = baseCmd.toLowerCase();
  if (normalized.includes("react-scripts") && normalized.includes("test")) {
    return true;
  }

  if (!projectRoot) {
    return false;
  }

  const pkgJsonPath = path.join(projectRoot, "package.json");
  try {
    if (!fs.existsSync(pkgJsonPath)) {
      return false;
    }
    const raw = fs.readFileSync(pkgJsonPath, "utf8");
    const pkg = JSON.parse(raw) as { scripts?: { test?: string } };
    return (pkg.scripts?.test ?? "").toLowerCase().includes("react-scripts test");
  } catch (error) {
    console.error("Error reading package.json for react-scripts detection:", error);
    return false;
  }
}

function toReactScriptsBaseCmd(baseCmd: string): string {
  const normalized = baseCmd.trim().replace(/\s+/g, " ").toLowerCase();
  if (normalized.includes("react-scripts") && normalized.includes("test")) {
    return baseCmd.trim();
  }

  if (normalized.startsWith("pnpm ")) {
    return "pnpm exec react-scripts test";
  }
  if (normalized.startsWith("yarn ")) {
    return "yarn react-scripts test";
  }
  if (normalized.startsWith("npm ")) {
    return "npm exec react-scripts test";
  }

  return "npx react-scripts test";
}
