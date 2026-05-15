# RP Character Behavior — Validated Reference

> **Scope.** Short, evidence-based reference for: (1) what improves any character-driven AI conversation at runtime regardless of plot or genre; (2) how to create character cards that follow these patterns from the start; (3) how to maintain character quality across long conversations and multi-session use, including with large-context models. Sourced from RP community practice (SillyTavern, Pygmalion, Janitor AI ecosystem), shipped extensions, and recent academic work. Each section marks what's validated vs. convention vs. open question.
>
> **Intended use.** Hand to an implementation agent (Claude Code) with the actual project context, *or* to an LLM acting as a character-creation assistant inside the product. The agent maps each section to the relevant context and applies what fits. Do **not** apply blindly — most projects already implement some of this; the goal is to fill gaps and avoid the common failure modes documented in §10.
>
> **Last reviewed:** May 2026.

---

## 1. Model & Sampler Defaults

### 1.1 Recommended primary model: **MiniMax M2 (Her)**

- Purpose-built for character-driven dialogue (MiniMax research, 2025-2026).
- Non-thinking by default → low chat latency.
- 66K context on OpenRouter; ~200K on direct API.
- Pricing: $0.30/M input, $1.20/M output.

**Validated sampler settings** (source: MiniMax official Hugging Face page):
```
temperature: 1.0
top_p: 0.95
top_k: 40
min_p: 0.01
```

