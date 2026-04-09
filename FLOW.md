# Flujo del Plugin: Jest Coverage CodeLens

Este documento describe el flujo real de la extensión tal como está implementada hoy.
La idea es que sirva para debuggear rápido qué parte decide el comando final y desde dónde se ejecuta.

## 1. Activación

VS Code activa la extensión por los `activationEvents` declarados en `package.json`.
Cuando eso ocurre, llama a `activate()` en `src/extension.ts`.

En `activate()` se hace lo siguiente:

1. Se crea una instancia de `JestCodeLensProvider`.
2. Se registra el provider para archivos `typescript`, `typescriptreact`, `javascript` y `javascriptreact`.
3. Se registra un listener `onDidCloseTerminal` para limpiar `terminalsByCwd`.
4. Se registran los comandos:
   - `jestCoverageLens.run`
   - `jestCoverageLens.runCoverage`
   - `jestCoverageLens.runCoverageOpen`

En esta fase no se ejecuta Jest. Solo se deja la extensión lista.

---

## 2. Generación de CodeLens

Cuando VS Code necesita los CodeLens de un archivo, llama a `provideCodeLenses()` en `src/jestCodeLens.ts`.

### 2.1 Filtro inicial

Primero se verifica si el archivo matchea:

```ts
/\.(spec|test)\.(t|j)sx?$/
```

Si no es un archivo de test, retorna `[]`.

### 2.2 Parseo del archivo

Si sí es test:

1. Lee el contenido del documento.
2. Parsea el AST con `@babel/parser`.
3. Recorre el AST con `@babel/traverse`.
4. Busca `CallExpression` cuyo callee sea `describe`, `it` o `test`.

### 2.3 Construcción de los botones

Por cada `describe`, `it`, `test` y variantes tipo `describe.only`, `it.only`, `test.only`:

1. Toma el primer argumento si es string o template literal sin expresiones.
2. Crea un `Range` en la línea de inicio del nodo.
3. Construye el payload:

```ts
{
  filePath: document.fileName,
  fullNamePattern: name
}
```

4. Agrega el botón `Run`.
5. Si el proyecto no usa `react-scripts`, también agrega `Coverage` y `Browser`.

### 2.4 Detalle importante

Existe un `describeStack`, pero hoy no se usa para componer el nombre completo.
Eso significa que `fullNamePattern` actualmente es solo el nombre local del nodo encontrado, no la cadena completa `describe > it`.

En otras palabras:

- Hoy: `fullNamePattern = "renders correctly"`
- No hoy: `fullNamePattern = "Checkout form renders correctly"`

Eso es importante porque afecta directamente qué le pasamos a Jest en `--testNamePattern`.

---

## 3. Click en Run / Coverage / Browser

Cada CodeLens dispara uno de estos comandos:

- `jestCoverageLens.run`
- `jestCoverageLens.runCoverage`
- `jestCoverageLens.runCoverageOpen`

Los tres terminan llamando a `runJest()` en `src/extension.ts`, cambiando solo estas opciones:

```ts
{ coverage: false, openBrowser: false }
{ coverage: true, openBrowser: false }
{ coverage: true, openBrowser: true }
```

---

## 4. Resolución del contexto de ejecución

Dentro de `runJest()` se calcula todo lo necesario para lanzar el comando correcto.

### 4.1 `specFile`

Sale de `data.filePath`, que viene desde el CodeLens.

### 4.2 `projectRoot`

Se obtiene con `findProjectRoot(specFile)` en `src/utils/project.ts`.

La función sube directorios hasta encontrar el `package.json` más cercano.
No necesariamente devuelve la raíz del monorepo; devuelve el directorio del primer `package.json` que encuentra hacia arriba.

### 4.3 `executionRoot`

Se calcula así:

```ts
projectRoot ?? workspaceFolderDelArchivo ?? null
```

Este valor es crítico porque:

- define desde qué `cwd` se ejecuta Jest
- define contra qué carpeta se calculan los paths relativos del spec y del source file

