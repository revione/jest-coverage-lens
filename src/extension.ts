import * as fs from "fs";
import * as path from "path";
import * as vscode from "vscode";
import { JestCodeLensProvider, JestLensData } from "./jestCodeLens";
import { buildJestCommand } from "./runners/jestRunner";
import {
  buildReactScriptsCommand,
  isReactScriptsCommand,
} from "./runners/reactScriptsRunner";
import { RunOptions } from "./runners/types";
import {
  detectPackageManager,
  findProjectRoot,
  PackageManager,
} from "./utils/project";

const terminalsByCwd = new Map<string, vscode.Terminal>();

export function activate(context: vscode.ExtensionContext) {
  console.log("🚀 Jest Coverage CodeLens extension is now ACTIVE!");

  const provider = new JestCodeLensProvider();

  context.subscriptions.push(
    vscode.languages.registerCodeLensProvider(
      [
        { language: "typescript", scheme: "file" },
        { language: "typescriptreact", scheme: "file" },
        { language: "javascript", scheme: "file" },
        { language: "javascriptreact", scheme: "file" },
      ],
      provider,
    ),
  );

  console.log("✅ CodeLens provider registered!");

  context.subscriptions.push(
    vscode.window.onDidCloseTerminal((terminal) => {
      for (const [cwd, knownTerminal] of terminalsByCwd.entries()) {
        if (knownTerminal === terminal) {
          terminalsByCwd.delete(cwd);
        }
      }
    }),
  );

  context.subscriptions.push(
    vscode.commands.registerCommand(
      "jestCoverageLens.run",
      async (data: JestLensData) => {
        await runJest(data, { coverage: false, openBrowser: false });
      },
    ),
    vscode.commands.registerCommand(
      "jestCoverageLens.runCoverage",
      async (data: JestLensData) => {
        await runJest(data, { coverage: true, openBrowser: false });
      },
    ),
    vscode.commands.registerCommand(
      "jestCoverageLens.runCoverageOpen",
      async (data: JestLensData) => {
        await runJest(data, { coverage: true, openBrowser: true });
      },
    ),
  );
}

async function runJest(data: JestLensData, options: RunOptions) {
  const specFile = data.filePath;
  const projectRoot = findProjectRoot(specFile);
  const fileWorkspaceFolder = vscode.workspace.getWorkspaceFolder(
    vscode.Uri.file(specFile),
  );
  const executionRoot = projectRoot ?? fileWorkspaceFolder?.uri.fsPath ?? null;
  const cfg = vscode.workspace.getConfiguration("jestCoverageLens");
  const baseCmd = resolveBaseCommand(cfg, projectRoot);
  const coverageDir = cfg.get<string>("coverageDir", "coverage");
  const openCmd = cfg.get<string>("openCommand", "open");

  const pattern = data.fullNamePattern;

  if (!executionRoot) {
    vscode.window.showErrorMessage(
      "No se encontró el directorio del proyecto para ejecutar Jest",
    );
    return;
  }

  const relativeSpecFile = path.relative(executionRoot, specFile);
  const usesReactScripts = isReactScriptsCommand(baseCmd, projectRoot);
  let effectiveOptions = options;
  if (usesReactScripts && (options.coverage || options.openBrowser)) {
    vscode.window.showInformationMessage(
      "Coverage/Browser no está soportado de forma confiable en react-scripts. Ejecutando Run.",
    );
    effectiveOptions = { coverage: false, openBrowser: false };
  }

  let relativeSourceFile: string | null = null;
  if (effectiveOptions.coverage) {
    const sourceFile = await findSourceFile(specFile);
    if (sourceFile) {
      relativeSourceFile = path.relative(executionRoot, sourceFile);
    } else {
      vscode.window.showWarningMessage(
        "No se encontró el archivo fuente. Se ejecutará sin coverage específico.",
      );
    }
  }

  const cmd = usesReactScripts
    ? buildReactScriptsCommand({
        baseCmd,
        relativeSpecFile,
        pattern,
        options: effectiveOptions,
        relativeSourceFile,
        coverageDir,
        openCmd,
      })
    : buildJestCommand({
        baseCmd,
        relativeSpecFile,
        pattern,
        options: effectiveOptions,
        relativeSourceFile,
        coverageDir,
        openCmd,
      });

  // Debug log
  console.log("🚀 Comando Jest:", cmd);

  const term = getOrCreateTerminal(executionRoot);
  term.show(true);
  term.sendText(cmd, true);
}

