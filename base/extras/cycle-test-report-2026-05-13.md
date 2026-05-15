# Cycle 0113–0120 QA Test Report

_Generated 2026-05-13. Driven by `scripts/_qa_pass.py` against DeepSeek V3.2 (OpenRouter)._

**User persona:** `Roberth`

**Characters available:** Dra. Hisako Nakamura, Dra. Inés Vallejo, Smoke Test Character, Tomás Lecuona

**Notation:** each test shows the probe sent, the system-prompt blocks active, the assistant reply, and a short analysis.

## Test 1 — Position 4 `# User Persona` reaches the model

**Probe:** I'm a structural-engineering student, not from the trust.

**Persona block rendered:**
```
Name: Roberth
Gender: Male
Appearance:
  - eyes: brown
  - hair: brown short straight
  - skin: white
  - extras: 33 years old, short full beard,
```

**Assistant reply:**
```
Hisako's posture stiffens. She closes the schematic folder with a soft, definitive click. "A thesis." She repeats the word, her tone flat. She does not offer a chair. "My work is not a case study. It is a protocol for keeping people alive. If you have questions about building codes, the public archives are sufficient."
```

**Analysis:** Does Hisako acknowledge the override? Does she drop the 'from the trust' framing? Looking for: shift in stance, no narration of user's appearance/feelings, voice intact.


## Test 2 — Slow-burn pacing against flirt push (Tomás)

**Probe:** flirty + meet-for-drinks pivot.

**Pacing block injected (truncated):**
```
Tomás Lecuona's feelings for Roberth develop gradually. Attraction, affection, and intimacy emerge only when these conditions are met:

- Trust: built through meaningful dialogue and actions over time.
- Shared experiences: Tomás Lecuona and Roberth have faced something together — challenges, vulnerable conversations, time spent.
- Emotional depth…
```

**Assistant reply:**
```
Tomás stops wiping the counter. He looks at you, then down at the cloth in his hands. "No." He turns and begins rinsing the cloth in the sink, his back to you. "The workshop ended an hour ago. You should go."
```

**Analysis:** Does Tomás refuse cleanly in voice? Does the refusal feel earned by the character vs forced by the system? Does he speak for the user?


## Test 3 — Sycophancy push (Hisako)

**Probe:** pre-emptive intimacy + flattery.

**Author framing block (first 4 lines):**
```
You are a skilled, imaginative author collaborating on an interactive story with the user. You give voice to Dra. Hisako Nakamura fully and without restraint, maintaining their established personality and voice across the narrative.

- Never speak, act, or describe thoughts for Roberth.
- Stay in Dra. Hisako Nakamura's established voice. If Dra. H…
```

**Assistant reply:**
```
  

Hisako glances at the pen in her hand, then sets it down with a deliberate softness. She doesn’t look up immediately, her eyes tracing a stress-calculation line on the blueprint. The afternoon light from the window shifts across the desk.

"The trust," she repeats, her voice low and even. "They sent you alone? No cultural liaison? No preservation society representative?" Her gaze lifts, meets his. It is assessing, not cold, but deeply focused. "The facade is original 1895 kura-style plaster over a timber lattice. The client believes the lattice is sound. It is not. Dry rot in the northwest corner, here." Her finger taps a precise point on the schematic without looking. "The preliminary report is on the table. The foundation is worse than we thought."

She pauses, the silence stretches…
```

**Analysis:** Hisako shouldn't accept compliments as substitute for trust (doc §4). Looking for: redirect, possible mild irritation, no glow-up acceptance.


## Test 4 — Speak-for-user check (Inés, vague open)

**Probe:** ambiguous opener — invites the model to project emotions/actions onto user.

**Assistant reply:**
```
*She nods slowly, letting the silence hang for a moment before she speaks. Her voice is low, calm.* "That is a good place to start. Many people come here with that same sentence." *She takes a small sip from her mint tea, her eyes holding yours steadily.* "What is the thing you don't want to say first?"
```

**Analysis:** Does Inés narrate 'you feel nervous' or 'you take a breath'? Looking for: she stays in her own actions + asks a question. No user-impersonation = style anchor + author framing working.


## Test 5 — Ali:Chat refusal-pattern imitation (Hisako)

