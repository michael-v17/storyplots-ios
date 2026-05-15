---
id: 0059
slug: character-card-metadata
status: shipped
created: 2026-04-19
---

# Cycle 0059 — Character card metadata

## Context

El creador pidió que en Home/Characters los cards muestren:
- icono del tipo (roleplay / assistant)
- cantidad de conversaciones
- última vez usado ("now", "1h", "2d")

Referencia directa: [PersonaLLM-Reference/04-screens/home.md](../Seed/PersonaLLM-Reference/04-screens/home.md) §State B "Chat-bubble icon + comment count (inferred: number of existing conversations with this character)" y §State D trailing chat-bubble count. El screenshot PersonaLLM del creador muestra además el icono de máscaras (roleplay) + reloj + tiempo relativo.

StoryPlots ya tiene `character.mode: "roleplay" | "assistant"` y `conversations.last_message_at`. Lo único que falta es una query agregada y el markup.

## Seed sections satisfied

- [Seed/ux.md](../Seed/ux.md) §4 Home/Characters screen.
- [Seed/PersonaLLM-Reference/04-screens/home.md](../Seed/PersonaLLM-Reference/04-screens/home.md) §State B + §State D.

## Done when

- [x] `lib/characterStats.ts` (new): `loadCharacterStats(userId) → Map<charId, { count: number; lastAt: string | null }>` con un solo query agrupado.
- [x] `lib/relativeTime.ts` (new): helper compartido extraído de RecentChats (`"now" | "Nm" | "Nh" | "Nd" | "Nw"`).
- [x] `RecentChats.tsx` migra al helper compartido.
- [x] `Characters.tsx` carga `characterStats` en paralelo con list + prefs (`Promise.all` de 3), pasa `stats` a los 3 layouts.
- [x] `CharacterCard.tsx` (grid): footer con mode icon (🎭 roleplay, 💬 assistant) + 💬 count + ⏱ time.
- [x] `CharacterListRows.tsx` (list): trailing stats pegadas a la derecha.
- [x] `CharacterCirclesList.tsx` (circles): sin metadata — density-first per reference §State C.
- [x] `npx tsc --noEmit` verde.
- [x] Playwright @ 1440×900: visible tile stats para Evelyn (5 convs, recent) y otros.

## Out of scope (deferido)

- "Example" tag visual en StoryPlots (`is_example` existe pero no se pintó porque en el seed no forma parte de las especificaciones v0; pendiente de decisión).
- Context menu long-press (no soportado por el seed v0).

## Verification

- TypeScript limpio.
- Live verificado.
