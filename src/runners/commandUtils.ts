function quoteArg(value: string): string {
  if (/^[A-Za-z0-9_./:@=-]+$/.test(value)) {
    return value;
  }
  return `"${value.replace(/(["\\$`])/g, "\\$1")}"`;
}

function buildCommand(baseCmd: string, args: string[]): string {
  const cleaned = baseCmd.trim();
  const separator = commandNeedsArgForwarding(cleaned) ? " -- " : " ";
  const quotedArgs = args.map(quoteArg).join(" ");

  if (cleaned.endsWith(" --")) {
    return `${cleaned} ${quotedArgs}`;
  }

  return `${cleaned}${separator}${quotedArgs}`;
}

function escapeQuotes(s: string): string {
  return s.replace(/"/g, '\\"');
}

function commandNeedsArgForwarding(baseCmd: string): boolean {
  const normalized = baseCmd.trim().replace(/\s+/g, " ");
  return /^(npm|pnpm)\s+(run\s+)?test(\s|$)/.test(normalized) || /^npm\s+exec(\s|$)/.test(normalized);
}

export { buildCommand, escapeQuotes, quoteArg };
