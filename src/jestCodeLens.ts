import * as vscode from "vscode";
import { parse } from "@babel/parser";
import traverse from "@babel/traverse";

export type JestLensData = {
  filePath: string;
  fullNamePattern: string;
};

const JEST_FNS = new Set(["describe", "it", "test"]);

export class JestCodeLensProvider implements vscode.CodeLensProvider {
  provideCodeLenses(document: vscode.TextDocument): vscode.CodeLens[] {
    if (!isSpecFile(document.fileName)) return [];

    const text = document.getText();
    const lenses: vscode.CodeLens[] = [];

    let ast;
    try {
      ast = parse(text, {
        sourceType: "module",
        plugins: ["typescript", "jsx", "importMeta", "topLevelAwait"],
        errorRecovery: true
      });
    } catch {
      return [];
    }

    const describeStack: string[] = [];

    traverse(ast as any, {
      CallExpression: {
        enter(path: any) {
          const callee = path.node.callee;
          const fnName = getCalleeName(callee);
          if (!fnName || !JEST_FNS.has(fnName)) return;

          const firstArg = path.node.arguments[0];
          const name = getStringLiteralValue(firstArg);
          if (!name) return;

          const loc = path.node.loc;
          if (!loc) return;

          const range = new vscode.Range(
            new vscode.Position(loc.start.line - 1, loc.start.column),
            new vscode.Position(loc.start.line - 1, loc.start.column)
          );

          const full = [...describeStack, name].join(" ");

          lenses.push(
            new vscode.CodeLens(range, {
              title: "Run",
              command: "jestCoverageLens.run",
              arguments: [
                { filePath: document.fileName, fullNamePattern: full } satisfies JestLensData
              ]
            }),
            new vscode.CodeLens(range, {
              title: "Run with coverage",
              command: "jestCoverageLens.runCoverage",
              arguments: [
                { filePath: document.fileName, fullNamePattern: full } satisfies JestLensData
              ]
            }),
            new vscode.CodeLens(range, {
              title: "Run with coverage + open",
              command: "jestCoverageLens.runCoverageOpen",
              arguments: [
                { filePath: document.fileName, fullNamePattern: full } satisfies JestLensData
              ]
            })
          );

          if (fnName === "describe") {
            describeStack.push(name);
          }
        },
        exit(path: any) {
          const callee = path.node.callee;
          const fnName = getCalleeName(callee);
          if (fnName !== "describe") return;

          const firstArg = path.node.arguments[0];
          const name = getStringLiteralValue(firstArg);
          if (!name) return;

          describeStack.pop();
        }
      }
    });

    return lenses;
  }
}

function isSpecFile(filePath: string): boolean {
  return /\.(spec|test)\.(t|j)sx?$/.test(filePath);
}

function getCalleeName(callee: any): string | null {
  if (callee?.type === "Identifier") return callee.name;

  if (callee?.type === "MemberExpression" && callee.object?.type === "Identifier") {
    return callee.object.name;
  }
  return null;
}

function getStringLiteralValue(node: any): string | null {
  if (!node) return null;
  if (node.type === "StringLiteral") return node.value;
  if (node.type === "TemplateLiteral" && node.expressions.length === 0) {
    return node.quasis[0]?.value?.cooked ?? null;
  }
  return null;
}
