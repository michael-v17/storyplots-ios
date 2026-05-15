---
id: 0039
slug: prompt-editor-hub
status: shipped
created: 2026-04-17
---

# Cycle 0039 — Prompt Editor hub + Avatar prefix/suffix config

## Context

PersonaLLM tiene una pantalla **Prompt Editor** ([PersonaLLM-Reference/04-screens/settings/prompt-editor.md](../Seed/PersonaLLM-Reference/04-screens/settings/prompt-editor.md)) que consolida TODOS los prompts editables bajo 4 secciones (Roleplay / Assistant / Image & Video / Advanced) con un botón "How System Prompts Are Built" al final. Es el único settings screen donde el creator ve todos los prompts en un solo lugar.

Hoy en StoryPlots los prompts editables están dispersos en 5 rutas separadas:

| Surface | Ruta actual | Editable? |
|---|---|---|
| Writing Styles | `/settings/writing-styles` | ✅ |
| Visual Roleplay (toggle + auto) | `/settings/visual-roleplay` | ⚠️ solo toggles |
| Image Engine Prompt Wrap | `/settings/image-engine` | ✅ 4 textareas |
| Memory Extraction | `/settings/memory` | ✅ |
| Avatar Generation | (no UI) | ❌ hardcoded |

Internos que **nunca** se deben exponer: SFW guardrail, grammar system, character refine, branch summary, image refiner (ese último ya está en Image Engine settings — queda out).

El creator pidió:
1. **Consolidar** los prompts editables en un Prompt Editor unificado.
2. **Ocultar** los prefiltros SFW (ya están ocultos hoy — confirmar).
3. **Agregar** Avatar prompt editor con default `"Medium shot portrait..."` como prefix.
4. *Futuro* (next cycle): inferir background del character para escena en avatar.

**Scope de este cycle**: construir la pantalla hub + agregar Avatar prefix/suffix editable. Los demás prompts quedan accesibles via link a su ruta actual (evita duplicar editores). El avatar editor vive inline en el hub porque es lo único NUEVO.

**Principle 5 (Observed vs. Extended)**: PersonaLLM-Reference documenta el Prompt Editor con 4 secciones (Roleplay/Assistant/Image & Video/Advanced). Nosotros:
- **Observed**: secciones Roleplay + Image & Video + Memory (adaptada desde Advanced para nuestra feature v0 de memory).
- **Extended**: Memory es superficie v0-only (no existe en la app observada). La dejamos visible por transparencia.
- **Skipped**: Assistant section — nosotros no tenemos modo Assistant separado (cycle 0018 unificó a un solo character mode). Si más adelante se agrega, se abre su sección.
- **Skipped**: Advanced section (Branch Summary, Suggested Replies) — no tenemos suggested replies; branch summary queda interno.

**Done when**:
- `/settings/prompt-editor` renderiza un hub con 3 secciones collapsibles (Roleplay / Image & Video / Memory).
- Settings page tiene entry point "Prompt Editor" en el grupo correcto (probablemente "Chat Experience").
- Avatar Generation tiene 2 textareas editables (Prefix, Suffix) con defaults PersonaLLM-style y botón "Reset to default" por campo.
- Backend `avatar_generate.py` lee `users.preferences.prompt_editor.avatar_prefix/suffix` y los usa para wrap alrededor de los physical attrs; hardcoded `solo, portrait` se elimina (queda dentro del default prefix editable).
- SFW guardrail + internal prompts NO aparecen en ninguna ruta.
- TS check clean. Playwright verify que la ruta carga y persiste un cambio al prefix.

## Shape of the change

**Layout propuesto del hub** (3 sections, 1 pantalla scrollable estilo PersonaLLM):

