import * as fs from "fs";
import * as path from "path";

export type PackageManager = "npm" | "pnpm" | "yarn";

export function findProjectRoot(startPath: string): string | null {
  let current = path.dirname(startPath);

  while (true) {
    const pkgJsonPath = path.join(current, "package.json");
    if (fs.existsSync(pkgJsonPath)) {
      return current;
    }

    const parent = path.dirname(current);
    if (parent === current) {
      return null;
    }
    current = parent;
  }
}

export function detectPackageManager(startPath: string): PackageManager | null {
  let current = startPath;

  while (true) {
    const packageManager = readPackageManagerField(path.join(current, "package.json"));
    if (packageManager) {
      return packageManager;
    }

    if (fs.existsSync(path.join(current, "pnpm-lock.yaml"))) {
      return "pnpm";
    }
    if (fs.existsSync(path.join(current, "yarn.lock"))) {
      return "yarn";
    }
    if (
      fs.existsSync(path.join(current, "package-lock.json")) ||
      fs.existsSync(path.join(current, "npm-shrinkwrap.json"))
    ) {
      return "npm";
    }

    const parent = path.dirname(current);
    if (parent === current) {
      return null;
    }
    current = parent;
  }
}

function readPackageManagerField(pkgJsonPath: string): PackageManager | null {
  try {
    if (!fs.existsSync(pkgJsonPath)) {
      return null;
    }

    const raw = fs.readFileSync(pkgJsonPath, "utf8");
    const pkg = JSON.parse(raw) as { packageManager?: unknown };
    if (typeof pkg.packageManager !== "string") {
      return null;
    }

    const normalized = pkg.packageManager.trim().toLowerCase();
    if (normalized.startsWith("pnpm@")) {
      return "pnpm";
    }
    if (normalized.startsWith("yarn@")) {
      return "yarn";
    }
    if (normalized.startsWith("npm@")) {
      return "npm";
    }
  } catch (error) {
    console.error("Error reading package manager from package.json:", error);
  }

  return null;
}
