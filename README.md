# Jest Coverage CodeLens

Extensión de VSCode que agrega CodeLens encima de `describe`, `it`, `test` con opciones para:

- **Run**: Ejecutar solo ese test
- **Run with coverage**: Ejecutar con reporte de cobertura
- **Run with coverage + open**: Ejecutar con cobertura y abrir el reporte en el navegador

## Configuración

```json
{
  "jestCoverageLens.jestCommand": "pnpm jest",
  "jestCoverageLens.coverageDir": "coverage",
  "jestCoverageLens.openCommand": "open"
}
```

## Desarrollo

```bash
pnpm install
pnpm run build
# Presiona F5 para probar
```