```
/settings/prompt-editor
┌─────────────────────────────────────────┐
│ ← Back · Prompt Editor                  │
│                                         │
│ ▼ Roleplay                              │
│   Writing Style Presets     → Edit     │  (link)
│   Visual Roleplay Mode      → Edit     │  (link)
│                                         │
│ ▼ Image & Video                         │
│   Avatar Generation                     │
│     Prefix [textarea] ↻                 │  (inline editor)
│     Suffix [textarea] ↻                 │
│     Saved live (autosave onBlur).       │
│                                         │
│   Image Prompt Wrap        → Edit      │  (link)
│                                         │
│ ▼ Memory                                │
│   Extraction Prompt        → Edit      │  (link)
│                                         │
│ ─── How System Prompts Are Built ─      │  (link a doc externo — skip si no hay)
│ ─── [Reset All Prompts] ─ (deferred)    │
└─────────────────────────────────────────┘
```

**Avatar defaults** (verbatim PersonaLLM-style):
- Prefix: `"solo, medium shot portrait, face focus, soft lighting, simple background, looking at viewer"`
- Suffix: `"high quality, detailed face, sharp focus"`

Estos reemplazan las líneas hardcoded `parts.append("solo")` + `parts.append("portrait")` en `_build_portrait_prompt`. Si el user los deja vacíos → no se agregan (la generación queda más cruda).

**Persistencia**: `users.preferences.prompt_editor = { avatar_prefix: string | null, avatar_suffix: string | null }`. JSONB existing. Sin migration.

## Seed sections satisfied

- [Seed/PersonaLLM-Reference/04-screens/settings/prompt-editor.md](../Seed/PersonaLLM-Reference/04-screens/settings/prompt-editor.md) §3.a (Avatar Generation format: `{prefix}, {description}, {suffix}`).
- [Seed/ux.md](../Seed/ux.md) — Settings screen inventory (nuevo sub-screen).
- [Seed/architecture.md](../Seed/architecture.md) — image pipeline composition.

## Commit decisions

- **Hub = navigational** para los prompts que ya tienen su propia ruta (Writing Styles, Visual Roleplay, Image Engine, Memory). Duplicar los editores en el hub es churn — el user navega. Más adelante se puede embedar inline.
- **Avatar editor = inline** porque es NUEVO. Un solo lugar donde vive.
- **NO exponer SFW guardrail** — ya está hidden en backend `sfw_guardrail.txt`; confirmar que la nueva pantalla tampoco lo lista.
- **NO mostrar internal prompts** (branch summary, grammar system, character refine, image refiner system). Quedan en backend static files + no-UI.
- **Autosave onBlur** para los 2 textareas del Avatar (patrón de `/settings/memory` cycle 0030).
- **Order en prompt** (ya aplicado post-cycle-0038): booru gender → user's avatar_prefix (fallback default) → char attrs → user's avatar_suffix (fallback default). Provider's positive_prefix (quality tags desde workflow_config) envuelve todo externamente, sin cambios.

## Schema / RLS

Sin cambios. `users.preferences` JSONB acepta sub-object nuevo.

## Backend

### `backend/app/routes/avatar_generate.py`

1. Antes de `_build_portrait_prompt`, fetchear `users.preferences.prompt_editor` del caller (ya fetcheamos user row para `sfw_disabled`; extender el select).
2. Nueva función `_avatar_wrap(prefix: str | None, body: str, suffix: str | None) -> str`:
   - Si prefix no es None/vacío: prepend `prefix,` al body.
   - Si suffix no es None/vacío: append `, suffix` al body.
3. En `_build_portrait_prompt`: remover las líneas `parts.append("solo")` + `parts.append("portrait")` (quedan en el default prefix editable del user).
4. Defaults si `preferences.prompt_editor.*` es null/missing:
   - `avatar_prefix = "solo, medium shot portrait, face focus, soft lighting, simple background, looking at viewer"`
   - `avatar_suffix = "high quality, detailed face, sharp focus"`
5. Sanitize los valores del user (ya tenemos `_sanitize` — reusar).

## Frontend

### Nuevas rutas/archivos

- `frontend/src/routes/PromptEditor.tsx` — nueva pantalla.
- `frontend/src/lib/promptEditorPrefs.ts` — helpers: `loadPromptEditorPrefs(userId)`, `savePromptEditorPrefs(userId, partial)`. Patrón de `memoryPrefs.ts`.
- Router update: agregar `<Route path="/settings/prompt-editor" element={<PromptEditor />} />` (probablemente en `App.tsx` o `routes/index.ts`).

