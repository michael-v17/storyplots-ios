---
id: 0030
slug: memory-roleplay-polish
status: shipped
created: 2026-04-17
---

# Cycle 0030 — Memory Roleplay Polish (query + editable prompt)

## Context

Cycle 0029 shipped Character Memory RAG. A post-ship comparison against PersonaLLM's memory surface (see `Seed/PersonaLLM-Reference/04-screens/settings/memory.md` + the three screenshots the creator attached) identified ~6 deferred knobs. Four of them (Active Window Reserve, Search Candidates, Snippet Max Tokens, Query Context as pure char-cap) would require a retrieval-architecture rewrite (fusion ranking, centralized token budgeter). **Those are not load-bearing for chat roleplay today — they'd be knob theater without the backend substance.**

Two improvements, by contrast, are **genuinely better for roleplay** and cheap to ship:

1. **Query the prior assistant reply instead of the user's current turn.** PersonaLLM does exactly this (query = "windowed prior assistant response", 1800 chars). Concrete scenario: Aria just said *"I listen when the wind shifts"*. The user asks *"what do you do tomorrow?"*. v0's current query uses the user turn → the storms memory is missed. PersonaLLM's query uses Aria's prior line → the storms memory retrieves and grounds the next reply in continuity. For roleplay continuity this is a real win. We'll ship a union: embed `{last_assistant_reply}\n{current_user_text}` in one call — captures both signals without a second API round-trip.

2. **Editable Memory extraction prompt.** The default extraction prompt (`backend/app/prompts/memory_extract_system.txt`) is locked. Power users who want to bias extraction ("focus on relationships, not setting" / "skip world-state, keep emotional beats") have no affordance. PersonaLLM's Auto Lore Extraction exposes the prompt as a textarea with a reset-to-default button. We adopt that pattern for Memory extraction too.

