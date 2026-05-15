# 02 — Information Architecture

## Observed in PersonaLLM

### Top-level navigation surfaces

Two coexisting nav surfaces visible on Home ([IMG_4095](../../References/PersonaLLM/AppReferenceImages/RawScreenshots/Home/IMG_4095.PNG)) and Menu ([IMG_4151](../../References/PersonaLLM/AppReferenceImages/RawScreenshots/Menu/IMG_4151.PNG)):

1. **Header bar (Home)** — left: hamburger (opens side Menu). Center: "PersonaLLM" wordmark. Right: two icon buttons — a **layout-toggle** that cycles three layouts (grid cards / compact circles / list — confirmed across [Home/IMG_4112](../../References/PersonaLLM/AppReferenceImages/RawScreenshots/Home/IMG_4112.PNG), [IMG_4113](../../References/PersonaLLM/AppReferenceImages/RawScreenshots/Home/IMG_4113.PNG), [IMG_4114](../../References/PersonaLLM/AppReferenceImages/RawScreenshots/Home/IMG_4114.PNG)) and an up/down arrows **sort** icon.
2. **Side Menu (drawer)** — slides from the left; contains:
   - **YOUR PERSONA** section — card "Your Persona · Tap to set up" → [UserProfile](04-screens/user-profile.md).
   - Top links: **Gallery**, **Community**.
   - **RECENT CHATS** — list of recent conversations with character avatar, name, last-message snippet, relative timestamp (e.g., "7m", "10m", "15m", "2h"). Tapping opens [Chat](04-screens/chat.md).
   - Footer: **Credits 310** (chevron → probably credits/purchase screen, `(inferred)`), **Settings** (chevron → [Settings](04-screens/settings-index.md)).
   - Bottom tab strip (three icons visible behind drawer in the same screenshot): red heart-ish, blue/purple center (plus?), green book — `(inferred)` as a bottom tab bar with **Favorites / Create / Library** or similar. Pending confirmation.

### Route map (canonical, derived)

```
AppStart
└── Onboarding (5 slides: Welcome → AgeVerify → CloudAIConsent → EntertainmentOnly → YoureReady)
    └── Home
        ├── Menu (drawer)
        │   ├── UserProfile (editor "Your Persona")
        │   ├── Gallery
        │   ├── Community (gated by CommunityGate — SCOPE-CUT in clone)
        │   │   ├── Characters tab
        │   │   │   ├── CommunityCharacterDetail
        │   │   │   │   ├── Try-It (sandbox Chat)
        │   │   │   │   └── Add to Library → own CharacterInfo
        │   │   │   └── Leaderboards (Most Downloaded / Liked / Top Creators / Most Prolific)
        │   │   ├── Gallery tab
        │   │   └── My Profile (creator profile: Uploads / Likes / Downloads / Following)
        │   ├── RecentChats[] → Chat
        │   ├── Credits  (SCOPE-CUT in clone)
        │   └── Settings
        │       └── Settings/<section> (model, prompts, params, appearance, memory, privacy, account)
        ├── Create Persona  (CTA on empty Home / "+ New Persona" tile on populated Home)
        │   └── CharacterInfo (new-character mode)
        ├── CharacterImport  (entry point TBD — (open question))
        └── Character card/row → CharacterInfo or Chat (open question — which opens first)
              └── Chat
                  ├── MessageActions (regenerate, swipe, edit, branch)
                  └── InlineSettings (writing style, model, etc. — (inferred))
```

### Empty-state routing (observed)

Fresh install Home has no characters → two primary CTAs ([IMG_4095](../../References/PersonaLLM/AppReferenceImages/RawScreenshots/Home/IMG_4095.PNG)):
- **Create Persona** → character-creation flow.
- **Browse Community** → Community screen as alternative seed path.

### Search

Home has a persistent search field ("Search personas…") — scope: user's own characters (inferred, since Home subtitle is "Your AI Companions"). Community likely has its own search (pending Pass B).

## User Extensions / Scope Decisions

- **Onboarding route** rewritten: Welcome → AgeVerify (email/OAuth instead of Apple) → **ProvidersBYOK** (replaces CloudAIConsent, collects OpenRouter key + ComfyUI URL; skippable) → EntertainmentOnly → **UserPersona quick-setup** (optional) → Home. See [04-screens/onboarding.md](04-screens/onboarding.md).
- **Cut branches:** Community subtree (gate, tabs, leaderboards, upload, My Profile, follow, like, download, flag) and Credits.
- **Menu** keeps: Your Persona, Gallery, Recent Chats, Settings. Drops: Community, Credits.
- **Multi-user web:** every route scoped by authenticated user; Recent Chats, Gallery, Characters, UserPersonas, Settings are all per-user.

## Open Questions

- Exact identity of the three bottom-tab icons partially visible behind the Menu drawer.
- Is CharacterImport reached from Home header, Menu, Settings, or only from Community? Pending Import-folder read.
- Is there a separate "My Characters" list distinct from Home, or is Home itself that list?
- Does Credits open a store / purchase page, or a transaction log?