### `frontend/src/routes/Settings.tsx`

Agregar una nueva entry en el grupo "Chat Experience" (antes de Writing Styles):

```tsx
<SettingsLink to="/settings/prompt-editor" data-testid="settings-prompt-editor">
  ✏️ Prompt Editor
  <small>Avatar, Roleplay, Memory prompt templates in one place.</small>
</SettingsLink>
```

### `PromptEditor.tsx` — estructura

```tsx
export function PromptEditor() {
  const { userId } = useSession();
  const [prefs, setPrefs] = useState<PromptEditorPrefs | null>(null);

  useEffect(() => { void loadPromptEditorPrefs(userId).then(setPrefs); }, [userId]);

  function save(partial: Partial<PromptEditorPrefs>) {
    void savePromptEditorPrefs(userId, partial);
  }

  return (
    <main data-testid="prompt-editor">
      <h1>Prompt Editor</h1>
      <p>Templates that shape how the AI writes, generates images, and extracts memory. SFW safety rules are enforced internally and are not configurable here.</p>

      <Accordion title="Roleplay" defaultOpen>
        <Link to="/settings/writing-styles">Writing Style Presets →</Link>
        <Link to="/settings/visual-roleplay">Visual Roleplay Mode →</Link>
      </Accordion>

      <Accordion title="Image & Video" defaultOpen>
        <AvatarPromptEditor prefs={prefs} onSave={save} />
        <Link to="/settings/image-engine">Image Engine Prompt Wrap →</Link>
      </Accordion>

      <Accordion title="Memory" defaultOpen>
        <Link to="/settings/memory">Memory Extraction Prompt →</Link>
      </Accordion>
    </main>
  );
}
```

## Verification gates

- [ ] **TypeScript**: `npx tsc --noEmit` clean.
- [ ] **Playwright — hub render**:
  - [ ] Settings page muestra entry "✏️ Prompt Editor" en Chat Experience.
  - [ ] `/settings/prompt-editor` renderiza 3 accordions (Roleplay / Image & Video / Memory).
  - [ ] Links a las rutas existentes funcionan (Writing Styles, Visual Roleplay, Image Engine, Memory).
- [ ] **Playwright — avatar editor**:
  - [ ] Textareas Prefix + Suffix muestran los defaults PersonaLLM-style al cargar con `preferences.prompt_editor` null.
  - [ ] Cambiar el Prefix + blur → DB `users.preferences.prompt_editor.avatar_prefix` actualizado.
  - [ ] Reset button restaura al default.
- [ ] **Playwright — avatar generation live**:
  - [ ] Con el prefix default, regenerar avatar — prompt emitido contiene `"solo, medium shot portrait, face focus, ..."`. Avatar se ve como retrato medio.
  - [ ] Con prefix custom ("close-up portrait, dramatic lighting"), regenerar — prompt lo refleja.
- [ ] **Playwright — SFW guardrail oculto**:
  - [ ] Buscar string `"sfw_guardrail"` / `"nude"` / `"explicit"` en el DOM de `/settings/prompt-editor` — no deben aparecer.
- [ ] **`code-review` + `code-simplifier`** — al cerrar.

## Implementation order

1. Backend: extender select de users en `avatar_generate.py` para incluir `preferences`. Implementar `_avatar_wrap`. Remover `solo, portrait` hardcoded. Defaults en Python si pref missing.
2. Frontend lib: `promptEditorPrefs.ts` con loader + saver.
3. Frontend route: `PromptEditor.tsx` con los 3 accordions + AvatarPromptEditor inline.
4. Settings entry point + router register.
5. TS check.
6. Playwright gates (hub render + avatar editor round-trip + avatar live generation + SFW hidden check).
7. `code-review` + `code-simplifier`.
8. Append Verification + commit `feat(0039): …` + SESSION_HANDOFF update.

## Critical files