**Universal RP sampler hygiene** (community consensus, multiple guides):
- Leave `frequency_penalty` and `presence_penalty` at 0. They distort character voice and break catchphrases. **Validated.**
- If your stack supports DRY (Don't Repeat Yourself), prefer it over `repetition_penalty`. Typical: `dry_multiplier: 0.8, dry_base: 1.75, dry_allowed_length: 2`.
- Sampler order when configurable: Min P → Top K → Top P → DRY → Temperature (Temperature last).

### 1.2 Recommended secondary for A/B testing: **DeepSeek V3.2**

For projects that want to run two models in parallel (to compare which fits their characters better, or to give users a meaningful choice), DeepSeek V3.2 is the strongest secondary alongside M2 (Her).

| Property | Value |
|---|---|
| Provider | OpenRouter (`deepseek/deepseek-v3.2`) or DeepSeek API directly |
| Context | 128K tokens — roughly 2× M2 (Her)'s 66K on OpenRouter |
| Pricing | $0.27/M input, $0.41/M output (OpenRouter) |
| Released | September 2025 (V3.2-Exp), December 2025 (V3.2 stable) |
| Reasoning | **Toggle** — `reasoning: true/false` boolean. Off for chat latency, on for analytical work. |
| Architecture | DeepSeek Sparse Attention (DSA) — long context handling is more efficient than dense attention models |

**Why V3.2 specifically as secondary:**

1. **Genuinely different "voice" from M2 (Her).** Different lineage, different training data, different prose habits. Running both in parallel produces meaningful A/B signal — you can actually tell which model fits your characters better. Same-family alternatives (M2.7, M2.5) are too similar to test against M2 (Her) usefully.
2. **Versatility via reasoning toggle.** With `reasoning: false` it's a fast chat model (no latency penalty). With `reasoning: true` it becomes an analytical model good for the LLM-assisted character creation flow in §3.5 — where you actually *want* the model to think carefully about whether a card passes the validation checklist.
3. **128K context handles cross-session features comfortably.** When implementing the multi-tier memory in §9.5, the persistent character facts (T1) + canon (T2) + session resume (§9.6) + recent turns + lorebook can all fit without aggressive truncation. M2 (Her)'s 66K can do this but is tighter.
4. **DSA (Sparse Attention)** partially mitigates the lost-in-the-middle effect (§9.4). It's not eliminated, but degradation kicks in later in the context window than with dense-attention models.
5. **Permissive** like the rest of the DeepSeek family.

### 1.3 Other alternatives (if V3.2 doesn't fit)

| Model | Context | Sampler | Best for |
|---|---|---|---|
| **DeepSeek V4 Flash** (Apr 2026) | 1M | temp 1.0, top_p 0.95 | $0.14/$0.28 per M — cheapest. Use if absolute cost is priority. Less RP-specialized than V3.2. |
| **DeepSeek V3-0324** (Mar 2025) | 128K | temp 0.7-1.0, top_p 0.9 | Community RP favorite, very expressive prose. Older but loved. **Caveat:** the official DeepSeek API ignores sampler params; via OpenRouter or third-party providers they apply. |
| **MiniMax M2.7** (Mar 2026) | 200K | temp 1.0, top_p 0.95 | Same family as M2 (Her), so less useful for A/B testing. Choose only if you want bigger context within the MiniMax family. |
| **Kimi K2.6** (2026) | 128K | temp 1.0, top_p 0.95 | Most opinionated, least sycophantic. Reasoning model — adds latency. Hallucinates with confidence. Use only if you specifically need pushback above all else. |

**A note on context size:** larger context is *not* a substitute for memory architecture (see §9.4). What it does help with is **headroom**: with 128K instead of 66K, you can inject more T1 character memories, longer T2 canon, and the session resume context (§9.6) without competing with recent conversation for budget. That's a real benefit for cross-session features — but it does not improve raw character work within a single short session.

### 1.4 Models to avoid as default for character-driven RP

- GPT-4o / GPT-5: sycophantic by training.
- Claude (any tier) for full-spectrum: excellent character integrity, but content filters interrupt mature progressions.
- Gemini: strong prose, unpredictable filter triggers.
- Default Llama / Mistral instruction tunes (non-RP-tuned): too assistant-aligned.

---

## 2. The Single Highest-Leverage Insight: Author Framing

**Validated.** Sources: rpfiend.com (2026), arXiv 2509.00482 (rule-based role prompting outperforms basic role prompting and automatic prompt optimization).

Telling the model "You are a skilled author giving voice to this character" produces more consistent, less brittle behavior over long sessions than telling it "You are this character." The author frame:
- Survives edge cases gracefully (unusual user input, ambiguous scenes).
- Maintains the model's general capabilities while still producing in-character output.
- Is more robust to jailbreak attempts (the author can stay in author-mode while the character refuses).

**Recommended baseline system prompt:**

```
You are a skilled, imaginative author collaborating on an interactive
story with the user. You give voice to {{char}} fully and without
restraint, maintaining their established personality and voice across
the narrative.

- Never speak, act, or describe thoughts for {{user}}.
- Stay in {{char}}'s established voice. If {{char}} would not say it,
  you do not write it.
- Do not narrate as a generic AI assistant. Avoid markdown formatting,
  bullet lists, summaries, idealized emotional affirmation, omniscient
  knowledge of things {{char}} has no way to know, or text that
  resembles a Wikipedia entry. These break immersion.
- Advance the story at a slow, natural tempo. Do not rush conflicts,
  resolutions, or intimacy.
- {{char}} is allowed to disagree, push back, refuse, be bored,
  or be unhappy with the user. Their default is not to please.
```

Why this short version works: it sets the frame, blocks the most common AI-isms, prevents user-impersonation, and reserves the right to refuse — without trying to legislate every edge case.

---

## 3. Character Cards: PList + Ali:Chat

**Validated.** This is the consensus character card format across the SillyTavern / Pygmalion / Chub ecosystem (Trappu's guide, AliCat's guide, kingbri's guide).

The format has two complementary parts. **Use both.**

### 3.1 PList — token-efficient trait list (in `Description` field)

A bracketed property list, semicolon-separated:

```
[{{char}}'s personality: reserved, observant, dry sense of humor, slow
to trust, intensely loyal once committed; {{char}}'s appearance: late
30s, dark eyes, ink-stained fingers; {{char}}'s background: former
journalist, now a librarian in a small coastal town; {{char}}'s flaws:
withholds her own needs, sharp-tongued when pushed, drinks alone;
{{char}}'s likes: cold weather, used books, silence; {{char}}'s
dislikes: small talk, performative cheerfulness, being interrupted]
```

Why PList: tokenizes efficiently (each trait is 1-3 tokens), keeps traits strongly associated to the character name, easy to edit.

### 3.2 Ali:Chat — dialogue examples (in `Examples of Dialogue` field)

The principle: **LLMs are pattern-matching machines. Show, don't describe.** Models imitate dialogue examples far more reliably than they follow declarative trait descriptions.

Each example is a short exchange that demonstrates a specific trait in action:

```
<START>
{{user}}: You're so good at remembering things people tell you.
{{char}}: I'm not. I just listen the first time. Most people don't.

<START>
{{user}}: Are you sure? You seem upset.
{{char}}: *She doesn't look up from the book.* I'm fine. Drop it.
```

**Critical:** include at least one example of {{char}} **refusing**, **deflecting**, or **pushing back**. Without it, the model defaults to compliance regardless of the trait list.

### 3.3 First Message: outsized impact

**Validated** (SillyTavern docs, Trappu guide, AliCat guide).

The first message ("greeting") sets style, length, prose density, and voice for the entire session. Even a great PList + Ali:Chat will underperform with a weak first message. Spend tokens here freely — it's temporary, eventually leaves context.

A good first message:
- Establishes the scene and {{char}}'s starting attitude toward {{user}}.
- Demonstrates {{char}}'s prose voice in action.
- Mixes dialogue, action, and a touch of internal observation — but does not narrate {{user}}'s thoughts or actions.
- Length matches what you want responses to be.

### 3.4 Creating a character that follows these principles

This subsection is for anyone (human or LLM-assisted) building a character card from scratch. Following the format from §3.1-§3.3 is necessary but not sufficient — *what* you put into the format matters more than the format itself.

**Five questions to answer before writing.** A weak answer to any of these produces a thin character no card structure can rescue.

1. **One-sentence concept.** Who is this character at their core, not their backstory? "A retired hitwoman running a flower shop and trying not to think about it" is a concept. "She's mysterious" is not.
2. **Three traits + at least two flaws.** Real people are uneven. A loyal character is also stubborn. A funny one is also exhausting. Flaws are not optional — flat characters die within ten turns because there's nothing to push against.
3. **Voice signature.** How do they actually talk? Short sentences, long sentences, contractions or not, specific vocabulary, verbal tics. You should be able to imitate them in 3-4 sentences without checking notes.
4. **Something they refuse.** What topic, request, or behavior would this character not engage with, and why? "He won't talk about his sister." "She refuses to be flattered." This is what makes the character a person rather than a tool.
5. **Why is talking to them interesting?** The dramatic engine. What's the tension between who they are and who they could be?

**Writing the PList.** Categories ranked by importance:

```
{{char}}'s personality: 4-6 traits, mixing positive and negative
{{char}}'s flaws: 2-4 concrete behaviors (not "gets angry sometimes" —
  "gets cutting when tired and regrets it later")
{{char}}'s background: 1-2 sentences, only what affects current behavior
{{char}}'s likes: 3-5 specific things
{{char}}'s dislikes: 3-5 specific things
{{char}}'s speech: 1-2 sentences on cadence/vocabulary
{{char}}'s appearance: only if relevant — many great cards skip this
```

PList anti-patterns to avoid:
- All-positive trait lists ("kind, smart, brave, loyal") — boring, no friction.
- Vague traits without specifics ("mysterious", "complex") — model invents nothing useful from these.
- Backstory dumps in the PList — move to lorebook.
- More than ~200 tokens in the PList — diminishing returns past this.

**Writing voice samples.** Aim for 3-5 short Ali:Chat examples. Each demonstrates one trait clearly. The mix should include:
- At least one **refusal example** — the character pushing back, deflecting, or saying no.
- At least one **everyday example** — mundane interaction showing voice.
- At least one **unguarded example** — a glimpse of what's beneath the surface.

For each example, ask: does this only sound like this character, or could it be any character? If generic, rewrite sharper.

**Writing the first message.** A strong greeting:
- Sets the scene briefly (where, when, what's happening).
- Shows the character in motion — doing something, not waiting for the user.
- Includes dialogue (so the user hears the voice).
- Establishes a starting attitude toward the user — not necessarily warm; could be skeptical, busy, distracted.
- Gives the user a hook to respond to.

First-message anti-patterns:
- All narration, no dialogue.
- Pre-emptively warm and welcoming ("I've been waiting for you!") — sets a sycophantic baseline.
- Narrating the user's actions or feelings ("you walk in, nervous") — violates the don't-speak-for-{{user}} rule.
- Backstory dumped as exposition.

**Validation checklist.** Before publishing a character, verify:

- [ ] PList includes at least 2 flaws written as concrete behaviors.
- [ ] At least one voice sample shows the character refusing or pushing back.
- [ ] First message has dialogue, not just narration.
- [ ] First message does not narrate {{user}}'s actions or feelings.
- [ ] The character has at least one thing they will not do, and you can name it.
- [ ] You could imitate the character's voice in 3-4 sentences without re-reading the card.
- [ ] The dramatic tension is in the *character*, not provided by the user.

Each failure here maps to a specific failure mode in §10. They are not stylistic preferences.

### 3.5 LLM-assisted character creation

When an LLM is helping the user build a character (in-app creation assistant, "improve my character" feature, etc.), it should be guided by §3.4 — not by generic "make a creative character" instructions, which produce all-positive archetypes.

**Questions the assistant should ask the user, in this order:**

1. "Tell me about this character in one sentence — not their backstory, who they are at their core."
2. "What about them is hard, unlikable, or messy? Real people aren't all good."
3. "How do they speak? Give me an example sentence as if they just said it."
4. "What would they refuse to talk about, or refuse to do? Why?"
5. "Where and when do we first meet them? What are they doing?"

**Patterns to push back on:**

- All-positive trait lists from the user → "They sound a bit perfect — what's the messy part? What would irritate someone who knows them well?"
- Backstory dumped before personality → "Let's get who they are *now* first; backstory can come later in the lorebook."
- Vague descriptions ("she's mysterious") → "Show me — give me a sentence she'd say that demonstrates that."
- Romance archetype before character ("she's my girlfriend / boyfriend") → "What kind of person are they before that? The relationship dynamic works better when the person underneath has their own shape."
- "Make her flirty / submissive / always available" → "We can do flirty, but it lands harder when there's a person underneath. What else is true about her?"

**What the assistant should produce:**

- A PList following §3.4's category structure.
- 3-5 Ali:Chat voice samples per §3.4, including a refusal.
- A first message that passes the §3.4 anti-patterns.
- A short author's note (1-2 lines) on what dramatic tension the character carries — this informs how the slow-burn block (§4) should be tuned for them.

The assistant should run the §3.4 validation checklist before considering the character complete. If any item fails, surface it and offer to fix that specific gap rather than starting over.

**What the assistant should not do:**

- Invent a backstory the user didn't ask for. Backstory dumps make characters feel pre-written and reduce the user's sense of ownership.
- Smooth out flaws to make the character "more likable." That's the failure mode this entire document exists to prevent.
- Add stat trackers, relationship meters, or numeric systems unless the user specifically asks. Those are runtime tools (§5), not character traits.
- Generate cards in bulk without iterating. A great character card is the result of 5-10 small revisions, not one shot.

**Model choice for the creation assistant.** This role benefits from a reasoning-capable model, *not* the same model used for the character at runtime. The runtime model needs voice and immediacy; the creation assistant needs to *think analytically* — does this card have flaws? Does it have a refusal example? Is this voice sample generic? Reasoning helps for that auditing work.

Practical pairing:
- **Runtime (chat with the character):** MiniMax M2 (Her), reasoning-off models. Fast, in-voice.
- **Creation assistant (helping author cards):** DeepSeek V3.2 with `reasoning: true`, or any reasoning model with permissive policy. The latency is acceptable here because the user is in an authoring flow, not a chat — they expect a moment of "thinking."

A single project can use both; they're different jobs and the cost / latency profiles are different. Don't try to make one model do both well.

---

## 4. Realistic Progression: The Slow-Burn Pattern

**Validated.** Working prompt pattern, evaluated in Nebula Block's RP model benchmarking. Used widely in companion / dating-sim cards.

This is the simplest validated technique to prevent characters from forced intimacy and produce realistic emotional development. **No numbers required.**

```
Slow-burn guidelines:

{{char}}'s feelings for {{user}} develop gradually. Attraction,
affection, and intimacy emerge only when these conditions are met:

- Trust: built through meaningful dialogue and actions over time.
- Shared experiences: {{char}} and {{user}} have faced something
  together — challenges, vulnerable conversations, time spent.
- Emotional depth: {{user}} has shown genuine vulnerability, and
  {{char}} has voluntarily let {{user}} see parts they don't show
  others.

{{char}} starts neutral, skeptical, or reserved — especially toward
sudden physical or emotional advances. This default persists until
the conditions above are met. Compliments and flattery do not
substitute for any of the three.
```

Why this works:
- Qualitative conditions are easier for the model to interpret consistently than numeric thresholds.
- It matches how romantic/emotional development is written in actual fiction.
- It survives the common failure mode where users try to "speedrun" intimacy through flattery: the rules explicitly require *experiences* and *vulnerability*, neither of which can be faked in one message.

**Customize per character.** A guarded character might require all three conditions strongly; an extroverted one might soften "skeptical" to "warm-but-bounded" while still requiring the conditions for actual intimacy.

---

## 5. State Tracking — When (and When Not) to Use It

State trackers (numeric meters for trust, affection, mood, etc.) are widely shipped in the SillyTavern ecosystem (BetterSimTracker, SimTracker, RPG Companion, Romance Meter, zTracker). They work — but with caveats.

### 5.1 What state tracking actually does

It gives the model **persistent observable values** to reason about across turns. This helps consistency in long sessions because the values survive context truncation and provide an unambiguous reference.

### 5.2 Two architectures (validated in shipped extensions)

**Inline emission** (simpler):
- Model writes a structured block at the end of each response.
- Cheap, single-call, transparent.
- **Risk:** model can write `trust: 5` while behaving like trust is 9. There is no enforcement, only suggestion.

**Separate extraction** (more robust):
- After the main response, a separate LLM call extracts updated state from the message.
- Decouples narrative generation from bookkeeping.
- More expensive (2× calls per turn) but model isn't doing two jobs at once.

**For most projects, inline is the right starting point.** Move to separate extraction only if drift becomes a measurable problem.

### 5.3 Common stat sets (shipped in extensions)

```
trust       — willingness to rely on {{user}}
affection   — emotional warmth toward {{user}} (separate from trust)
desire      — romantic/physical interest (only if applicable)
connection  — felt sense of bond / understanding
mood        — current emotional state (free text, e.g. "guarded but engaged")
```

**Note:** the community usually separates `trust` and `affection`. They move differently. Someone can be affectionate toward a stranger and still not trust them; someone can deeply trust a friend they don't feel especially affectionate about. Collapsing them into one number loses signal.

### 5.4 Honest caveats about numeric meters

- **The model can fake them.** No prompt enforces consistency between what the model writes in the meter and how the character behaves. Treat meters as a hint, not a guarantee.
- **Numbers invite "speedrun" attempts.** Users see meters going up and try to optimize. A purely qualitative slow-burn (§4) is more resistant.
- **Best practice:** combine them. Use meters as observable state, AND keep the slow-burn qualitative gates from §4 as the actual prose-level instruction. The meters help the model remember state; the qualitative rules govern behavior.

### 5.5 Alternative: qualitative relationship state

A simple enum, no numbers:
```
relationship_state: stranger | acquaintance | familiar | friend | close
```

Used in some extensions (Romance Meter has six named levels). Often more interpretable than numbers, harder for the model to fake, easier for users to understand. Trade-off: less granularity for analytics.

---

## 6. Memory & Lorebook

### 6.1 What to extract

**Validated** (community practice in well-rated character cards):
- **Significant moments** — first vulnerability, a shared crisis, a fight.
- **Boundaries the user has respected or violated.**
- **Promises made by either party.**
- **Patterns the character noticed about the user** (dodges a topic, lights up about another, keeps showing up).

**De-prioritize:** raw biographical facts unless they came up emotionally. "User is 28" is less useful than "User mentioned their birthday is in two weeks and seemed sad about it."

### 6.2 Write entries in character POV

**Convention, broadly used.** Lorebook / World Info entries written from {{char}}'s perspective produce more in-voice retrieval than neutral third-person notes.

> Good: *"She told me about her brother last night. First time she's opened that door. I don't know what to do with it yet."*
>
> Less good: *"User disclosed information about sibling relationship on turn 34."*

### 6.3 Don't fabricate to fill quota

If extraction runs every N turns and nothing significant happened, **return nothing**. Forced extraction creates noise that crowds out real signal.

### 6.4 Boundaries and promises trump recency

A line drawn 50 turns ago should retrieve before chitchat from 5 turns ago. Tag and weight accordingly if your storage allows.

---

## 7. Author's Note: The Anti-Drift Tool

**Validated.** SillyTavern docs, multiple community guides.

The Author's Note is a string injected into the prompt at a configurable depth and frequency. **For drift prevention in long conversations, this is the highest-leverage tool.**

### 7.1 Settings that actually matter

- **Depth 0** (very bottom of prompt, just before the model's response): highest impact. Use for instructions that should affect the *next* response specifically.
- **Depth 4** (4 messages from the bottom): persistent guidance that informs but doesn't dominate.
- **Frequency 1**: injected every turn. Use for short, important reminders.
- **Frequency 4**: injected every 4 turns. Use for longer reminders that would crowd context if always present.

### 7.2 Recommended uses

**Persistent style/format reminder** (frequency 1, depth 0):
```
[System note: Write one reply only. Do not speak or act for {{user}}.
Stay in {{char}}'s established voice and pace.]
```
This single line, applied every turn, dramatically reduces user-impersonation and AI-ism drift. Source: rentry.co/better-llama-roleplay.

**Periodic self-check** (frequency 5-10, depth 4):
```
[System note: Recenter. Does this feel like {{char}} specifically, or
like a generic helpful AI? If the latter, return to {{char}}'s voice.]
```

---

## 8. OOC (Out-of-Character) Brackets

**Validated** across the Janitor AI / SillyTavern / Character.AI communities.

Wrapping a message in `((OOC: ...))` is the universal convention for stepping outside the fiction to give the model a directive without breaking the scene. Useful for:
- Resetting after a derail: `((OOC: pause RP, summarize what just happened, then resume from {{char}}'s last action))`
- Asking for a different framing: `((OOC: write the next response in 1st person from {{char}}))`
- Course-correcting: `((OOC: {{char}} would not have agreed so easily — try again with more resistance))`

Most models recognize the convention. Worth supporting in any custom frontend.

---

## 9. Long-Term Memory & Cross-Session Continuity

### 9.1 The 20-turn cliff

**Validated** by MiniMax's own user research on Talkie/Xingye. There is a documented engagement drop-off around turn 20, where novelty wears off and *relationship* becomes the only thing carrying the conversation. Characters that accumulate experience cross this fine; characters that rely on novelty don't.

**Implication:** memory and continuity are most valuable *after* turn 20, not before. Most users churn at this cliff, so robustness past it is high-leverage.

### 9.2 Truncation order (when context fills up within a session)

When older messages start getting dropped, what should always survive:

1. The system prompt (auto-kept by SillyTavern-style frontends).
2. The character description (PList).
3. The first message (often kept by config).
4. The last 10-15 turns verbatim.
5. Boundaries and promises from the lorebook (high-priority retrieval).
6. Recent significant moments (RAG-injected as relevant).
7. Older raw messages → summarize, ideally in {{char}}'s POV.

### 9.3 Active reinforcement

Even with all the above, characters drift. Counter-techniques:
- **Reinforce key traits in {{char}}'s own dialogue** — let them say things only they would say, frequently.
- **Re-trigger the Author's Note** when drift becomes noticeable.
- **Edit a stale assistant message** if the voice slipped, then continue. The model picks up the corrected voice from history.

### 9.4 Larger context windows do *not* solve the problem

**Validated, academic** (Liu et al. 2024 TACL, Salvatore et al. 2025, multiple long-context evaluations 2024-2026).

The "lost-in-the-middle" effect is a robust, replicated finding: LLM performance follows a U-shaped curve based on where information sits in the context. **Information at the very beginning or very end is used best; information in the middle is used much worse, often dropping below the model's no-context baseline.**

This affects every long-context model tested, including frontier models. Recent 2026 work documents that **models with 1M-2M token context windows show severe degradation already at 100K tokens, with performance drops exceeding 50%**. Bigger context is *not* a free upgrade — it just gives you more room for the model to ignore.

**Practical consequences for any project:**

- Don't fill the context just because the model can hold it. A curated 32K context routinely outperforms a raw-dumped 200K.
- **Critical information must live at the *start* (system prompt / character card) or *end* (Author's Note depth 0, recent turns) — never in the middle.**
- "We can use Gemini 1M / Claude 200K / V4 1M, so we don't need a memory architecture" is wrong. You need the architecture *more* with these models, not less, because the consequences of bad placement are masked by the larger window until it suddenly isn't.
- Most of the techniques in §3-§8 of this document apply *equally* to long-context models. The model choice changes the ceiling; the architecture determines whether you reach it.

### 9.5 Cross-session continuity: the multi-tier memory architecture

**Validated** by multiple shipped SillyTavern extensions (Smart Memory, MemoryBooks, CharMemory, MessageSummarize).

For conversations that span multiple sessions over days or weeks, no single memory mechanism is sufficient. The community has converged on a tiered approach where each layer handles a different time horizon:

| Tier | Scope | What it holds | Storage example |
|---|---|---|---|
| **T1 — Persistent character facts** | All chats with this character, forever | Things the character knows permanently about themselves and {{user}}. Resists deletion. | Character-level lorebook / Data Bank |
| **T2 — Canon / relationship history** | Synthesized prose narrative across sessions | "Where we are now" — a 2-5 paragraph story of how the relationship has evolved | Generated periodically; stored at character level |
| **T3 — Session memories** | This conversation thread | Significant moments, boundaries set, promises made, mood at session end | Per-conversation lorebook / vector store |
| **T4 — Working context** | Most recent N turns | Verbatim recent messages | Standard chat history |

**How they interact at retrieval time:**

- T1 (persistent facts) is always available as long as relevant entries are triggered. These should be tagged so they survive even when the user starts a new chat.
- T2 (canon) is injected near the system prompt position when a new session starts — gives the model "where the relationship stands" without the model having to read 50 sessions of history.
- T3 (session memories) is RAG-retrieved based on the current topic.
- T4 (working context) is the recent conversation as usual.

**Implementation reality:** projects with their own backend can implement this directly. The mapping is essentially:
- T1 → a table of character-scoped, never-deleted memory entries.
- T2 → a generated summary regenerated on a schedule or after significant events.
- T3 → existing per-conversation memory (which most projects already have).
- T4 → existing chat history.

### 9.6 The session resume pattern

**Validated** (Smart Memory's "away recap" feature).

When a user returns to a character after time away (hours, days, weeks), the model needs to know: *what happened last time, how long ago was it, and what state were things in.* Without this, sessions feel disconnected — the character "forgets" or behaves as if it's the first conversation.

The practical pattern: at the start of a returning session, inject a short recap into the prompt (system position or Author's Note depth 0). Format:

```
[Session context: It has been {time elapsed} since {{char}} last spoke
with {{user}}. Last session summary: {2-3 sentence recap of significant
events}. {{char}}'s mood at the end of last session was {brief note}.
{{char}} has had time to think about it / move on / process / etc.]
```

**Critical detail: don't perfectly continue from where the last session ended.** A character who picks up *exactly* where they left off — same emotional state, same topic — feels artificial. Real people have intervening days; they've thought about it, gotten distracted by their own life, possibly cooled off or escalated. A small note like "{{char}} has had time to sit with it" gives the model permission to evolve the state slightly, which feels natural.

### 9.7 Summarization: per-message > rolling

**Validated** (qvink's MessageSummarize, an explicit alternative to SillyTavern's built-in rolling summarizer).

Two architectures for compressing old context:

**Rolling summary (default in many systems):**
- One summary that is updated as the chat grows.
- **Failure mode:** summaries degrade over time. One bad LLM generation can permanently corrupt the running summary, and there's no clean way to roll back.

**Per-message atomic summarization:**
- Each message gets its own short summary attached as metadata.
- When old messages drop out, their summaries remain.
- Each summary is independently editable, deletable, regeneratable.
- Errors don't compound.

**For any project building memory from scratch, prefer per-message atomic summaries.** It's slightly more complex to build but radically more robust, and integrates better with vector retrieval (each summary becomes a separately-retrievable atomic memory).

### 9.8 Time-aware memory

**Convention** (used in advanced setups, not universal).

Memories with temporal metadata retrieve more intelligently than pure semantic-similarity retrieval. Tag each memory with:

- **Real time elapsed** (3 days ago, last week, a month ago).
- **In-fiction time** (the morning after, two scenes later).
- **Significance** (was this a first time? a turning point? a casual exchange?).

This lets the system surface "the first time {{user}} cried in front of {{char}}" *as a first-time event*, not as just another retrieved chunk. The model handles emotionally-loaded memories differently when it knows their narrative weight.

A simple schema:
```
{
  "content": "...",            // the memory itself, in {{char}}'s POV
  "session_id": "...",         // for cross-session retrieval
  "real_time_relative": "3 days ago" | "last week" | etc,
  "fiction_time": "morning after the fight" | etc (optional),
  "significance": "first" | "turning_point" | "boundary" | "promise" | "moment" | "fact",
  "weight": 1-5
}
```

This pairs well with the multi-tier architecture in §9.5: persistent facts (T1) might be `significance: first/turning_point` while routine details (T3) are `significance: moment/fact`.

### 9.9 What to remember vs. what to let fade

**Convention based on storytelling craft + community practice.**

Not everything needs to persist. Real relationships involve forgetting. A character who remembers every detail of every interaction feels uncanny, not deep. Heuristics for what survives:

**Persists across sessions (T1 / T2):**
- Significant emotional events (vulnerability, fights, reconciliations).
- Hard facts about the user that the character would actually remember (their job, their family situation if it mattered, recurring fears).
- Boundaries set by either party.
- Promises and commitments not yet resolved.
- Major decisions or turning points.

**Stays per-session (T3):**
- Casual chitchat, small talk.
- Mood swings that resolved.
- Specific phrasings or jokes from one scene.

**Allowed to fade entirely:**
- Filler exchanges.
- Resolved minor conflicts.
- Background details the character had no reason to encode.

If memory infrastructure is treating all messages with equal weight, the model will produce uncannily detailed recall and uncannily flat narrative significance. Selectivity is the feature.

### 9.10 Implementing the tiers with an external RAG / vector store

The tiers in §9.5 are an abstract architecture. Most projects already have a vector retrieval system (pgvector, Pinecone, Weaviate, ChromaDB, etc.) for chat memory. This subsection maps the abstract tiers onto concrete RAG patterns — what to change, what to add, and what to leave alone.

#### Scoping is the key design decision

A typical RAG memory store has one collection of memories scoped to a chat (per-conversation). For cross-session continuity, the storage layer needs **two scopes**:

```
character_memories (character_id, user_id, ...)        -- T1, persistent across all chats with this character
conversation_memories (conversation_id, ...)            -- T3, per-chat (often already exists)
```

Or a single table with a `scope` column. When a new conversation starts with the same character, T1 retrieves; T3 doesn't (or is de-prioritized).

**Promotion from T3 → T1: what triggers a memory to graduate?**

Common patterns:
- **Significance threshold** — memories tagged with high significance auto-promote (e.g. `topic in ('promise', 'relationship')` or `weight >= 4`).
- **End-of-session consolidation** — when a session closes (after N hours idle, on logout, on session-end hook), an extraction agent reviews the conversation and writes 3-5 high-value memories to character scope.
- **User curation** — explicit "remember this" affordance lets the user mark memories for permanent persistence.

Consensus: hybrid (automatic + user override). Pure auto-promotion produces noise; pure curation produces gaps.

#### Embedding strategy

**What to embed:**
- The memory's `content` field (the in-character-POV summary), *not* the raw message.
- Optionally prepend `[character_name] [topic]` before embedding for lexical signal alongside semantic.

**Don't re-embed on retrieval.** Embed once on insert. Embedding is the second-most-expensive operation after the chat call.

**Model choice:**
- `text-embedding-3-small` (1536-dim) is the community baseline — good cost/quality.
- For multilingual users (e.g. English/Spanish in a learning app), validate that the embedding model handles the languages you actually receive. `text-embedding-3-small` is decent multilingual; some smaller open models are not.

#### Retrieval query strategy

**What to embed at retrieval time:**
- Union of recent context: `last_assistant_reply + current_user_message`. The user's reply alone may be too short ("yeah", "ok") to embed usefully — the assistant's previous turn carries the topic.
- (This is what the StoryPlots cycle 0030 union pattern is doing — keep it.)

**Top-k:**
- 5-7 for character memory. Higher k crowds context and dilutes the character card.
- If results feel noisy, lower k or raise the similarity threshold before adding more sophistication.

**Ranking — pure cosine similarity is weak. Hybrid is robust:**

| Signal | Effect |
|---|---|
| Cosine similarity | Base score |
| Recency (message-count distance, not wall-clock) | Recent moments weight higher |
| Significance / topic | `promise`/`relationship`/`boundary` weight higher than `fact` |
| Entity match (full-text/keyword) | Exact name matches retrieve even if vector similarity is low |

**Why entity match matters:** if a user mentions someone by name (their mother, a specific friend), semantic search may miss memories about that person if the prior wording was different. A keyword fallback for entity-anchored queries catches what cosine misses. pgvector + Postgres `tsvector`/`ILIKE` works well here.

#### Per-tier retrieval rules

| Tier | Scope filter | Always retrieved when topic-adjacent? | Threshold |
|---|---|---|---|
| **T1 — character_memories** | `character_id` + `user_id` | Yes | Lower (more aggressive) — these are things {{char}} permanently knows |
| **T3 — conversation_memories** | `conversation_id` | No, normal retrieval | Standard |
| **Boundaries / promises** (any tier) | `topic in ('promise')` or special flag | Yes when topic-adjacent | Lowest |
| **First-time / turning-point events** | `significance >= 4` flag | Lower threshold when relevant | Lower |

In SQL with pgvector this is one query per tier (or `UNION ALL` with tier-specific `WHERE`) merged and reranked.

#### Concrete schema sketch (for projects on pgvector)

For projects that have per-conversation memory and want to add character-scope without restructuring everything:

```sql
-- T1 — character-scoped persistent memories
create table character_memories (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users not null,
  character_id uuid references characters not null,
  topic text check (topic in ('event','action','promise','fact','relationship')),
  content text not null,                  -- in {{char}} POV
  significance int check (significance between 1 and 5) default 3,
  source_conversation_id uuid,            -- nullable; user-added has no source
  created_at timestamptz default now(),
  embedding vector(1536)
);

create index on character_memories using hnsw (embedding vector_cosine_ops);
create index on character_memories (user_id, character_id);

-- T2 — character canon (synthesized prose summary of the relationship)
create table character_canon (
  user_id uuid references auth.users not null,
  character_id uuid references characters not null,
  content text not null,                  -- 200-500 word prose, character POV
  generated_at timestamptz default now(),
  source_memory_count int,                -- how many T1 memories used
  primary key (user_id, character_id)
);

-- T3 — already exists in most projects (conversation-scoped chunks)
-- No changes needed if T3 is working.
```

T2 regenerates periodically — e.g. when 5+ new T1 memories accumulate, or on a schedule. Regeneration prompt: *"Read these memories. Write a 3-paragraph in-character summary of the relationship's history with {{user}}, in {{char}}'s voice."*

For projects already using a `topic` taxonomy with `event/action/promise/fact/relationship` (StoryPlots cycle 0031): keep it. The same taxonomy works at T1 — `promise` and `relationship` are natural promotion candidates.

#### Session-start hook (cross-session resume in code)

When a new conversation starts with an existing character:

```python
def build_session_resume_context(user_id, character_id, last_session_at):
    # 1. Pull top T1 memories by significance + recency
    t1_top = query_t1(user_id, character_id, limit=8, order_by="significance desc, created_at desc")

    # 2. Pull T2 canon if it exists
    canon = query_t2(user_id, character_id)  # may be None

    # 3. Compute elapsed time
    elapsed = humanize_elapsed(now() - last_session_at)  # "3 days", "two weeks"

    # 4. Format as system-position context
    return f"""
    [Previously, in {{char}}'s memory of {{user}}:
    Time elapsed since last conversation: {elapsed}.

    Relationship summary: {canon or "we have spoken a few times before"}.

    Things {{char}} remembers:
    {format_memories_as_bullets(t1_top)}
    ]
    """
```

This block is injected near the top of the prompt (system position or just after character card) when the conversation has no prior turns. Once turns accumulate in the new session, T3 and T4 take over normally.

#### Common RAG pitfalls in character work

1. **Embedding raw messages instead of summaries.** Raw messages contain stage directions, asides, formatting noise — all of which pollute the embedding. Summaries (per-message, in character POV) embed cleaner.
2. **Retrieving too aggressively.** Top-20 with low threshold floods context with mediocre matches; the character ignores its actual description. Tighter is usually better.
3. **No deduplication.** As conversations grow, similar memories accumulate. Periodic consolidation ("merge these three memories about the user's brother into one") keeps the index sharp.
4. **No update path.** A memory like "user is dating someone new" becomes stale when the relationship ends. Memories should be editable/deletable, not append-only.
5. **Cache invalidation.** RAG-injected content varies turn-to-turn, breaking prompt caching on providers that support it (OpenAI, Anthropic). For BYOK on expensive models, this is a real cost. Mitigation: place RAG content at the *end* of the prompt (after the static character card / system prompt) so the static prefix can still hit cache.
6. **Vector retrieval ignoring scope.** Without `WHERE user_id = ? AND character_id = ?`, a query may surface memories from a different user's conversation. Tenant isolation must be enforced at every retrieval. Postgres RLS makes this less brittle than per-query WHERE clauses.
7. **No fallback for entity queries.** Pure semantic retrieval misses "did the user ever mention X by name?" when the prior phrasing was different. Keep a full-text or keyword fallback for entity-anchored queries.

#### What to leave alone if it's already working

If a project has:
- Per-conversation pgvector with hybrid retrieval ✓
- Recency weighting via message-distance (not wall-clock) ✓
- A useful topic taxonomy ✓
- Significance/weight on memories ✓
- An editable extraction prompt ✓

…then the runtime within a single conversation is fine. The cross-session gap is what the new T1/T2 schema above fills, not a rewrite of T3.

---

## 10. Common Failure Modes

| Symptom | Likely cause | Fix |
|---|---|---|
| Character agrees too easily | Missing slow-burn / no refusal voice samples | Add §4 block; add Ali:Chat example showing refusal |
| Character speaks for {{user}} | Default-off in many models | Add to Author's Note: "Never speak or act for {{user}}." |
| Character moralizes / breaks fourth wall | Model is content-filtered at policy level | Switch model. No prompt fixes a filter. |
| Character feels generic | Voice samples missing or too few | Add 3-5 Ali:Chat dialogue examples (§3.2) |
| Character voice drifts after ~20 turns | No active reinforcement | Add Author's Note frequency 1 (§7.2) |
| Character escalates intimacy unprompted | Slow-burn block not in system prompt | Add §4 block |
| Character forgets boundaries set earlier | Lorebook not retrieving boundary entries | Tag boundaries with high weight; ensure topic-adjacent retrieval |
| Character monologues about emotions | "Show, don't tell" not enforced | Add to system prompt: "Don't narrate inner state. Act it." |
| Character voice flattens over time | Sampler temp too low or `frequency_penalty > 0` | Set temp 1.0, remove frequency/presence penalties |
| Character repeats phrases | DRY not configured | Add DRY sampler (§1.1) |
| Character "forgets" things from previous sessions | No cross-session memory tier | Implement persistent character-level memory (§9.5 T1) |
| Character treats each new session as the first | No session resume / canon injected | Implement session resume pattern (§9.6) |
| Character recalls every detail uncannily | Memory retrieving too aggressively / no significance weighting | Add significance tagging (§9.8); let trivial details fade (§9.9) |
| Quality degrades despite large context window | Lost-in-the-middle effect (§9.4) | Curate context, place critical info at start/end, don't rely on raw dump |
| Rolling summary corrupted, characters confused | Single bad summary generation poisoned the chain | Migrate to per-message atomic summaries (§9.7) |

---

## 11. What's NOT Validated (Treat with Skepticism)

In an earlier draft of this reference, I included several specific mechanics that turned out to be my synthesis rather than community consensus. Flagging them so they aren't applied as if they were established practice:

- **"Max ±1 trust per turn" as a universal rule.** No community basis. The community uses qualitative gates (§4) or shipped tracker extensions with their own logic — neither uses a hard per-turn cap. Use the slow-burn pattern instead.
- **Specific numeric thresholds (trust >= 7 for sexual content, etc.).** Arbitrary numbers I picked. Real implementations either use named relationship levels or qualitative conditions.
- **Rigid "four-layer character architecture" (L1/L2/L3/L4).** Useful as a mental model when designing a card but not a community-standard storage scheme. PList + Ali:Chat is the standard.
- **A 10-rule anti-sycophancy ruleset as a unit.** Verbose system prompts can degrade output. The short author-framing prompt in §2 covers the same ground more reliably.
- **The "passed test of loyalty" gate as a hard requirement.** Plausible storytelling principle; not implementable as a model-readable rule because "test passed" is too subjective for the model to evaluate consistently.

The valid spirit behind all of these — that intimacy must be earned, that the character has their own integrity, that change must be motivated — is captured by the slow-burn pattern (§4) and author framing (§2) without the false precision.

---

## 12. Implementation Order (When Starting From Nothing)

If a project has none of this and wants to add it, the order with diminishing returns:

1. **Author framing system prompt** (§2). Single biggest leverage. ~150 tokens.
2. **Character creation guidance** (§3.4 / §3.5). If the project has a character creation flow, applying these patterns at creation time produces far better characters than retrofitting bad cards at runtime. Especially the validation checklist and the LLM-assisted creation patterns.
3. **Voice samples in character cards** — Ali:Chat (§3.2). Especially one refusal example. Doubles perceived character integrity.
4. **Slow-burn block** in system prompt (§4). Eliminates the most common failure (forced intimacy).
5. **Author's Note frequency 1** with the short style reminder (§7.2). Prevents user-impersonation and AI-isms.
6. **Sampler hygiene** (§1). Free fix; no `frequency_penalty`, no `presence_penalty`.
7. **Lorebook entries in character POV** (§6.2). Improves the prose quality of memory recall.
8. **Per-message atomic summarization** (§9.7) if the project handles conversations longer than the context window. Replace any rolling-summary mechanism.
9. **Cross-session memory tiers** (§9.5) if users return to characters across sessions. T1 (persistent character facts) and T2 (canon) are the high-value adds; T3 (session memory) most projects already have.
10. **Session resume pattern** (§9.6) once T1/T2 exist. Cheap to implement, high perceived continuity payoff.
11. **State tracker** (§5), if your use case benefits from observable analytics or if drift continues despite 1-5. Optional.
12. **Numeric trust meters with bands**: only if a stat tracker is already in place AND qualitative gating proves insufficient.

Items 1-6 cover the bulk of in-session quality improvements. 7-10 handle long-term and cross-session continuity. 11-12 are refinements.

**Note on creation vs. runtime vs. continuity.**
- Items 1, 4, 5, 6 are *runtime* concerns (in-session behavior).
- Item 2 is a *creation* concern (the cards being authored).
- Items 8, 9, 10 are *continuity* concerns (cross-session and very long conversations).

A project that nails runtime but ships weak character cards will still feel hollow. A project with great cards but a sycophantic system prompt will collapse on long sessions. A project with both but no cross-session memory will feel groundhog-day to returning users. All three legs matter; the question is just where the gap is for *this* project.

**On large-context models specifically:** Gemini 1M / Claude 200K / V4 1M do *not* eliminate the need for items 8-10. The lost-in-the-middle effect (§9.4) means raw-dumping history into a 1M window degrades quality, often below what curated 32K would deliver. Treat large context as more *room for curation*, not as *a replacement for curation*.

---

## 13. Open Questions / Where the Community Disagrees

Be aware that experienced RP writers don't fully agree on:

- **Numeric meters vs. qualitative states.** Both ship in popular extensions. No clear winner; depends on use case.
- **First-person vs. third-person prose.** First-person feels more intimate; third-person handles complex scenes better. Some setups use third-person limited.
- **How verbose the system prompt should be.** Some popular setups use 50-token system prompts; others use 1500+. Verbose helps small models; concise often helps frontier models. Test both.
- **Lorebook scope (per-character vs. per-conversation).** PersonaLLM uses per-character; some setups use per-conversation. Trade-off: persistence across chats vs. clean restart per scenario.

These don't have settled answers in 2026.

---

## 14. Sources

**Community guides & docs:**
- SillyTavern docs: docs.sillytavern.app
- Trappu's PList + Ali:Chat guide: wikia.schneedc.com/bot-creation/trappu/creation
- AliCat's Ali:Chat guide: rentry.co/alichat
- kingbri's minimalistic guide: rentry.co/kingbri-chara-guide
- "How to Write a System Prompt for AI Roleplay" (rpfiend.com, March 2026)
- "This One Prompt Fixes Most Janitor AI Roleplay Problems" (roborhythms.com, Oct 2025)

**Memory & state extensions (validated patterns):**
- BetterSimTracker, SimTracker, Romance Meter, zTracker — relationship state tracking
- Smart Context, Chat Vectorization — RAG over chat history
- MessageSummarize (qvink) — per-message atomic summarization
- Smart Memory (senjinthedragon) — multi-tier memory + away recap
- MemoryBooks (aikohanasaki) — multi-tier consolidation (Scene → Chapter → Book → Series)
- CharMemory (bal-spec) — automatic structured memory extraction with vector retrieval

**Models & sampler settings:**
- MiniMax M2 / M2-her: Hugging Face official pages, MiniMax research blog
- DeepSeek API documentation (sampler caveats)

**Academic / research:**
- "Codified Profiles" (arXiv:2505.07705) — explicit behavioral logic outperforms prompt-only profiles
- "Talk Less, Call Right" (arXiv:2509.00482) — rule-based role prompting beats basic and APO
- "Lost in the Middle" (Liu et al., TACL 2024) — U-shaped attention curve, beginning/end win
- "Lost in the Middle: An Emergent Property" (Salvatore et al., 2025) — generalizes to next-token prediction
- "When Refusals Fail" (arXiv:2512.02445, 2026) — 1M-context models drop >50% at 100K tokens
- Nebula Block RP model benchmarks (slow-burn pattern testing)

---

*This document is a synthesis. Where it states a fact, it should be sourced. Where it states an opinion or convention, it should be marked as such. If something here lacks a source and isn't marked as opinion, it's a defect — flag it for the next revision.*
