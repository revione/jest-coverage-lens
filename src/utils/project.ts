import * as fs from "fs";
import * as path from "path";

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
