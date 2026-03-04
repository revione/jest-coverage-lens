export interface RunOptions {
  coverage: boolean;
  openBrowser: boolean;
}

export interface RunnerBuildInput {
  baseCmd: string;
  relativeSpecFile: string;
  pattern: string;
  options: RunOptions;
  relativeSourceFile: string | null;
  coverageDir: string;
  openCmd: string;
}
