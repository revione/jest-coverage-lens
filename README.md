# Jest Coverage CodeLens

A VSCode extension that adds CodeLens above `describe`, `it`, and `test` blocks in your Jest test files, allowing you to run tests with coverage directly from your editor.

## Features

- **Run individual tests** with a single click
- **Generate coverage reports** for specific tests
- **Open coverage reports in browser** automatically
- **Smart source file detection** for accurate coverage
- **Configurable** to work with any package manager (pnpm, npm, yarn)
- **Inline CodeLens** for quick access

## Usage

CodeLens appears above each `describe`, `it`, and `test` block with three options:

1. **Run** - Execute the test without coverage
2. **Coverage** - Execute the test and generate a coverage report
3. **Browser** - Execute the test, generate coverage, and open the HTML report in your browser

![Demo](https://raw.githubusercontent.com/revione/jest-coverage-lens/main/demo.gif)

## Installation

### Quick Install

**VSCodium:**

```bash
echo "📦 Downloading..." && curl -#L https://github.com/revione/jest-coverage-lens/raw/main/jest-coverage-lens-0.1.0.vsix -o /tmp/jcl.vsix && echo "⚙️  Installing..." && codium --install-extension /tmp/jcl.vsix > /dev/null 2>&1 && rm -f /tmp/jcl.vsix && echo "✅ Done! "
```

**VSCode:**

```bash
echo "📦 Downloading..." && curl -#L https://github.com/revione/jest-coverage-lens/raw/main/jest-coverage-lens-0.1.0.vsix -o /tmp/jcl.vsix && echo "⚙️  Installing..." && code --install-extension /tmp/jcl.vsix > /dev/null 2>&1 && rm -f /tmp/jcl.vsix && echo "✅ Done! "
```

### Manual Install

1. Download the [latest .vsix file](https://github.com/revione/jest-coverage-lens/raw/main/jest-coverage-lens-0.1.0.vsix)
2. Open VSCode/VSCodium
3. Press `Ctrl+Shift+P` (or `Cmd+Shift+P` on macOS)
4. Type "Install from VSIX"
5. Select the downloaded file

## Configuration

Configure the extension in your VSCode settings:

```json
{
  // Command to run Jest (default: "pnpm jest")
  "jestCoverageLens.jestCommand": "pnpm jest",

  // Coverage output directory (default: "coverage")
  "jestCoverageLens.coverageDir": "coverage",

  // Command to open browser (default: "open" for macOS)
  // Use "xdg-open" for Linux, "start" for Windows
  "jestCoverageLens.openCommand": "open",

  // Enable/disable CodeLens
  "jestCoverageLens.enableCodeLens": true,

  // Auto-detect package manager from project
  "jestCoverageLens.autoDetectJestCommand": true
}
```

### Supported Package Managers

The extension works with any package manager. Common configurations:

- **pnpm**: `"pnpm jest"`
- **npm**: `"npm test --"`
- **yarn**: `"yarn jest"`
- **npx**: `"npx jest"`

## Requirements

- VSCode 1.85.0 or higher
- Jest installed in your project
- Node.js 18.0.0 or higher

## Supported Languages

- TypeScript (`.ts`)
- TypeScript React (`.tsx`)
- JavaScript (`.js`)
- JavaScript React (`.jsx`)

## Development

### Setup

```bash
git clone https://github.com/revione/jest-coverage-lens.git
cd jest-coverage-lens
pnpm install
```

### Build

```bash
pnpm run build
```

### Watch Mode

```bash
pnpm run watch
```

### Debug

1. Open the project in VSCode
2. Press `F5` to start debugging
3. A new VSCode window will open with the extension loaded

### Package

```bash
pnpm run package
```

This creates a `.vsix` file you can install manually.

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## Known Issues

- Source file detection might not work for non-standard project structures
- Coverage reports might not open automatically on some systems

Please report issues at [GitHub Issues](https://github.com/revione/jest-coverage-lens/issues)

## Release Notes

See [CHANGELOG.md](CHANGELOG.md) for detailed release notes.

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## Support

If you find this extension useful, please consider:

- Starring the repository
- Writing a review on the marketplace
- Reporting bugs and requesting features
- Sharing with your colleagues

## Credits

Created with ❤️ by [revione](https://github.com/revione)

---

**Enjoy!** 🚀
