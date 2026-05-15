# Dev Runbook — StoryPlots iOS

> Cómo arrancar, parar, y reiniciar todo lo necesario para una sesión productiva.
> **Pre-ECC scaffold** — será sobrescrito por el `dev-runbook.md` formal generado por el bootstrap ECC (que lo deriva de `seed/tech-stack.md`).

---

## 1. Pre-requisites por máquina

Esto se hace **una sola vez** en la máquina:

```bash
# Xcode 26.3+ instalado (App Store). Verificar:
xcodebuild -version
# Esperar: Xcode 26.3 (o superior) + Build version <number>

# Apple Xcode MCP (vía xcrun mcpbridge) ya viene con Xcode 26.3+. Activar:
# Xcode → Settings (⌘,) → Intelligence → Model Context Protocol → ON

# Homebrew (probablemente ya instalado)
which brew

# IDB para ios-simulator-mcp (solo si vas a usar el #3 MCP):
brew install idb-companion
pipx install fb-idb --python python3.11

# Node + npm/pnpm para XcodeBuildMCP + ios-simulator-mcp (vienen de npx)
node --version  # >= 18
```

---

## 2. Verificar MCPs antes de codear

Al inicio de cada sesión, primer chequeo:

```bash
claude mcp list
```

Esperar **mínimo el #1** conectado, idealmente los 3 según necesidad:

```
✓ xcode: xcrun mcpbridge                             ← #1 — obligatorio
✓ XcodeBuildMCP: npx -y xcodebuildmcp@latest mcp     ← #2 — para device físico / headless
✓ ios-simulator: npx -y ios-simulator-mcp            ← #3 — para flows interactivos
```

Plus orthogonal:
```
✓ plugin:serena:serena                               ← navegación semántica de código Swift
✓ plugin:context7:context7                           ← docs actualizadas de librerías
✓ plugin:playwright:playwright                       ← solo para inspeccionar base/ web vivo
```

### Si falta el #1 (Apple Xcode MCP)

```bash
# Re-instalar:
claude mcp add --transport stdio xcode -- xcrun mcpbridge

# Y verificar Xcode esté abierto + Settings → Intelligence → MCP → ON.
```

### Si falta el #2 (XcodeBuildMCP)

```bash
claude mcp add XcodeBuildMCP -- npx -y xcodebuildmcp@latest mcp
```

### Si falta el #3 (ios-simulator)

```bash
claude mcp add ios-simulator -- npx -y ios-simulator-mcp
# Verificar IDB disponible:
which idb_companion
which idb
```

---

## 3. Workflow Xcode/simulator

### Abrir el proyecto

```bash
open /Users/michaelv/Desktop/StoryPlots/Code/storyplots-ios/storyplots.xcodeproj
```

### Compilar (vía MCP)

Cuando Claude tiene acceso a Apple Xcode MCP:
- Tool: `BuildProject` (sin flags, build el target activo).
- O directo via shell:
  ```bash
  xcodebuild build -scheme storyplots -destination "platform=iOS Simulator,name=iPhone 16 Pro,OS=26.5"
  ```

### Correr tests

Vía MCP:
- Tool: `RunAllTests`.

Directo:
```bash
xcodebuild test -scheme storyplots \
  -destination "platform=iOS Simulator,name=iPhone 16 Pro,OS=26.5" \
  -only-testing:storyplotsTests
```

### Render preview de una vista SwiftUI

Vía MCP:
- Tool: `RenderPreview <path/to/View.swift>` — retorna PNG del preview sin levantar simulador.

### Flujo interactivo en simulador (ios-simulator-mcp)

```bash
# Iniciar simulador
xcrun simctl boot "iPhone 16 Pro"
open -a Simulator

# Build + install
xcodebuild build -scheme storyplots -destination "platform=iOS Simulator,name=iPhone 16 Pro,OS=26.5"
xcrun simctl install booted /path/to/storyplots.app

# Launch
xcrun simctl launch booted com.storyplots.ios
```

Una vez la app está corriendo en el sim, `ios-simulator-mcp` puede hacer `ui_tap`, `ui_swipe`, `accessibility-tree`.

### Deploy a iPhone físico (XcodeBuildMCP)

Cable lightning/USB-C conectado al iPhone 14 Pro Max (u otro). Confirmar device aparece:

```bash
xcrun devicectl list devices
```

Build + install via MCP `install-app-device <device-id>`, o directo:

```bash
xcodebuild build -scheme storyplots \
  -destination "platform=iOS,id=<device-id-from-devicectl>" \
  -allowProvisioningUpdates
```

---