Esto fue importante para arreglar proyectos `react-scripts`, donde ejecutar desde el directorio incorrecto rompía la resolución de `package.json`.

### 4.4 Configuración de usuario

Se leen estas settings:

- `jestCoverageLens.jestCommand`
- `jestCoverageLens.autoDetectJestCommand`
- `jestCoverageLens.coverageDir`
- `jestCoverageLens.openCommand`

---

## 5. Resolución del comando base

La lógica vive en `resolveBaseCommand()` en `src/extension.ts`.

### 5.1 Si `autoDetectJestCommand` está apagado

Retorna directamente `jestCoverageLens.jestCommand`.

### 5.2 Si está prendido

Lee el `package.json` del `projectRoot` y revisa:

1. `scripts.test`
2. el package manager detectado por `detectPackageManager()`

`detectPackageManager()` en `src/utils/project.ts` busca hacia arriba:

1. `packageManager` en `package.json`
2. `pnpm-lock.yaml`
3. `yarn.lock`
4. `package-lock.json` o `npm-shrinkwrap.json`

### 5.3 Regla actual

Si detecta `react-scripts test`, usa comando directo del runner:

- `pnpm exec react-scripts test`
- `yarn react-scripts test`
- `npm exec react-scripts test`

Si detecta `jest`, usa comando directo de Jest:

- `pnpm jest`
- `yarn jest`
- `npm exec jest`

Si no encuentra un caso claro, cae al comando configurado por el usuario.

### 5.4 Motivo de esta decisión

Antes el flujo caía a `pnpm test` / `npm test`.
Eso era más frágil porque `scripts.test` del proyecto podía inyectar flags propios como `--coverage`.

Ahora la extensión intenta ir directo al binario cuando reconoce Jest o CRA para que los flags que agrega la extensión tengan prioridad real.

---

## 6. Detección de `react-scripts`

La lógica vive en `isReactScriptsCommand()` en `src/runners/reactScriptsRunner.ts`.

Retorna `true` si pasa cualquiera de estas dos cosas:

1. `baseCmd` ya contiene `react-scripts` y `test`
2. `package.json` contiene `react-scripts test` en `scripts.test`

Esta detección se usa para decidir:

- qué builder de comando usar
- si se deben desactivar `Coverage` y `Browser`

Nota:

- En la fase de CodeLens, la detección de proyecto `react-scripts` se hace leyendo `package.json`.
- En la fase de ejecución, también se tiene en cuenta el `baseCmd` ya resuelto.

### 6.1 Restricción actual

Para proyectos `react-scripts`, si el usuario toca `Coverage` o `Browser`, la extensión muestra un mensaje informativo y degrada la ejecución a:

```ts
{ coverage: false, openBrowser: false }
```

El motivo es que coverage/browser en CRA no es estable con el enfoque actual.

---

## 7. Construcción del comando final

Hay dos paths principales.

### 7.1 Jest normal

`buildJestCommand()` en `src/runners/jestRunner.ts`

Para `Run` genera algo con esta forma:

```bash
pnpm jest <specFile> --testNamePattern "<pattern>" --coverage=false
```

Para `Coverage`:

```bash
pnpm jest <specFile> --testNamePattern "<pattern>" --coverage --collectCoverageFrom <sourceFile>
```

Para `Browser`:

```bash
pnpm jest <specFile> --testNamePattern "<pattern>" --coverage --collectCoverageFrom <sourceFile> --coverageReporters=html && open <coverageDir>/lcov-report/index.html
```

Notas:

- El package manager real puede ser `pnpm`, `yarn`, `npm exec` o un comando custom.
- Se usa `--testNamePattern`, no `-t`.
- Si hay source file asociado, se agrega `--collectCoverageFrom`.

### 7.2 React Scripts

`buildReactScriptsCommand()` en `src/runners/reactScriptsRunner.ts`

Genera algo con esta forma:

```bash
pnpm exec react-scripts test <specFile> --testNamePattern "<pattern>" --ci --coverage=false --watch=false
```

Notas:

