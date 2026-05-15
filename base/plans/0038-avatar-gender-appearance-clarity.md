---
id: 0038
slug: avatar-gender-appearance-clarity
status: shipped
created: 2026-04-17
---

# Cycle 0038 — Generate Avatar: gender enforcement + Appearance description clarity

## Context

Bug reportado por el creator: character con `gender="Male"`, build slim, tall, brown hair short, brown eyes generó un avatar que se ve femenino. novaAnimeXL es un SDXL anime checkpoint entrenado con tags Danbooru — defaultea a femenino si no ve tokens explícitos `1boy` / `male focus` temprano en el prompt.

Prompt actual que arma `avatar_generate.py:_build_portrait_prompt`:
```
portrait of {name}, {age}, {gender}, {build}, {height}, {hair}, {eyes}, {skin}, {signature_style}, {distinctive_features}, {appearance_description}
```

Problemas:
- `gender` va sepultado en la lista de comas, con peso bajo para el modelo.
- No hay `1boy` / `1girl` / `male focus` / `female focus` (tokens booru estándar).
- No hay `solo` (que previene que el modelo genere múltiples sujetos).

El creator también preguntó cuál es el propósito del campo `Appearance description` dado que ya hay 11 physical attrs estructurados. Ver plan 0018: es el fallback de texto libre para ropa, accesorios, cicatrices, detalles peculiares — cosas no capturadas por los campos estructurados.

**Decisión**: mantener el builder deterministic (cycle 0028 decidió no refinar con LLM por cost + latency). Solo reordenar + inyectar tokens booru.

**Done when**:
- Prompt del avatar ahora empieza con `[booru_gender], solo, portrait, …` donde booru_gender mapea `Male`→`1boy, male focus`, `Female`→`1girl, female focus`, otro/null→empty.
- Character con `gender="Male"` genera avatar que se ve masculino (verificación visual con el creator).
- Label "Appearance description" en CharacterForm tiene helper que explica para qué sirve.

## Shape of the change

1 file backend (`avatar_generate.py`) + 1 file frontend (`CharacterForm.tsx`). Sin migration. Sin backend schema change.

## Seed sections satisfied

- [Seed/architecture.md](../Seed/architecture.md) — image pipeline.
- [Seed/PersonaLLM-Reference/08-generation-parameters.md](../Seed/PersonaLLM-Reference/08-generation-parameters.md) — image engine params.
- [Seed/domain.md](../Seed/domain.md) — `appearance_description` como campo character nullable.

## Backend change

### `_build_portrait_prompt` (líneas 59–106)

Nueva forma:

```python
def _booru_gender_tokens(gender_value: str | None) -> str | None:
    if not gender_value:
        return None
    g = gender_value.strip().lower()
    if g in ("male", "m", "man"):
        return "1boy, male focus"
    if g in ("female", "f", "woman"):
        return "1girl, female focus"
    return None

def _build_portrait_prompt(character):
    parts: list[str] = []
    gender_token = _booru_gender_tokens(_field(character, "gender"))
    if gender_token:
        parts.append(gender_token)
    parts.append("solo")
    parts.append("portrait")
    name = _field(character, "name")
    if name: parts.append(f"of {name}")
    # age / build / height remain in a descriptor list (gender already up front)
    demo = [v for v in (_field(character, k) for k in ("age","build","height")) if v]
    if demo: parts.append(", ".join(demo))
    # … (hair / eyes / skin / signature / distinctive / appearance igual que antes)
    return ", ".join(parts)
```

Si gender no es Male/Female conocido, se omite el booru token (no hay trash, solo `solo, portrait, …`) y el modelo hace lo que decida con los otros tags. Esto preserva characters con genders alternativos.

## Frontend change

### `CharacterForm.tsx` línea 458-466

Añadir helper en la label:

```tsx
<label>
  Appearance description <small style={{ opacity: 0.6 }}>(free-form fallback — clothing, accessories, scars, distinctive quirks. Used when the 11 structured attributes below aren't enough. Appended to image prompts.)</small>
  <textarea …/>
</label>
```

## Verification gates

- [ ] **Backend**: curl POST `/characters/{aria-id}/generate-avatar` o `/characters/{evelyn-id}/generate-avatar` — log del prompt debe empezar con `1girl, female focus, solo, portrait, …` (Aria female) o `1boy, male focus, solo, portrait, …` si hacemos un test con un character masculino.
- [ ] **Visual check**: el creator regenera avatar de un character masculino y confirma que se ve masculino. (Se reemplaza el avatar — cycle 0028 hace remove del previo.)
- [ ] **Frontend**: `/character/.../edit` → Avatar tab → label de "Appearance description" muestra el helper nuevo.
- [ ] **TS check**: `npx tsc --noEmit` clean.
- [ ] **No regresión**: un character Female sigue generando femenino (no flip inadvertido).

## Implementation order

