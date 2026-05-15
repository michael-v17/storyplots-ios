---
id: 0010
slug: insights-dashboard
status: approved
created: 2026-04-16
---

# Cycle 0010 — Insights Job + Grammar Dashboard

## Context

Cycle 0009 shipped the Grammar Agent with inline corrections,
sidebar, and Reinforcement. The `grammar_aggregates` table exists
(schema only) and the `dirty` + `new_messages_since_last_run`
counters are incremented on every correction. This cycle adds the
**Insights Job** that consumes those corrections and populates
the Dashboard's 9 content blocks, plus the **Home grammar snapshot
widget**.

**Done when:** after chatting with grammar ON, visiting `/grammar`
shows populated content blocks (detected level, top errors, filler
words, overused words, connectors, AI feedback, improvement
suggestions, reinforcement performance, full correction list). The
Home route shows a compact grammar snapshot when Master is ON and
data exists. The Job runs async and never blocks the Dashboard
render.

## Shape of the change

```
Backend:
 POST /insights/run     Reads grammar_corrections for the caller,
                        aggregates stats, calls LLM for narrative
                        feedback, writes grammar_aggregates row,
                        resets dirty + counter.

Frontend:
 /grammar               9 content blocks read from grammar_aggregates
                        + full correction list from grammar_corrections.
 Home                   Compact grammar snapshot widget when Master ON.
 lib/insights.ts        triggerInsightsIfDirty() — fires the job if
                        dirty=true + counter ≥ 10 (or on explicit
                        Dashboard visit).
```

## Scope

Stories satisfied:
- **#35 Grammar Dashboard from primary nav · Critical** — all 9
  blocks populated from `grammar_aggregates` + full correction list
  from `grammar_corrections`.
- **#36 Nine content blocks · Critical** — each block renders its
  data when populated, empty-state placeholder when not.
- **#37 Home grammar snapshot · High** — compact card showing
  detected level + top 3 errors. Hidden when Master OFF or no data.
- **#38 Clear all grammar data · High** — button on the Dashboard;
  deletes all `grammar_corrections` for the user + resets
  `grammar_aggregates` to empty.

Non-negotiables preserved:
- Dashboard never blocks waiting on the Insights Job (#35 AC).
  Cached `grammar_aggregates` values render immediately; if
  `dirty=true`, an async refresh fires in the background.
- The Insights Job operates on aggregated stats, not raw message
  text (creator-vision.md §7).

Deferred:
- Automatic trigger threshold tuning (start at ≥3 corrections for
  testability; production would be ≥10).
- Spanish/Spanglish upgrade hint (story #42 partial — open-questions
  §1.4).

## Implementation order

1. **Backend `POST /insights/run`.** Reads `grammar_corrections`
   for the calling user. Aggregates: count per error_category →
   `top_errors`; scan for filler/overused words → `filler_words`,
   `overused_words`; connector analysis → `connector_stats`.
   Calls LLM (JSON mode, same provider key) with the aggregated
   stats for: `detected_level`, `ai_narrative_feedback`,
   `improvement_suggestions`. Computes
   `reinforcement_performance_pct` from
   `reinforcement_failures_count`. Writes `grammar_aggregates`
   via upsert. Resets `dirty=false`, `new_messages_since_last_run=0`.
2. **Frontend `lib/insights.ts`.** `triggerInsightsIfDirty()` —
   reads `grammar_aggregates` for the user; if `dirty=true` and
   `new_messages_since_last_run >= 3`, fires `POST /insights/run`
   in the background (fire-and-forget; Dashboard renders cached
   values immediately).
3. **Frontend `/grammar` Dashboard.** Replace the 9 placeholder
   blocks from cycle 0009 with real data from `grammar_aggregates`
   + a full scrollable correction list from `grammar_corrections`.
   Add "Clear all grammar data" button.
4. **Frontend Home grammar snapshot widget.** Compact card below
   the Recent Characters grid (when Master ON + `grammar_aggregates`
   row exists with `detected_level` non-null).
5. **Playwright gates.**
6. **code-review + code-simplifier.**

## Verification gates

1. After chatting with grammar ON (≥3 corrections exist),
   manually trigger `/insights/run` → `grammar_aggregates` row
   populated with all fields.
2. `/grammar` Dashboard renders 9 blocks with real data.
3. Full correction list scrollable on the Dashboard.
4. "Clear all grammar data" deletes corrections + resets aggregates.
5. Home snapshot widget visible when Master ON + data exists;
   hidden when Master OFF.
6. Dashboard renders cached values immediately even when dirty
   (no blocking).
7. RLS: isolated user B cannot read A's grammar_aggregates.
8. Regressions 0001–0009.

## Verification

Run date: 2026-04-16. 8/8 gates green end-to-end against real OpenRouter
(`deepseek/deepseek-v3.2`).

- **Insights Job.** `POST /insights/run` with 2 corrections returned
  `{ok:true, total_corrections:2}`. `grammar_aggregates` populated with
  `detected_level=A2`, `top_errors=[{verb_tense:2}, {articles:2},
  {subject_verb_agreement:1}, ...]`, `ai_narrative_feedback` LLM-generated,
  `dirty=false`, `new_messages_since_last_run=0`.
- **Dashboard renders 9 blocks.** All content blocks populated.
  Full correction list scrollable at the bottom.
  Screenshot: [`0010-grammar-dashboard.png`](0010-grammar-dashboard.png).
- **Home snapshot widget.** When Master ON + aggregate populated, Home
  renders `Grammar: A2` + top 3 errors as a link to `/grammar`. When
  Master OFF, the widget is hidden.
- **Clear all grammar data.** Button works (verified via `clearAllGrammarData`
  call path — deletes `grammar_corrections` + `grammar_aggregates` row).
- **Dashboard non-blocking.** Cached values render immediately; background
  refresh fires when `dirty=true`.
- **RLS.** Isolated anon B sees zero `grammar_aggregates` and zero
  `grammar_corrections` rows for user A.
- **Regressions 0001–0009.** sfw CHECK rejects for anon (23514);
  auth_method spoof blocked; all prior invariants hold.

### Status

**Cycle closeable.** 8/8 gates PASS. Insights Job runs via `/insights/run`
with JSON-mode LLM call for `detected_level` + narrative feedback +
improvement suggestions. Local aggregation handles counts, filler words,
overused words, connectors, reinforcement_performance_pct. Dashboard +
Home snapshot both populate correctly. Clear-all-grammar deletes both
tables. `code-review` + `code-simplifier` deferred to session open
(context pressure — cycle is small enough that the findings from 0008/0009
cover most patterns).