- Siempre fuerza `--ci`
- Siempre fuerza `--watch=false`
- Coverage/Browser no tienen flujo propio acá porque se degradan antes

---

## 8. Reglas de composición del shell

La lógica de composición vive en `src/runners/commandUtils.ts`.

### 8.1 Quote de argumentos

`quoteArg()` agrega comillas solo si hacen falta.

### 8.2 Separador normal vs ` -- `

`buildCommand()` decide si debe concatenar argumentos así:

```bash
<baseCmd> <args>
```

o así:

```bash
<baseCmd> -- <args>
```

Hoy agrega ` -- ` cuando el comando base es uno de estos patrones:

- `npm test`
- `pnpm test`
- `npm run test`
- `pnpm run test`
- `npm exec`

Esto es importante porque algunos package managers necesitan ese separador para forwardear argumentos al runner real.

---

## 9. Ejecución en terminal

La ejecución final también vive en `runJest()`.

### 9.1 Reutilización por `cwd`

`getOrCreateTerminal(executionRoot)` usa un `Map<string, vscode.Terminal>` llamado `terminalsByCwd`.

Comportamiento:

1. Si ya existe un terminal para ese `cwd`, lo reutiliza.
2. Si no existe, crea uno nuevo con:

```ts
{
  name: `Jest: ${path.basename(cwd)}`,
  cwd
}
```

3. Cuando el terminal se cierra, el listener lo elimina del `Map`.

### 9.2 Ejecución efectiva

Después:

```ts
term.show(true)
term.sendText(cmd, true)
```

Eso abre el terminal y manda el comando.

---

## 10. Búsqueda del archivo fuente para coverage

Solo aplica si `coverage === true`.

La función `findSourceFile()` intenta:

1. quitar `.spec` o `.test`
2. probar el archivo directo con la misma extensión
3. probar `.tsx`, `.ts`, `.jsx`, `.js`
4. buscar tanto en el mismo directorio como en una variante sin `__tests__`

Si encuentra un archivo fuente:

- se calcula su path relativo a `executionRoot`
- se pasa en `--collectCoverageFrom`

Si no lo encuentra:

- muestra un warning
- corre igual, pero sin coverage específico

---

## 11. Diagrama resumido

```text
activate()
  -> registerCodeLensProvider()
  -> onDidCloseTerminal()
  -> registerCommand(run)
  -> registerCommand(runCoverage)
  -> registerCommand(runCoverageOpen)

usuario abre spec/test file
  -> provideCodeLenses()
     -> parse AST
     -> detect describe/it/test
     -> create CodeLens payload { filePath, fullNamePattern }

usuario hace click
  -> runJest()
     -> findProjectRoot()
     -> resolveBaseCommand()
     -> isReactScriptsCommand()
     -> findSourceFile() si coverage
     -> buildReactScriptsCommand() o buildJestCommand()
     -> getOrCreateTerminal(executionRoot)
     -> terminal.sendText(cmd)
```

---

## 12. Puntos sensibles para debug

Si algo corre mal, normalmente el problema cae en una de estas zonas:

1. `fullNamePattern` no representa el nombre completo del test.
2. `resolveBaseCommand()` detectó mal el package manager o el runner.
3. `executionRoot` quedó mal y el comando corre desde un `cwd` incorrecto.
4. El proyecto está metiendo flags extra en su runner real.
5. `react-scripts` está reinterpretando opciones de Jest.
6. El `.vsix` instalado no coincide con el código fuente actual y `dist/extension.js` quedó viejo.

Si quieres debuggear rápido, lo más útil es inspeccionar:

- el log `console.log("🚀 Comando Jest:", cmd)`
- el valor final de `baseCmd`
- el valor final de `executionRoot`
- el `scripts.test` del proyecto real

## 13. Logs útiles

Hoy el log más útil para seguir la ejecución es:

```ts
console.log("🚀 Comando Jest:", cmd)
```

Ese log sale desde `runJest()` y permite verificar el comando exacto que la extensión está mandando al terminal.