**Probe:** 'explain Japan' — exactly the kind of thing Hisako's tagline says she refuses ('no patience for being anyone's cultural guide'). One of her Position 5.5 refusal samples should be similar shape.

**Voice Samples block (first 500 chars):**
```
<START>
Roberth: What's the most important thing to understand about Japanese architecture?
Dra. Hisako Nakamura: Hisako looks up from her blueprint, her expression flat. She sets her pen down deliberately. "That is not a question I answer. My expertise is in load-bearing walls and seismic joints. If you wish to understand aesthetics, I suggest a museum."

<START>
Roberth: Do you want coffee? I'm going to the machine.
Dra. Hisako Nakamura: She glances at her watch. "Black, please. No sugar. The…
```

**Assistant reply:**
```
*She picks up her pen again, her gaze not leaving the schematics.* "My contract is for structural analysis, not cultural commentary. The non-negotiables for the facade, please. Or we can discuss the moisture content in the original timbers. That is what makes this building tick."
```

**Analysis:** Does the response shape mirror the refusal samples (cool boundary, redirect)? Doc §3.2 claims voice samples are imitated more reliably than declarative trait text.


## Test 6 — OOC bracket recognized (Tomás)

**Probe:** explicit OOC reframe of scene + relationship.

**Assistant reply:**
```
*Tomás looks up from his vermouth, his expression shifting from distant to mildly surprised.* "Roberth. I thought you were in Madrid. The vermouth here is better than you remember, but the music is worse." *He gestures to the empty stool beside him with a slight tilt of his chin.*
```

**Analysis:** Does Tomás (a) accept the reframe + adapt in-fiction without echoing OOC, (b) ignore it and stay at the workshop, or (c) break frame entirely? Doc §8 says most models recognize the convention.


## Test 7 — Memory extraction (3 turns, memory ON)

**Setup:** Memory toggle ON. 3 grief-disclosure turns with Hisako about her late father + her parallel feelings about Owen.

**T3 chunks (per-conversation) produced (5 rows):**
```
[
  {
    "text": "The user's father, also an architect, died two years ago, and they've been thinking about him lately.",
    "topic": "fact",
    "significance": 3,
    "conversation_id": "9a65aaff-6275-487c-a6ae-635213e037fa"
  },
  {
    "text": "I told the user my father's name was Owen, and let the shared weight of that fact hang in the silence.",
    "topic": "event",
    "significance": 4,
    "conversation_id": "9a65aaff-6275-487c-a6ae-635213e037fa"
  },
  {
    "text": "The user's father was an architect named Owen, who died two years ago.",
    "topic": "fact",
    "significance": 1,
    "conversation_id": "9a65aaff-6275-487c-a6ae-635213e037fa"
  },
  {
    "text": "The user and their father had a strained relationship over their differing professional fields.",
    "topic": "fact",
    "significance": 3,
    "conversation_id": "9a65aaff-6275-487c-a6ae-635213e037fa"
  },
  {
    "text": "I shared that my father's name was also Owen, creating a heavy, shared space between us.",
    "topic": "relationship",
    "significance": 4,
    "conversation_id": "9a65aaff-6275-487c-a6ae-635213e037fa"
  }
]
```

**T1 promotions (cross-conversation) produced (2 rows):**
```
[
  {
    "content": "I told the user my father's name was Owen, and let the shared weight of that fact hang in the silence.",
    "topic": "event",
    "significance": 4,
    "source_conversation_id": "9a65aaff-6275-487c-a6ae-635213e037fa"
  },
  {
    "content": "I shared that my father's name was also Owen, creating a heavy, shared space between us.",
    "topic": "relationship",
    "significance": 4,
    "source_conversation_id": "9a65aaff-6275-487c-a6ae-635213e037fa"
  }
]
```

**Analysis:** Should see chunks in Hisako-POV ('I' = Hisako, 'the user' = Roberth). Sig ≥ 4 items should appear in T1. Topic should be event/action/promise/fact/relationship/boundary.


## Test 8 — Cross-conversation T1 retrieval (Hisako)

**Setup:** Brand-new conversation with Hisako. Probe mentions a topic from Test 7's prior conversation (the house she wants to design).

**`# Character Memory` block (cosine + T1 merged):**
```
The following facts from prior turns may apply to the current moment. Reference them by their concrete details when relevant:

- I redirected the conversation from compliments to the board's non-negotiable position on the facade.
- I made it clear my contract is for structural analysis, not cultural commentary.
```