async function findSourceFile(specPath: string) {
  // Intenta quitar .spec/.test
  const directMatch = specPath.replace(/\.(spec|test)\.(tsx?|jsx?)$/, ".$2");
  try {
    if (fs.existsSync(directMatch)) {
      return directMatch;
    }
  } catch (error) {
    console.error("Error checking file:", error);
  }

  // Busca en el mismo directorio o quitando segment de __tests__
  const dir = path.dirname(specPath);
  const fileName = path.basename(specPath);
  const baseName = fileName.replace(/\.(spec|test)\.(tsx?|jsx?)$/, "");

  const extensions = [".tsx", ".ts", ".jsx", ".js"];
  const candidateDirs = new Set<string>();
  candidateDirs.add(dir);
  const strippedDir = dir
    .split(path.sep)
    .filter((segment) => segment !== "__tests__")
    .join(path.sep);
  if (strippedDir && strippedDir !== dir) {
    candidateDirs.add(strippedDir);
  }

  for (const ext of extensions) {
    for (const candidateDir of candidateDirs) {
      const candidate = path.join(candidateDir, baseName + ext);
      try {
        if (fs.existsSync(candidate)) {
          return candidate;
        }
      } catch (error) {
        console.error("Error checking file:", error);
      }
    }
  }

  return null;
}

function getOrCreateTerminal(cwd: string) {
  const existing = terminalsByCwd.get(cwd);
  if (existing) {
    return existing;
  }

  const terminal = vscode.window.createTerminal({
    name: `Jest: ${path.basename(cwd)}`,
    cwd,
  });
  terminalsByCwd.set(cwd, terminal);
  return terminal;
}

export function deactivate() {}

function resolveBaseCommand(
  cfg: vscode.WorkspaceConfiguration,
  projectRoot: string | null,
) {
  const configuredCmd = cfg.get<string>("jestCommand", "pnpm jest").trim();
  const autoDetect = cfg.get<boolean>("autoDetectJestCommand", true);

  if (!autoDetect) {
    return configuredCmd;
  }

  if (!projectRoot) {
    return configuredCmd;
  }

  const pkgJsonPath = path.join(projectRoot, "package.json");
  try {
    if (!fs.existsSync(pkgJsonPath)) {
      return configuredCmd;
    }

    const raw = fs.readFileSync(pkgJsonPath, "utf8");
    const pkg = JSON.parse(raw) as { scripts?: { test?: string } };
    const testScript = (pkg.scripts?.test ?? "").toLowerCase();
    const packageManager = detectPackageManager(projectRoot);

    if (!testScript) {
      return packageManager
        ? getDirectJestCommand(packageManager)
        : configuredCmd;
    }

    if (testScript.includes("react-scripts test")) {
      return packageManager
        ? getDirectReactScriptsCommand(packageManager)
        : "npx react-scripts test";
    }
    if (testScript.includes("jest")) {
      return packageManager
        ? getDirectJestCommand(packageManager)
        : "npx jest";
    }
  } catch (error) {
    console.error("Error auto-detecting test command:", error);
  }

  return configuredCmd;
}

function getDirectReactScriptsCommand(packageManager: PackageManager) {
  switch (packageManager) {
    case "pnpm":
      return "pnpm exec react-scripts test";
    case "yarn":
      return "yarn react-scripts test";
    case "npm":
      return "npm exec react-scripts test";
  }
}

function getDirectJestCommand(packageManager: PackageManager) {
  switch (packageManager) {
    case "pnpm":
      return "pnpm jest";
    case "yarn":
      return "yarn jest";
    case "npm":
      return "npm exec jest";
  }
}