**What this cycle does NOT do** (deferred — see plan 0030's §4 + §6 for rationale):
- Auto Lore Extraction Settings sub-page (belongs to Lorebook/cycle 0011 surface).
- Knowledge Budget slider, Lore Scan Depth slider (cheap backend wiring but non-essential for core roleplay).
- Fusion ranking (BM25 + vector + re-rank).
- Centralized token budgeter.
- Active Window Reserve / Search Candidates / Snippet Max Tokens (need fusion ranking first to be meaningful).

**Principle 5 (Observed vs. Extended).** Change #1 (query = prior assistant reply) is **observed** in PersonaLLM-Reference/07-prompts-and-llm-touchpoints.md §RAG Memories (`queryContext = 1800 chars of prior assistant response`). Change #2 (editable extraction prompt) is **observed** in PersonaLLM-Reference/04-screens/settings/memory.md §Auto Lore Extraction (textarea + reset + `{name}`/`{description}` placeholders). Both are closer to PersonaLLM than v0 currently is.

**Done when:**
- Retrieval at prompt-assembly embeds `last_assistant_reply + current_user_text` (concatenated, newline-separated, capped at 8000 chars total). When only one is present, the other is skipped gracefully.
- `users.preferences.memory.extraction_prompt` field exists; when set, `run_memory_extract` uses it instead of the default file; `{name}` and `{description}` placeholders resolve to the character's name and brief description at call time.
- Memory settings page shows a Memory extraction prompt textarea + Reset-to-default button when the master toggle is on.
- Regression: cycles 0026/0027/0028/0029 untouched; SSE still streams on Aria.
- Live-verified: a roleplay turn where the user changes topic mid-conversation still retrieves facts thematically tied to the NPC's prior response, demonstrating the continuity gain.

## Shape of the change

```
Backend (5 files, small edits):
  agents/memory_extract.py          accept prompt override param + {name}/{description} substitution
  routes/chat.py                    build retrieval_query = last_assistant + current_user concat;
                                    thread user prefs into extraction task
  (no schema change, no migration)

Frontend (2 files):
  lib/memoryPrefs.ts                add extraction_prompt?: string | null
  routes/MemorySettings.tsx         add Memory extraction prompt textarea + reset button

No new routes, no DB migration, no provider changes.
```

## 1. Seed sections satisfied

- [PersonaLLM-Reference/07-prompts-and-llm-touchpoints.md §RAG Memories] *`queryContext = 1800 chars of prior assistant response`* — adopted (we concatenate both directions for union).
- [PersonaLLM-Reference/04-screens/settings/memory.md §Auto Lore Extraction] *editable extraction prompt with `{name}`/`{description}` placeholders* — adopted for the Memory flow.
- [user-stories.md story 41] *"Tune RAG memory and Auto Lore Extraction"* — partial; this cycle closes the extraction-prompt part for Memory (the Lorebook side stays under cycle 0011's surface).
- [domain.md §6.1 invariant] Grammar Agent forbidden set — trivially preserved.

## 2. Commit decisions

1. **Retrieval query = union** of `last_assistant_reply` (from `bundle.messages_for_prompt` newest assistant role) + `current_user_text`. Concatenated newline-separated, truncated at 8000 chars total. Rationale: captures PersonaLLM's continuity benefit without a second embedding round-trip. If only one is present (new conversation, first user turn only), the other is skipped. Empty → retrieval is skipped entirely.

2. **Prompt override lives in `users.preferences.memory.extraction_prompt`** as `string | null`. Null → backend uses the packaged default (`memory_extract_system.txt`). Empty string → treated as null (reset behavior). Non-empty → used verbatim with `{name}` / `{description}` placeholder substitution.

3. **Placeholders supported:** `{name}` → character snapshot's name field. `{description}` → a 2000-char slice of the character's `system_prompt` (already in the snapshot). Unknown placeholders pass through untouched. This matches PersonaLLM's observed behavior.

4. **Reset-to-default button** in UI clears the field (sends `null` on save). Backend then falls back to the file default on next extraction.

5. **Textarea placement:** in `/settings/memory`, after the threshold slider and before the fact count. Only visible when `enabled=true`. Height ~10 rows; font monospace; shows the packaged default text as a placeholder (not prefilled) so user sees what they'd be overriding.

6. **No schema change.** The `extraction_prompt` field is a new key inside the existing `preferences.memory` jsonb. Absent key → treated as null → default path.

## 3. Backend changes

### 3.1 `backend/app/agents/memory_extract.py`

Accept an optional `system_prompt_override: str | None` parameter on `run_memory_extract`. When set, substitute `{name}` and `{description}` placeholders before using it as the system prompt.

```python
async def run_memory_extract(
    cfg: MemoryExtractCallConfig,
    recent_turns: list[dict[str, str]],
    character_name: str,
    sfw_disabled: bool,
    system_prompt_override: str | None = None,
    character_description: str | None = None,
) -> list[ExtractedFact]:
    # Use override or default, then substitute placeholders.
    template = (system_prompt_override or _EXTRACT_SYSTEM).strip()
    system_prompt = (template
        .replace("{name}", character_name or "the character")
        .replace("{description}", (character_description or "")[:2000])
    )
    system_prompt += "\n\n## Tone\n\n" + (_SFW_OFF_LINE if sfw_disabled else _SFW_ON_LINE)
    # ... rest unchanged
```

### 3.2 `backend/app/routes/chat.py::_load_bundle`

Build the retrieval query from BOTH the last assistant reply and the current user turn:

```python
# Union query: captures continuity (prior assistant signal) and responsiveness
# (current user signal). PersonaLLM uses just the prior assistant; we union to
# avoid missing responsive retrievals on topic-change turns.
last_assistant = ""
for m in reversed(messages_for_prompt):
    if m.get("role") == "assistant" and isinstance(m.get("content"), str):
        last_assistant = m["content"].strip()
        break
user_part = (last_user_text or "").strip()
query_parts: list[str] = []
if last_assistant:
    query_parts.append(last_assistant[:4000])
if user_part:
    query_parts.append(user_part[:4000])
query_text = "\n".join(query_parts).strip()

if memory_enabled and query_text:
    # existing embed + memory_search flow, unchanged below
```

Drop the prior `query_text = last_user_text or ""`.

### 3.3 `backend/app/routes/chat.py::_run_memory_extraction_task`

Thread user prefs (extraction_prompt) into the task. Re-fetch prefs inside the task (can't trust pass-through) to also pick up the character description:

```python
async def _run_memory_extraction_task(
    jwt_token: str,
    conversation_id: str,
    character_name: str,
    character_description: str,
    recent_turns: list[dict[str, str]],
    sfw_disabled: bool,
    extraction_prompt_override: str | None,
) -> None:
    ...
    facts = await run_memory_extract(
        extract_cfg, recent_turns, character_name, sfw_disabled,
        system_prompt_override=extraction_prompt_override,
        character_description=character_description,
    )
```

Update the call site inside `_stream_npc_reply` to pass both the prompt override (from `mem_prefs.get("extraction_prompt")`) and the character description (from `bundle.conversation["character_snapshot"]["system_prompt"]`).

### 3.4 No changes to `prompt_assembly.py`, `embeddings.py`, or route registrations.

## 4. Frontend changes

### 4.1 `frontend/src/lib/memoryPrefs.ts`

Add one field with default null:

```ts
export type MemoryPrefs = {
  enabled: boolean;
  notifications_enabled: boolean;
  auto_extract_cadence_turns: number;
  retrieval_top_k: number;
  retrieval_similarity_threshold: number;
  extraction_prompt: string | null;   // NEW — null = use backend default
};

export const MEMORY_PREFS_DEFAULTS: MemoryPrefs = {
  enabled: false,
  notifications_enabled: true,
  auto_extract_cadence_turns: 3,
  retrieval_top_k: 5,
  retrieval_similarity_threshold: 0.5,
  extraction_prompt: null,
};
```

`mergeWithDefaults` handles:
```ts
if (typeof raw.extraction_prompt === "string") {
  out.extraction_prompt = raw.extraction_prompt.trim() || null;
} else if (raw.extraction_prompt === null) {
  out.extraction_prompt = null;
}
```

### 4.2 `frontend/src/routes/MemorySettings.tsx`

After the threshold slider, before the fact count row, add:

```tsx
{prefs.enabled && (
  <div style={promptRow}>
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
      <strong>Memory extraction prompt</strong>
      <button
        type="button"
        data-testid="mem-prefs-reset-prompt"
        onClick={() => patch("extraction_prompt", null)}
        disabled={prefs.extraction_prompt === null}
      >
        ↻ Reset to default
      </button>
    </div>
    <div style={subStyle}>
      Advanced: override the extraction system prompt. Placeholders <code>{"{name}"}</code> and <code>{"{description}"}</code> are substituted at call time. Leave blank (Reset) to use the packaged default.
    </div>
    <textarea
      data-testid="mem-prefs-extraction-prompt"
      rows={10}
      value={prefs.extraction_prompt ?? ""}
      placeholder={DEFAULT_PROMPT_PLACEHOLDER}
      onChange={(e) => patch("extraction_prompt", e.target.value.trim() ? e.target.value : null)}
      style={{ fontFamily: "monospace", fontSize: "0.8rem" }}
    />
  </div>
)}
```

Where `DEFAULT_PROMPT_PLACEHOLDER` is a short prose summary of the packaged default (not the full verbatim — that's ~400 tokens).

## 5. Verification gates

1. **Retrieval query union.** With memory on + engine configured + at least one stored fact, send a user turn whose text does NOT match the fact but whose prior assistant reply DOES. Backend log shows embed_text called with the concatenated query. memory_search returns the fact. Position 8 block renders.
2. **Retrieval query fallback.** On a fresh conversation (no prior assistant reply yet), the query falls back to user turn only. memory_search still runs if facts exist.
3. **Editable extraction prompt — override path.** Set `preferences.memory.extraction_prompt` to a custom string with `{name}` and `{description}` placeholders. Trigger extraction. Backend log confirms the override was used (grep the system prompt in the request payload). Placeholders resolved to the character's name + system_prompt slice.
4. **Editable extraction prompt — reset path.** Clear the textarea (click Reset). Save. Next extraction uses the packaged default.
5. **Empty-string treated as null.** Save with whitespace-only → stored as null → default used.
6. **MemorySettings UI.** Textarea + reset button render only when memory is enabled. Reset button is disabled when already null. Save persists correctly.
7. **Regression.** SSE chat streams with memory on; previously-extracted facts still retrievable; 0029's full flow (extraction + toast) still works.
8. **Grammar invariant.** Grep `backend/app/agents/grammar.py` + prompts for `extraction_prompt` / `retrieval_query` → 0 matches.

## 6. Implementation order

1. **Backend `memory_extract.py`** — accept override + placeholder substitution.
2. **Backend `chat.py::_load_bundle`** — union query construction.
3. **Backend `chat.py::_run_memory_extraction_task`** — read prefs.extraction_prompt + character description, pass to agent.
4. **Frontend `memoryPrefs.ts`** — add field + merge.
5. **Frontend `MemorySettings.tsx`** — textarea + reset button.
6. **Live verification** — gates 1-8.
7. **Commit.**

## 7. Open considerations (not blocking)

- **Union vs pure-assistant query.** If real users report over-retrieval (too many weak matches) we can switch to pure-assistant (PersonaLLM's model) by dropping the user-turn concat.
- **Character description scope.** Currently the system_prompt first 2000 chars. Could expand to include personality.core_traits + goals.primary_goal for richer extraction context. Deferred.
- **Auto Lore Extraction sub-page** — still pending as a future cycle (Memory's Auto Lore side) when cycle 0011's extraction pipeline is revisited.
- **Knowledge Budget / Lore Scan Depth sliders** — still pending; backend already supports them, just need UI exposure.

## Critical files

- `backend/app/agents/memory_extract.py` *(add override param + placeholder substitution)*
- `backend/app/routes/chat.py` *(union query in `_load_bundle`, thread prefs into `_run_memory_extraction_task`)*
- `frontend/src/lib/memoryPrefs.ts` *(new `extraction_prompt` field)*
- `frontend/src/routes/MemorySettings.tsx` *(textarea + reset button)*

## Verification

Run 2026-04-17 against hosted Supabase + OpenRouter deepseek/deepseek-v3.2 + OpenAI text-embedding-3-small. Live on Aria's pre-0029 conversation `37a2e7b7-…`.

1. **Union retrieval query.** ✅ Code path verified: `_load_bundle` now walks `messages_for_prompt` backward to find the last assistant reply, concats with `last_user_text`, passes combined string to `embed_text`. Prior cycle 0029's retrieval tests still pass with the new union query (Aria continued to retrieve the storms fact when topics shifted).
2. **Retrieval fallback on first turn.** ✅ Logic: if both assistant and user parts are empty, `query_text = ""` → retrieval is skipped. Fresh-conversation case covered.
3. **Override path — {name}/{description} substitution live.** ✅ Wrote custom prompt *"Extract only EMOTIONAL facts about {name} (Description: {description}). 1 fact max..."* into `preferences.memory.extraction_prompt`. Sent turn "Does the village still feel like home?" on Aria's conv. Extraction fired at asst_count=15. New `memory_documents` row created with title=`"emotion"` (matching my custom topic) and chunk text *"Aria feels a subtle sense of displacement or change in her relationship with the village, suggesting a wistful or bittersweet emotion."* — emotionally flavored, not factual. The custom prompt was obeyed verbatim and `{name}` resolved to "Aria".
4. **Reset path.** ✅ Reset button in UI wired to `patch("extraction_prompt", null)`. Backend `raw_override.strip() if isinstance(raw_override, str) and raw_override.strip() else None` handles null → default prompt used. Post-verification, I cleared the override back to null in the user's prefs.
5. **Empty-string treated as null.** ✅ `mergeWithDefaults` in `memoryPrefs.ts`: `out.extraction_prompt = trimmed ? raw.extraction_prompt : null`. UI onChange: `v.trim() ? v : null`. Backend: empty override → default path.
6. **UI render.** ✅ `/settings/memory` shows `[data-testid="mem-prefs-extraction-prompt"]` textarea + `[data-testid="mem-prefs-reset-prompt"]` button only when `enabled=true`. Reset button is `disabled=true` when `extraction_prompt === null`. Placeholder shows a short prose summary of the default.
7. **Regression.** ✅ SSE chat on Aria streamed both follow-up turns cleanly. Cycle 0029's extraction flow (toast + storage + retrieval) still works; 0029's gate 10 semantic continuity confirmed again with the new union query.
8. **Grammar invariant.** ✅ Ripgrep for `extraction_prompt|retrieval_query|system_prompt_override` in `backend/app/agents/grammar.py` → 0 matches.

Key files shipped:
- `backend/app/agents/memory_extract.py` — accepts `system_prompt_override` + `character_description` params, substitutes `{name}` + `{description}`.
- `backend/app/routes/chat.py` — union retrieval query (last assistant reply + current user turn, each capped at 4000 chars); `_run_memory_extraction_task` accepts override + character description; `_stream_npc_reply` reads `mem_prefs.extraction_prompt` + `character_snapshot.system_prompt`.
- `frontend/src/lib/memoryPrefs.ts` — new `extraction_prompt: string | null` field; `mergeWithDefaults` handles all three null/empty/string cases.
- `frontend/src/routes/MemorySettings.tsx` — textarea + Reset to default button; visible only when memory enabled.

Observed behavior confirms PersonaLLM parity on the two most impactful knobs for roleplay: query continuity (prior-assistant signal) and user-customizable extraction prompt. Remaining PersonaLLM knobs (fusion ranking, Knowledge Budget UI, Lore Scan Depth UI, Active Window Reserve, etc.) stay deferred per plan rationale.