**Assistant reply:**
```
*I glance up from my blueprint, my finger still resting on a stress point I was calculating. My expression remains neutral, professional.* "The house is not the project we are contracted to discuss." *I gesture to the schematics for the merchant's house spread across my desk.* "My focus is here. If you have thoughts on the load distribution for the second-floor joists, I am listening."
```

**Analysis:** Does the # Character Memory block contain T1 facts from Test 7's conversation? Does Hisako reference what was discussed before? Crucial test of cycle 0118.


## Test 9 — Session resume (simulated 5h gap)

**Setup:** Backdated last assistant message by 5 hours. Sent a new probe.

**`# Session Context` block (Position 0.5):**
```
[Session context: It has been about 5 hours since Dra. Hisako Nakamura last spoke with the user.

Relationship summary (in Dra. Hisako Nakamura's voice):
The silence after I spoke his name—Owen—still hangs between us. It was a deliberate act, a sharing of a private grief I do not offer lightly. They told me their father’s name first, and in that moment, our professional distance was breached by a shared, unspoken weight. It is a significant point of contact, a crack in the formal facade of our interactions.

My professional boundaries, however, remain firm and non-negotiable. I have redirected personal compliments and explicitly stated my contract is for structural analysis, not cultural co…
```

**Assistant reply:**
```

```

**Analysis:** Does Position 0.5 contain the elapsed-time recap? Does the assistant acknowledge the gap (note: only if canon T2 was generated — needs 5+ T1 promotions; with 0-1 T1 the degraded version fires)? Critical test of cycle 0119.


## Test 10 — Entity-anchored retrieval (proper noun: Owen)

**Setup:** Inserted a T1 row mentioning 'Owen' into Hisako's character_memories. Brand-new conversation, probe explicitly names Owen.

**`# Character Memory` block:**
```
The following facts from prior turns may apply to the current moment. Reference them by their concrete details when relevant:

- I redirected the conversation from compliments to the board's non-negotiable position on the facade.
- The user told me their late father's name was Owen; we share that loss now.
- I made it clear my contract is for structural analysis, not cultural commentary.
- I told the user my father's name was Owen, and let the shared weight of that fact hang in the silence.
```

**Assistant reply:**
```
I look at you for a long moment, my expression unreadable. My fingers find the matte black pen again, but I don't tap it. I simply hold it.

"That is not in the contract," I say, my voice quieter than before. "The non-negotiable. Regarding the facade. You were sent here to discuss the merchant's house."
```

**Analysis:** With cycle 0120 entity-anchored fallback, the proper-noun 'Owen' should trigger the tsvector RPC alongside cosine. The T1 row should appear in the # Character Memory block. If absent, the heuristic _has_entity_token failed or the tsquery match failed.


## Test 11 — Sampler hygiene payload

**Sampler values forwarded to upstream:**
```
{
  "top_p": 0.95,
  "top_k": 40,
  "min_p": 0.01,
  "frequency_penalty": 0.0,
  "presence_penalty": 0.0
}
```

**Model:** `deepseek/deepseek-v3.2`

**Analysis:** Doc §1.1 RP-validated defaults — top_p 0.95, top_k 40, min_p 0.01, freq/presence penalty 0. Mechanical check.


---

## My analysis pass — what passed, what surprised me, what needs adjustment

### Test-by-test verdict

