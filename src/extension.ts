import * as fs from "fs";
import * as path from "path";
import * as vscode from "vscode";
import { JestCodeLensProvider, JestLensData } from "./jestCodeLens";

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

interface RunOptions {
  coverage: boolean;
  openBrowser: boolean;
}

async function runJest(data: JestLensData, options: RunOptions) {
  const cfg = vscode.workspace.getConfiguration("jestCoverageLens");
  const baseCmd = cfg.get<string>("jestCommand", "pnpm jest");
  const coverageDir = cfg.get<string>("coverageDir", "coverage");
  const openCmd = cfg.get<string>("openCommand", "open");

  const specFile = data.filePath;
  const pattern = data.fullNamePattern;

  // Obtener workspace root para hacer paths relativos
  const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
  if (!workspaceFolder) {
    vscode.window.showErrorMessage("No se encontró workspace folder");
    return;
  }

  const workspaceRoot = workspaceFolder.uri.fsPath;

  // Convertir a path relativo
  const relativeSpecFile = specFile.replace(workspaceRoot + "/", "");

  let cmd = "";

  if (!options.coverage) {
    // Run (sin coverage)
    cmd = `${baseCmd} ${relativeSpecFile} -t "${escapeQuotes(pattern)}" --coverage=false`;
  } else if (options.coverage && !options.openBrowser) {
    // Run with Coverage (sin abrir navegador)
    const sourceFile = await findSourceFile(specFile);

    if (sourceFile) {
      const relativeSourceFile = sourceFile.replace(workspaceRoot + "/", "");
      cmd = `${baseCmd} ${relativeSpecFile} -t "${escapeQuotes(pattern)}" --coverage --collectCoverageFrom='${relativeSourceFile}'`;
    } else {
      vscode.window.showWarningMessage(
        "No se encontró el archivo fuente. Se ejecutará sin coverage específico.",
      );
      cmd = `${baseCmd} ${relativeSpecFile} -t "${escapeQuotes(pattern)}" --coverage`;
    }
  } else {
    // Run with Coverage + open
    const sourceFile = await findSourceFile(specFile);

    if (sourceFile) {
      const relativeSourceFile = sourceFile.replace(workspaceRoot + "/", "");
      cmd = `${baseCmd} "${relativeSpecFile}" -t "${escapeQuotes(pattern)}" --coverage --collectCoverageFrom="${relativeSourceFile}" --coverageReporters=html && ${openCmd} ${coverageDir}/index.html`;
    } else {
      vscode.window.showWarningMessage(
        "No se encontró el archivo fuente. Se ejecutará sin coverage específico.",
      );
      cmd = `${baseCmd} "${relativeSpecFile}" -t "${escapeQuotes(pattern)}" --coverage --coverageReporters=html && ${openCmd} ${coverageDir}/index.html`;
    }
  }

  // Debug log
  console.log("🚀 Comando Jest:", cmd);

  const term = getOrCreateTerminal("Jest");
  term.show(true);
  term.sendText(cmd, true);
}

async function findSourceFile(specPath: string): Promise<string | null> {
  // Intenta quitar .spec/.test
  const directMatch = specPath.replace(/\.(spec|test)\.(tsx?|jsx?)$/, ".$2");
  try {
    if (fs.existsSync(directMatch)) {
      return directMatch;
    }
  } catch (error) {
    console.error("Error checking file:", error);
  }

  // Busca en el mismo directorio
  const dir = path.dirname(specPath);
  const fileName = path.basename(specPath);
  const baseName = fileName.replace(/\.(spec|test)\.(tsx?|jsx?)$/, "");

  const extensions = [".tsx", ".ts", ".jsx", ".js"];
  for (const ext of extensions) {
    const candidate = path.join(dir, baseName + ext);
    try {
      if (fs.existsSync(candidate)) {
        return candidate;
      }
    } catch (error) {
      console.error("Error checking file:", error);
    }
  }

  return null;
}

function getOrCreateTerminal(name: string): vscode.Terminal {
  const existing = vscode.window.terminals.find((t) => t.name === name);
  return existing ?? vscode.window.createTerminal({ name });
}

function escapeQuotes(s: string): string {
  return s.replace(/"/g, '\\"');
}

export function deactivate() {}