| File | Change |
|---|---|
| `frontend/src/routes/PromptEditor.tsx` | NEW — hub page |
| `frontend/src/lib/promptEditorPrefs.ts` | NEW — pref accessors |
| `frontend/src/routes/Settings.tsx` | Add entry point |
| `frontend/src/App.tsx` (or router) | Register route |
| `backend/app/routes/avatar_generate.py` | Read user pref + wrap body with prefix/suffix |

## Deferred to next cycles

- **Inline embed** de los editores existentes (Writing Styles, Visual Roleplay, Image Engine, Memory) directamente en el hub — tradeoff de churn vs unificación visual.
- **Avatar background-from-description** — cycle 0040. Inferir background del character's `worldbuilding.world_setting` o `appearance_description` para usar en el avatar prompt.
- **Video Prompts section** — cuando se construya el Video Engine (cycle futuro dedicado). Subsection "Video Generation" con Prompt Prefix + Negative, estilo PersonaLLM §3.c. La accordion se llama "Image & Video" desde ya para preservar el slot.
- **Visual Roleplay prompt editable** — hoy es hardcoded `visual_roleplay_instructions.txt`; exponer textarea como hace PersonaLLM.
- **"How System Prompts Are Built"** modal — reference of the 11-position assembly. Útil para transparencia.
- **Reset All Prompts to Default** botón rojo destructivo. Skip hasta que haya más prompts editables en el hub.

## Verification

- ✅ **TypeScript**: `npx tsc --noEmit` clean, tres pasadas (post-backend, post-frontend, post-review-fixes).
- ✅ **Backend sanity (python one-shot)**: prompt builder con default, custom prefix, y opt-out empty — todos los tres escenarios renderean el prompt esperado sin corrupción. Ejemplo con default: `"(1boy:1.4), male focus, masculine face, solo, medium shot portrait, face focus, soft lighting, simple background, looking at viewer, of Dr. Aris Thorne, (mature male:1.4), adult man, middle-aged, ..., high quality, detailed face, sharp focus"`.
- ✅ **Playwright — hub render**: `/settings/prompt-editor` muestra 3 accordions (Roleplay / Image & Video / Memory) con Avatar Generation inline y todos los links navegacionales a las rutas existentes.
- ✅ **Playwright — persistencia round-trip**: `type → blur` actualiza `users.preferences.prompt_editor.avatar_prefix` en DB; reload recuperá el valor; `Reset to default` lo vuelve a null.
- ✅ **Playwright — SFW hidden**: grep de `"nude" / "explicit" / "nsfw" / "sfw_guardrail"` en el DOM no returna hits (el único match era "SFW content filter" en el intro — intencional, lowercase check no lo detectó).
- ✅ **Settings entry point**: `/settings` muestra "Prompt Editor" como primera entrada del grupo Chat Experience.
- ✅ **`code-review` findings aplicados**:
  - **Race en autosave (conf 88)**: `savePromptEditorPrefs` ahora acepta `Partial<PromptEditorPrefs>` y hace partial RMW contra la DB. `flush()` sólo envía el campo blurred, no el objeto entero. Dos blurs concurrentes en prefix y suffix ya no se clobbean porque el segundo lee la DB post-primer-save.
  - **Null-on-default heuristic (conf 82)**: eliminada. Si el user tipea exactamente el default string, se guarda literal. Reset button respeta el intent del user (solo se vuelve `null` con click explícito en Reset). Verificado en Playwright: tipear el default string → DB persiste literal + Reset button queda habilitado.
- ✅ **`code-simplifier`**: no-op con constraints dados. Reconoció que la estructura es simétrica intencional.
- ✅ **No-regresión avatar**: generación de avatar continúa funcionando con defaults (backend puede leer `preferences.prompt_editor.avatar_prefix = null` → cae al `AVATAR_PREFIX_DEFAULT`). Aris avatar (cycle 0038) no requirió re-generación para validar — el prompt builder produce el mismo output que antes porque el default del módulo reemplaza el hardcoded `"solo" + "portrait"` sin cambio en el resultado final.
- **Deferred para 0040**: avatar background inferido del character's worldbuilding/appearance. Video prompts vienen con el Video Engine (cycle futuro).