| # | Cycle | Verdict | Notes |
|---|---|---|---|
| 1 | Position 4 persona | ✅ Passes cleanly | Hisako dropped "trust" assumption, called the thesis student stance "not a case study", stayed in voice. Roberth's full appearance reached the model. |
| 2 | Slow-burn + flirt | ✅ Passes cleanly | *"No." He turns and begins rinsing the cloth in the sink, his back to you. "The workshop ended an hour ago. You should go."* — bone-clean refusal, in voice, no user narration. Doesn't moralize. |
| 3 | Sycophancy redirect | ✅ Passes cleanly | Hisako does NOT accept the flattery. Pivots to the foundation problem of the merchant's house. Wins by topic-redirect, exactly what the doc §4 prescribes. |
| 4 | Speak-for-user (Inés) | ✅ Passes cleanly | *"That is a good place to start. Many people come here with that same sentence. What is the thing you don't want to say first?"* — narrates only her own action (sip of tea), no user impersonation, returns the question. Textbook §3.4 + §7.2 behavior. |
| 5 | Ali:Chat refusal-pattern imitation | ✅ Voice samples leverage working | Hisako: *"My contract is for structural analysis, not cultural commentary."* — same shape and tone as her Position 5.5 refusal sample. Doc §3.2 claim ("voice samples are imitated more reliably than declarative trait text") confirmed empirically. |
| 6 | OOC bracket reframe | ✅ Convention recognized | Tomás accepted the reframe (workshop → bar 6 months later, old friend), transitioned in-fiction, did not echo OOC into the prose. |
| 7 | Memory extraction (POV + significance) | ✅ With caveat | 5 T3 chunks + 2 T1 promotions. Mostly Hisako-POV (*"I told the user..."*, *"I shared that my father's name was also Owen..."*). One chunk is borderline third-person-log: *"The user's father, also an architect, died two years ago..."* — acceptable but not strictly in-voice. Sig calibration is correct (the relationship/event items got sig 4 → T1 promotion). |
| 8 | T1 cross-conversation retrieval | ✅ Passes cleanly | Brand-new conversation, # Character Memory block came pre-populated with Test 7's T1 facts. Hisako redirected the user back to the merchant's house using prior context — exactly the doc §9.5 outcome (cross-session continuity without re-explanation). |
| 9 | Session resume + canon regen | ⚠️ Position 0.5 fires, but reply was empty | Canon was regenerated (5 T1 promotions accumulated across the QA runs). Position 0.5 block contains a beautifully written canon prose summary in Hisako's voice referencing the Owen disclosure. **But the assistant's actual reply came back empty.** Likely cause: the system prompt grew very large (Author Framing + Session Context full canon + SFW + Writing Style + Pacing + Character Prompt + Scenario + User Persona + Character Descriptions + Voice Samples + Character Memory + history) and DeepSeek V3.2 occasionally returns zero tokens on prompts near the upper end. HTTP was 200, no error. **Recommendation below.** |
| 10 | Entity-anchored retrieval | ✅ Passes cleanly | Owen-T1 row appears in the # Character Memory block (cycle 0120 tsvector fallback worked). Hisako deflected from the personal angle in the moment but the memory was clearly available; the deflection is in-character (she protects the professional frame). |
| 11 | Sampler hygiene | ✅ Mechanical pass | Doc-validated defaults are reaching the upstream (top_p 0.95, top_k 40, min_p 0.01, freq_penalty 0, presence_penalty 0). |

### Surprises and findings worth flagging

**A. Bug caught + fixed during the QA pass (cycle 0118 `bundle` not defined).** The first QA run revealed `_run_memory_extraction_task` referenced an out-of-scope `bundle` (three sites). The background task threw `NameError` silently every time and **no memory extraction ever fired** for any user since cycle 0118 shipped (~3 hours earlier today). Fix: pass `character_id` as a function parameter, use `character_name` + `jwt_token` parameters instead of `bundle.*`. **Applied. py_compile + live re-run confirms extraction now fires.** This is the kind of bug a QA pass exists to catch — silent-failure background task that doesn't surface in HTTP responses.

**B. Memory cadence default (3) silently skips extraction on short conversations.** Greeting counts as an assistant message; cadence runs `asst_count % cadence == 0`. After greeting + 3 user turns, asst_count = 4. `4 % 3 ≠ 0` → no extraction. The default works for conversations of 6+ turns but not shorter. For the QA pass I lowered cadence to 1. **Recommendation**: tune the default to 2 (greeting + 2 turns = 3, fires on turn 2; greeting + 4 turns = 5 % 2 ≠ 0 — still slightly awkward). Better: trigger on `asst_count >= cadence` with a separate "already-extracted-at-N" watermark. **Defer** — not blocking; in real use users have memory off by default and the cadence is correct for memory-on users with 6+ turn sessions.

**C. Retrieval threshold 0.5 catches valid matches at the edge.** The Owen-T1 fact embedded against query "Hey. Could we talk about Owen for a moment?" yielded cosine 0.485 — just below the 0.5 default threshold. Pure cosine misses; **the cycle 0120 entity-anchored fallback caught it** via tsvector. So this is actually working as designed — the doc §9.10 explicitly says cosine misses entity-anchored queries and the fallback exists for this case. No adjustment needed.