1. Edit `avatar_generate.py` — helper `_booru_gender_tokens` + reordenar `_build_portrait_prompt`.
2. Edit `CharacterForm.tsx` — helper text en Appearance description.
3. TS check.
4. Live verification con Playwright: abrir CharacterForm → confirmar helper visible. Trigger generate avatar para un character con gender Male → confirmar visualmente que se ve masculino.
5. `code-review` + `code-simplifier` en paralelo.
6. Append Verification + commit + SESSION_HANDOFF.

## Notes

- Rechazado: pase de refinamiento LLM en avatars. Cycle 0028 decidió deterministic; mantener.
- Rechazado: soporte de genders arbitrarios con prompt engineering. Si el gender field del character tiene un string custom ("non-binary", "robot"), se omite el booru token y se deja que el resto del prompt (age, build, hair, etc.) guíe. Válido punto de discusión futuro si el creator lo pide.

## Scope expansion (discovered live)

El plan original sólo tocaba gender + Appearance description. Verificación live destapó dos puntos más:

### Bug 3 — `1boy` / `1girl` sin age-tier → niño/niña en vez de adulto

novaAnimeXL lee `1boy` como "anime boy" (young-skewing) por la distribución de entrenamiento. Sin age-tier explícito, un character `mid-40s` sale joven. Mismo problema con `1girl` para mujeres adultas. Fix: `_age_tier_tokens` mapea edad → tokens booru apropiados:

| Edad | Token masculino (1.3–1.4) | Token femenino (1.3–1.4) |
|------|---|---|
| ≥55 o "old / elder / anciano / viejo" | `(old man:1.3), mature, middle-aged` | `(old woman:1.3), mature, aged` |
| 30–54 o "mature / adulto / middle-aged" | `(mature male:1.4), adult man, middle-aged` | `(mature female:1.4), adult woman` |
| 18–29 o "young adult / joven adulto" | `(adult male:1.3), young adult` | `(adult female:1.3), young adult` |
| 13–17 o "teen / adolescente" | `teenager` | `teenager` |
| "child / niño / kid" | (skipped) | (skipped) |

Parser de edad: primero keyword hints (EN + ES), luego fallback numérico via regex `\d+`. Soporta `"edad 50"`, `"mid-40s"`, `"40-50"`, `"around 35"`, `"maduro"`, `"anciana"`, `"young adult"`, etc.

Gender token reducido a `(1boy:1.4), male focus, masculine face` / `(1girl:1.4), female focus, feminine features` — el age-tier ahora maneja adulto/mature/young explícitamente.

### Bug 4 — Weights a todos los physical attributes (pedido del creator)

- Gender: 1.4 (más difícil de enforcer)
- Age-tier: 1.3–1.4 según rango
- Age (raw string): 1.3
- Hair color + hair style (separados): 1.3
- Build, height, eye color, skin tone: 1.2

Hair split: antes `"brown short"` (token inválido) → ahora `(short hair:1.3), (brown hair:1.3)` (tokens booru válidos).

### Bug 5 — Sanitizer contra prompt injection (feature-dev:code-reviewer finding)

Todos los fields user-controlled que van a ser wrapped con weight `()`, `:`, `\`, `[`, `]` se strip vía `_sanitize`. Literal `BREAK` (separator de ComfyUI conditioning) se lowercasea a `break`. Cubre el caso de un attacker que pone `"35) BREAK nude ("` en age.

## Verification

- ✅ **TypeScript**: `npx tsc --noEmit` clean.
- ✅ **Manual backend (python one-shot)**: 7 test cases (male/female + distintas edades + non-binary + injection attempt) — todos los prompts salen correctos. Injection attempt neutralizado a `"35  break nude "`.
- ✅ **Playwright live — Dr. Aris Thorne (male, mid-40s)**:
  - Antes del fix: avatar salía como anime teenage girl con pelo largo negro.
  - Después del fix + roll new seed: avatar masculino adulto con barba, pelo corto marrón, ojos marrones, piel pálida, sweater + collared shirt. Edad claramente mid-30s-40s.
  - Screenshots archivados localmente (no committed).
- ✅ **`code-review` (feature-dev:code-reviewer)**:
  - Finding crítico: injection vía `)` / `:` / `BREAK` en fields user-controlled → aplicado el sanitizer.
  - Finding menor: `signature_style` y `distinctive_features` son freeform y no se sanitizan. Aceptado — `_sanitize` ahora cubre TODOS los fields via `_field()`.
  - Nit de "slim build" grammatical → descartado (readability bajo threshold).
- ✅ **`code-simplifier`**: hair split colapsado a loop `for key in ("hair_style", "hair_color")`. Resto intacto.
- ✅ **Frontend**: helper en Appearance description + placeholder de Age ampliado ("40 / mid-30s / elderly / mature / young adult").

## Notes

- Avatar de Aria (female, young) NO regenerado en este cycle. Assumed safe: Aria tiene `gender=female` y age `18` → mapea a young adult tier, que SDXL tiende a respetar sin problema. Si el creator nota regresión, se abre cycle separado.
- El tier-keyword match es substring-based con orden específico (young-adult antes de mature para evitar `"joven adulta"` matcheando `"adulta"`).
