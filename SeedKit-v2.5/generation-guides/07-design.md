# Generation Guide: seed/design.md

## 1. When to include

**Conditional — only if the project has UI AND a `design-system/` exists.**

Include when:
- The project has a user interface
- The creator has generated (or brought) a `design-system/` at the project root

**This file is intentionally thin.** Its sole function is to be the visual brief and guardrails. The `design-system/` is the source of truth for tokens and shapes — `design.md` points to it, it does not duplicate it.

**Do not generate `design.md` if**: the project has no UI, or if a `design-system/` does not yet exist (the brief has no meaning without its implementation).

---

## 2. Prerequisites

These must exist before opening this session:

- [ ] `seed/creator-vision.md` — the creator's visual and feel preferences
- [ ] `seed/references/[AppName]/08-design-system.md` *(or equivalent)* — design system observed in the reference
- [ ] `design-system/` at root ✓ — brought by the creator; `design.md` points to it

---

## 3. Session opening prompt

```
We are going to generate seed/design.md. This file is a thin visual brief —
it defines the product's visual north, design principles, and anti-patterns.
It does NOT contain concrete tokens or color values: those live in design-system/.

Read the following files in this order before beginning:
1. seed/creator-vision.md                              — feel and visual preferences
2. seed/references/[AppName]/08-design-system.md       — observed design system
3. design-system/README.md                             — summary of the generated design system
4. design-system/colors_and_type.css (or equivalent)   — tokens to understand what exists

Produce seed/design.md with this structure:
- Visual north star: 3-5 adjectives or analogies (NO hex, NO rem, NO component names)
- Design principles: 2-4 principles, each with 2-3 lines explaining why it matters
- Explicit anti-patterns: a list of what NOT to do, specific and verifiable
- Pointer to design-system/ as the source of truth for tokens and component shapes

CRITICAL RULES:
- The file must be under 200 lines (if longer, it is mixing responsibilities)
- NEVER include hex values, rem values, pixel values, or concrete CSS token names
- NEVER describe screen specs or layouts (that goes in ux.md)
- Principles must explain the "why", not the "what" (the "what" is in design-system/)
- Anti-patterns must be specific: "no more than 2 accent colors on the same screen"
  is specific; "don't use ugly colors" is not
```

---

## 4. Extraction map

### From `seed/creator-vision.md`
- Adjectives or analogies the creator uses to describe the visual feel ("dark", "intimate", "like Notion", "serious, not playful")
- Explicit visual prohibitions ("no bright colors", "no gradients")
- Tone and atmosphere the creator wants to convey
- Any mention of external visual references

### From `seed/references/[AppName]/08-design-system.md`
- Observed color palette (dark/light mode, primary colors, accent colors)
- Observed typography principles (font families, hierarchy)
- Observed spacing and layout patterns
- Components with their observed visual treatment (cards, buttons, inputs, chat bubbles)
- Design elements the creator wants to preserve vs those they want to change

### From `design-system/` (README + tokens)
- Which tokens exist (to know what is already defined and avoid repeating it)
- The name of the design system or palette to be able to reference it
- If a "visual north star" is already defined in the design system README → do not invent a different one

---

## 5. Required output structure

### 5.1 Visual north star

3-5 adjectives or short phrases that capture the visual essence. Oriented toward sensations, not implementation:

```markdown
## Visual north star

Dark. Intimate. Layered complexity revealed on demand.
The app feels like a private notebook — not a social platform.
Typography carries the narrative weight; chrome recedes.
```

**Do not include**: hex values, specific font names, CSS token names.
**Include**: analogies, adjectives, mood — what guides design decisions in ambiguous situations.

### 5.2 Design principles

2-4 principles, each with a name and 2-3 lines explaining the "why". Principles are load-bearing: they guide decisions when the design-system is ambiguous.

