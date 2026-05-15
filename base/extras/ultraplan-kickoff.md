# `/ultraplan` — Kickoff prompt

Copy and paste this as the first message in a fresh Claude Code session inside `CompareGreenField/claude-code/StoryPlots/`.

---

## Prompt

```
/ultraplan

Context: implement StoryPlots v0 against the frozen seed at ./Seed/ (local to
this folder — do not read any Seed outside this directory tree).

Before anything else, read CLAUDE.md in this folder. It is authoritative for
discipline: document precedence, the homologous PersonaLLM-Reference map,
creator-vision §8 non-negotiables, the "trivial" threshold, the plan format
and path, and the non-invention / non-omission rules. Do not start planning
without reading it. Then read Seed/README.md and Seed/creator-vision.md to
orient yourself.

Task: produce the plan for the first implementation cycle. Follow the plan
checklist in CLAUDE.md (seed citations, PersonaLLM-Reference citations where
observed behavior is replicated, user stories / flows touched, domain
invariants preserved, schema/RLS scope, UX surfaces and required states,
non-negotiables check, open questions, implementation order, verification,
done definition). Write the plan to plans/NNNN-slug.md.

Reminders (easy to skim past even after reading CLAUDE.md):
- PersonaLLM-Reference is the secondary source of truth when the seed is
  silent. Consult it BEFORE escalating to open-questions.md.
- Replicating PersonaLLM-observed behavior is NOT invention; inventing what
  neither seed nor reference covers IS.
- Omission is as bad as invention: required screens, states, flows, and
  non-negotiables are not droppable.
- Ambiguity is a defect — surface it, do not resolve it in code.

Constraints:
- Do not write code until I approve the plan. Use the "trivial" threshold in
  CLAUDE.md to decide when a plan is skippable — if in doubt, it is not.
- For any library ambiguity, query context7 before deciding on a stack detail
  the seed does not fix.
- Keep the plan small — one coherent cycle, not the whole product.
- If anything in the seed is ambiguous or contradictory (and PersonaLLM-
  Reference does not resolve it), flag it and ask me.
- All code, identifiers, comments, and commit messages must be in English,
  regardless of the language I use to talk to you.
```

---

## Usage notes

- **First cycle**: expect a minimal scaffolding plan (Next.js + Supabase + auth + one seed-defined base surface). Do not ask for full features.
- **Later cycles**: replace "first implementation cycle" with the concrete objective (e.g. "Conversation creation flow with isolated Agent").
- **If the plan invents anything** not present in the seed or PersonaLLM-Reference, stop it and ask for a direct citation — that's the early drift signal.
- **If the plan silently drops** a required screen, state, flow, or non-negotiable, stop it — non-omission is as bad as invention.
- **Explicit approval** before code. If Claude starts writing code without your OK, cancel.
