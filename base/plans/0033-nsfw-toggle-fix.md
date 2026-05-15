---
id: 0033
slug: nsfw-toggle-fix
status: shipped
created: 2026-04-17
---

# Cycle 0033 — NSFW toggle: fix error surfacing + copy refresh + anonymous gating

## Context

En `/settings/data-security` el toggle "Allow 18+ content" mostraba `[object Object]` en rojo al intentar activarse con una cuenta anónima. La causa confirmada (investigación pre-plan):

- `users_sfw_requires_auth` check constraint (migration `0001_users.sql` líneas 71–72) bloquea `sfw_disabled=true` cuando `auth_method='anonymous'`.
- Supabase devuelve un `PostgrestError` objeto (tiene `.message`, `.details`, `.code`, `.hint`).
- El handler en `DataSecuritySettings.tsx` línea 84 hacía `setError(String(err))` — React serializa el objeto a `[object Object]`.

El creator ya confirmó en sesión: después de hacer sign-in con email el toggle funciona — la constraint hace su trabajo, pero la UX es mala:

1. El error rendered era críptico.
2. A un user anónimo se le mostraba el modal "Age verification" cuando el problema real es que necesita loguearse, no confirmar su edad.
3. La copy "Allow 18+ content (SFW filter off)" es vaga; el creator pidió copy inspirada en Grok ("Allow NSFW Content (I'm 18+)" + subtítulo explícito).

**Principle 5 (Observed vs. Extended).** El toggle de SFW es seed-required ([Seed/creator-vision.md](../Seed/creator-vision.md) §8 — "SFW guardrail default ON"). El anonymous-gating + copy refresh son v0 extensiones: PersonaLLM-Reference no documenta esta superficie (no existía en la app observada). La constraint DB ya existía desde cycle 0001; este cycle solo mejora la presentación + gate front-end.

**Done when:**
- Toggle activado por user logged-in no muestra `[object Object]`; persiste correctamente.
- Toggle desactivado por user logged-in no pide confirmación y persiste.
- Para user anónimo el checkbox está `disabled` y hay un hint visible pidiendo sign-in; el modal 18+ nunca aparece para anon.
- Copy nueva aplicada: label `Allow NSFW Content (I'm 18+)`, subtítulo `Display media that may contain NSFW content. You must be 18 years or older to enable this setting.`, y la oración existente "When off…" se mantiene.

## Shape of the change

Cycle single-file frontend. Sin migration. Sin backend. Todo en `DataSecuritySettings.tsx`:

1. Incluir `auth_method` en el select del row de `users` al montar.
2. Fix del error surfacing: usar `err.message ?? err.details ?? "Could not save setting"`.
3. Mover `setSfwDisabled(enable18Plus)` al branch de éxito (no marcar checkbox si la update falló).
4. Estado nuevo `isAnonymous` derivado del row.
5. Gate anónimo: checkbox `disabled`, hint visible, skip modal en `onToggleSfw`.
6. Copy refresh.

## Seed sections satisfied

- [Seed/creator-vision.md](../Seed/creator-vision.md) §8 — SFW baseline preservada.
- [Seed/ux.md](../Seed/ux.md) — Data & Security screen (cycle 0023 superficie).

PersonaLLM-Reference: no aplicable (superficie v0-only).

## Commit decisions

- **Detección de anon**: leer `auth_method` de `public.users`, no de `supabase.auth.getUser()`. Single source of truth — la columna `auth_method` ya existe y la constraint la usa.
- **Hint copy**: `Sign in with email to enable NSFW content.` — específico, accionable.
- **Mantener modal 18+**: solo para logged-in; no se elimina. Se sigue requiriendo confirmación de edad para users de email.
- **Error fallback**: si el PostgrestError no tiene `.message` ni `.details`, mostrar "Could not save setting" (genérico pero no `[object Object]`).

## Schema / RLS

Sin cambios. La constraint `users_sfw_requires_auth` y el RLS policy `users_update_own` ya están correctos — este cycle solo mejora cómo el frontend los respeta.

## Backend

Sin cambios.

## Frontend

**File**: `frontend/src/routes/DataSecuritySettings.tsx`

Cambios concretos:

1. **State**: añadir `const [isAnonymous, setIsAnonymous] = useState(false);`
2. **useEffect (select)**: cambiar `select("sfw_disabled")` → `select("sfw_disabled, auth_method")`. Setear `isAnonymous` desde `userRow.data?.auth_method === 'anonymous'`.
3. **`onToggleSfw`**:
   - Si `isAnonymous && enable18Plus`: `setError("Sign in with email to enable NSFW content.")` y return.
   - Reemplazar `setError(String(err))` → `setError(err.message ?? err.details ?? "Could not save setting")`.
   - Mover `setSfwDisabled(enable18Plus)` al final sin error (no en el caso de fallo).