## 4. Levantar `base/` (proyecto web actual) para inspección via Playwright

> Solo cuando necesitás verificar comportamiento real del web — flujos, animaciones, edge cases visuales.
> **No es necesario para iOS daily work**. Si solo estás codeando Swift, salteá esta sección.

### Backend (FastAPI)

```bash
cd /Users/michaelv/Desktop/StoryPlots/Code/storyplots-ios/base/backend

# Primera vez:
uv sync

# Arrancar:
uv run uvicorn app.main:app --reload --port 8000
```

Health check:
```bash
curl http://127.0.0.1:8000/health
# Esperar 401 (sin JWT) o 200 con JWT válido
```

### Frontend (Vite/React)

```bash
cd /Users/michaelv/Desktop/StoryPlots/Code/storyplots-ios/base/frontend

# Primera vez:
pnpm install

# Arrancar:
pnpm dev
# Default port: 5173
```

### Auth + Supabase

`.env.local` en `base/frontend/` apunta a la Supabase configurada. Para inspección anónima (rutas públicas), no necesitás auth.

### Inspeccionar con Playwright

Desde una sesión Claude con plugin Playwright conectado:
- Navegar: `browser_navigate http://localhost:5173/sign-in`
- Snapshot: `browser_snapshot`
- Tomar imagen: `browser_take_screenshot path=/tmp/sign-in.png`

Anotar la observación en el archivo del seed que la motivó.

### Parar el web

Ctrl+C en cada terminal. O matar con:

```bash
pkill -f "uvicorn app.main:app"
pkill -f "pnpm dev"
```

---

## 5. Restart procedures

### Si Xcode se cuelga

```bash
killall Xcode
open /Users/michaelv/Desktop/StoryPlots/Code/storyplots-ios/storyplots.xcodeproj
```

### Si un simulator se cuelga

```bash
xcrun simctl shutdown all
xcrun simctl erase "iPhone 16 Pro"   # nuke si está realmente roto
xcrun simctl boot "iPhone 16 Pro"
```

### Si build falla por DerivedData corrupto

```bash
rm -rf ~/Library/Developer/Xcode/DerivedData/storyplots-*
```

### Si Apple Xcode MCP no responde

1. Cerrar Xcode.
2. `claude mcp remove xcode`.
3. Abrir Xcode → Settings → Intelligence → MCP → toggle OFF → ON.
4. `claude mcp add --transport stdio xcode -- xcrun mcpbridge`.
5. Verificar `claude mcp list` muestra ✓ Connected.

### Si el iPhone físico no aparece

```bash
# Re-pair via Xcode → Window → Devices and Simulators
# O reset trust en el iPhone: Settings → General → Reset → Reset Location & Privacy
xcrun devicectl list devices
```

---

## 6. Lo que Claude NO maneja

Estas son cosas que solo el creator hace:

- **Supabase production secrets** — `.env.local` files con keys reales.
- **Apple Developer credentials** — Apple ID, team certificates, App Store Connect API keys.
- **Push certificates** — APNs auth keys.
- **App Store Connect** — submission, screenshots, metadata.
- **TestFlight invitations** — agregar testers.
- **Bundle ID registro** — App IDs en developer.apple.com.
- **`base/`** — el proyecto web productivo es read-only. Cambios al backend requieren creator approval (y se hacen bajo `/api/v2/ios/` para no romper v1).

---

## 7. Comandos rápidos (cheat sheet)

```bash
# Verificar setup
claude mcp list
xcodebuild -version
xcrun simctl list devices

# Compilar
xcodebuild build -scheme storyplots -destination "platform=iOS Simulator,name=iPhone 16 Pro,OS=26.5"

# Test
xcodebuild test -scheme storyplots -destination "platform=iOS Simulator,name=iPhone 16 Pro,OS=26.5"

# Limpiar
xcodebuild clean -scheme storyplots
rm -rf ~/Library/Developer/Xcode/DerivedData/storyplots-*

# Simulator
xcrun simctl boot "iPhone 16 Pro"
xcrun simctl shutdown all
xcrun simctl list devices

# Device físico
xcrun devicectl list devices

# Web base/ (solo para inspección Playwright)
cd base/backend && uv run uvicorn app.main:app --reload --port 8000  # backend
cd base/frontend && pnpm dev                                           # frontend
```

---

## 8. Cambios a este archivo

Cualquier cambio al runbook se documenta acá con fecha:

```
## Changelog
- 2026-05-15 — Versión inicial pre-ECC. Cuando bootstrap ECC corra, sobrescribir con el dev-runbook.md formal generado.
```