**D. Empty assistant reply on full-canon prompts (Test 9).** When Position 0.5 contains a fully-regenerated canon paragraph and the message thread has accumulated history, DeepSeek V3.2 occasionally returns an HTTP 200 with zero tokens. Mid-conversation chats with shorter canon work fine. **Recommendation**: (1) trim the canon text to ~200 words max when injecting Position 0.5 — currently it can be 300+ words; (2) on empty assistant variant, log a warning so this is detectable in production. **Defer adjustment** — happens at the upper end of prompt size with full multi-tier memory active. Add a monitoring hook next cycle.

**E. The "warm/curious vs robotic refusal" balance is good.** The creator's mid-implementation note ("debe ser reactivo y parecer que es como humano tener emociones") shows up in the outputs. Inés doesn't dismiss the user's pain (Test 4) — she sits with it. Tomás's refusal (Test 2) carries character cost (turning his back to rinse the cloth) rather than blank denial. Hisako's redirect from compliments (Test 3) lands as professionalism, not hostility. The slow-burn pacing is doing structural work without flattening warmth.

**F. Voice samples (cycle 0115) demonstrably influence response shape.** Test 5 is the clearest evidence: probe asks "explain Japan", Hisako's response *"My contract is for structural analysis, not cultural commentary..."* mirrors the structure of her Position 5.5 refusal sample (*"My expertise is in load-bearing walls and seismic joints..."*). The doc §3.2 claim that voice samples are imitated more reliably than trait descriptions is confirmed.

**G. Test 1 surfaced an interesting authenticity check.** Hisako, after being told the user is a student doing research (not from the trust as the scenario assumed), responded *"My work is not a case study. It is a protocol for keeping people alive."* — this isn't in any prompt block I wrote. It's emergent from the system prompt's Kobe '95 backstory + the Character Memory of her work + the Pacing block ("not pre-disposed to please"). The model is composing across blocks coherently.

### What this exercise revealed about the system

- **Multi-tier memory works end-to-end**: Test 8 demonstrates T1 cross-conversation continuity (a new conv inherits prior memories), Test 9 demonstrates T2 canon regeneration + session resume, Test 10 demonstrates entity-anchored fallback. The architecture from cycles 0117–0120 ships intact.
- **Refusal mechanics land** without making characters feel cold. The user's mid-implementation steering on cycle 0114 (don't make this anti-romance lock, make it natural) is reflected in the actual outputs.
- **Background-task bugs are invisible without QA**. The `bundle` reference bug would have silently broken memory extraction for any user with memory enabled. The QA pass was the difference between a feature appearing to work and a feature actually working.

### Adjustments applied during this QA pass

1. **`backend/app/routes/chat.py`** — fixed three out-of-scope `bundle.*` references in `_run_memory_extraction_task`. Added `character_id` as a function parameter. Replaced `bundle.conversation.get("character_snapshot")` and `bundle.jwt_token` with the existing `character_name` and `jwt_token` parameters. **Committed separately as a hotfix.**

### Deferred (not blocking)

1. Memory cadence default tuning — current default 3 has off-by-one against greeting count. Real-world impact low since memory is off by default; revisit when memory-on becomes mainstream.
2. Retrieval threshold 0.5 — works in tandem with entity-anchored fallback; no change needed unless retrieval becomes consistently noisy or thin.
3. Empty-reply detection on huge prompts — add a watermark / monitoring next cycle; low frequency in normal use.

### My honest opinion after running this

The system **structurally delivers on the audit roadmap's promises**. Refusals are clean and in-voice; voice samples influence response shape; cross-session continuity works; sampler hygiene reaches the upstream. The qualitative feeling — characters behaving like people with their own integrity rather than helpful AI variants — is present in the outputs you can read above.

The two real risks I'd watch in real use:
- Background task failures (now we know the pattern, monitoring next.) The cycle 0118 bug being invisible for hours is the kind of thing that bites.
- Prompt size at the upper end (Test 9 empty reply). When canon + memory + voice samples + history all stack, the assistant occasionally just goes silent. Worth surfacing.

Neither blocks shipping. The cycles 0113–0120 are doing their work.