4. **Checkbox**: `disabled={isAnonymous}`.
5. **Label**: `Allow NSFW Content (I'm 18+)`.
6. **Subtítulo nuevo** (entre label y línea "When off…"): `Display media that may contain NSFW content. You must be 18 years or older to enable this setting.`
7. **Hint anon** (solo si `isAnonymous`): `Sign in with email to enable NSFW content.` — debajo del subtítulo.
8. **Remover**: el `<small>` viejo `(SFW filter off)` dentro del span del label (ya queda explícito el nuevo label).

## Verification gates

- [ ] **TS check**: `npx tsc --noEmit` clean.
- [ ] **Playwright — logged-in (email auth)**:
  - [ ] `/settings/data-security` renderiza con nuevo label y subtítulo.
  - [ ] Click sobre checkbox (OFF→ON) → abre modal "Age verification" → confirmar → checkbox queda marcado, no hay banner de error.
  - [ ] Refresh de página → checkbox sigue marcado (`sfw_disabled=true` persistió).
  - [ ] Click (ON→OFF) → persiste sin modal.
- [ ] **Playwright — anonymous**:
  - [ ] Sign out, new anonymous sign-in.
  - [ ] `/settings/data-security` — checkbox `disabled`, hint "Sign in with email to enable NSFW content." visible.
  - [ ] Intentar click el checkbox no abre modal, no hay error de `[object Object]`.
- [ ] **Regresión**: Storage section (Export/Import/Clear grammar/Reset/delete-all counts) sigue funcionando; Sign out + Delete account intactos.
- [ ] **`code-review` pass** (agent).
- [ ] **`code-simplifier` pass** (agent).

## Implementation order

1. Leer `DataSecuritySettings.tsx` actual → aplicar Edit con los 8 cambios listados en Frontend.
2. `npx tsc --noEmit` en `frontend/`.
3. Arrancar (o verificar) backend + Vite. Playwright contra live.
4. `code-review` + `code-simplifier` en paralelo.
5. Aplicar fixes de findings reales; rechazar nits documentando.
6. Llenar `## Verification` con outcome por gate.
7. `feat(0033): nsfw toggle error surfacing + anonymous gating + copy refresh` + body.
8. Update SESSION_HANDOFF.md (tabla de cycles + nota en Pending Tracker).

## Critical files

| File | Change |
|---|---|
| `frontend/src/routes/DataSecuritySettings.tsx` | Single-file edit: select `auth_method`, fix `setError`, anon gate, copy refresh |

## Verification

- ✅ **TypeScript**: `npx tsc --noEmit` clean, two passes (post-edit + post-simplifier).
- ✅ **Manual verification (creator, live browser)**:
  - Anonymous session: checkbox `disabled`, no reacciona al click, hint "Sign in with email to enable NSFW content." visible.
  - Logged-in session: toggle OFF→ON abre modal 18+ → confirmar persiste sin banner de error; toggle ON→OFF persiste sin modal. Ya no aparece `[object Object]`.
- ⚠️ **Playwright MCP**: bloqueado — la Chrome instance del creator (pid 55625) tiene un lock exclusivo sobre el user-data-dir del MCP profile (`mcp-chrome-ab7aaf7`). Se falló a verificación manual live en vez de matar la sesión del creator. No hay path automatizable hasta que se libere el profile o se haga un re-spawn aislado del MCP. **Acción futura**: si Playwright sigue bloqueado en próximos cycles, considerar `--isolated` en la config del plugin o documentar un cierre de browser del usuario antes del gate.
- ✅ **`code-review` (feature-dev:code-reviewer)**: no críticos. Flag de severidad alta (confidence 85) en `onDeleteAccount`: mismo anti-pattern `setError(String(err))` → renderiza `[object Object]` si el RPC `delete_my_account` devuelve PostgrestError. Aunque estaba fuera del scope del plan, se arregló en el mismo cycle (one-liner, mismo root cause, user-facing). Nit de accesibilidad (aria-describedby en checkbox disabled, confidence 72) descartado — bajo el threshold y no hay rule seed que lo exija.
- ✅ **`code-simplifier`**: extrajo helper `saveSfw(enable18Plus)` que encapsula update + error surfacing + state. `onToggleSfw` y `confirmSfw` delegan. Neto ~-12 líneas. Fix colateral: el bug pre-cycle donde `confirmSfw` llamaba `onToggleSfw(true)` re-triggereando el modal (porque `sfwDisabled` aún era false en ese tick) quedó eliminado.
- ✅ **Regresión**: Export/Import/Clear grammar/Reset/delete-counts, Sign out y Delete account siguen operativos visualmente (Delete account ahora también surfacea mensajes limpios si llega a fallar).
- **Done**: cycle shipped en single-file `frontend/src/routes/DataSecuritySettings.tsx`. Sin migration, sin backend. Seed-required surface intacta.