```markdown
## Design principles

**Typography carries meaning, not just text.**
The visual distinction between character voice (styled) and narrative voice (plain) is functional:
it routes to TTS and signals the reader which mode they're in. Never flatten this distinction
for visual tidiness.

**Chrome recedes; content leads.**
UI controls fade to a lower-visibility state until invoked. The user's story and the character's
replies are the foreground; everything else is the background. Avoid heavy borders, bright icons,
or busy headers that compete for attention.

**Reveal complexity on demand.**
Advanced settings (grammar, lorebook, memory, generation overrides) exist but are not surfaced
by default. Power users discover depth; new users see simplicity. This is not a bug; it's the
product's core tension.
```

### 5.3 Explicit anti-patterns

A list of what NOT to do. They must be specific and verifiable:

```markdown
## Anti-patterns

- No more than one accent color active per screen (character accent is the accent; don't add a second)
- No light mode that "looks weak" — if a light theme exists, it uses the same level of contrast
  and visual weight as the dark theme
- No chat bubbles with border-radius that reads as "friendly/casual" — use the reference's
  established bubble shapes
- No icons that mix metaphors from different icon families in the same view
- No empty states that show a blank white area — always show a prompt or instructional copy
- No gradients on brand-primary surfaces
```

Each anti-pattern must be verifiable: someone can look at a screen and say "this anti-pattern is met or not".

### 5.4 Pointer to design-system/

A short section declaring where the concrete implementation lives:

```markdown
## Design system

`design-system/` at repo root is the authoritative implementation of this brief.

- `design-system/colors_and_type.css` — all color and typography tokens as CSS custom properties.
  All styling reads from here; never hardcode hex values.
- `design-system/preview/` — rendered component cards (buttons, inputs, chat bubble, character card, etc.)
- `design-system/ui_kits/app/` — reference JSX for key screens (Home, Chat, Character Edit, Settings)

**On conflict between `seed/design.md` and `design-system/`:**
`design-system/` wins on visual tokens and component shapes (it is the concrete implementation).
`seed/design.md` wins on design principles, non-omission rules, and anti-patterns (it is the brief).
```

---

## 6. Quality gates before approving

- [ ] The file is under 200 lines
- [ ] No hex values or concrete CSS values (search for `#`, `rgb(`, `rem`, `px` outside the pointer section)
- [ ] No screen specs or layouts (search for "sidebar", "modal", "route" — if they appear as specs, they are wrong)
- [ ] Each principle has a "why" of 2+ lines (not just a name)
- [ ] Anti-patterns are specific and verifiable (not "don't use ugly colors")
- [ ] The pointer section to design-system/ exists with the precedence rule
- [ ] The visual north star uses adjectives/analogies, not implementation

---

## 7. Common failure modes

**1. Copying tokens from design-system/ into design.md**
The AI writes `--sp-bg: #1a1a2e` or `font-family: "SF Pro Text"` in design.md. Detect: search for `#`, `rgb(`, `var(--`, `font-family:`, `rem` — if they appear in the body of the document (not in the pointer section), it is duplication. Solution: remove and reference design-system/.

**2. Visual north star too generic**
The AI writes "clean, modern, user-friendly" — it could apply to any app. Detect: if the adjectives exclude nothing (any app could use those adjectives), they are not useful. Solution: refine with creator-vision — look for adjectives the creator used that are specific to this product.

**3. Principles without a "why"**
The AI writes "Typography matters" without explaining why it is a load-bearing design principle for this product. Detect: look for principles without functional context. Solution: add 2-3 lines explaining the consequence of not following that principle.

**4. File too long (> 200 lines)**
The AI expands design.md into a full component specification, with layout details and breakpoints. Detect: count lines. If > 200, there is excess content. Solution: move screen specs to ux.md, move tokens to design-system/, leave only brief and guardrails.

**5. Non-verifiable anti-patterns**
The AI writes "don't use too many colors" (how many is too many?). Detect: look for anti-patterns with vague adverbs ("too many", "very", "excessive"). Solution: replace with rules that have a concrete threshold ("no more than 2 accent colors on the same screen").
