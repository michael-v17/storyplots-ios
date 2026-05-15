# Screen — Community

> **Scope note:** Community is **OUT OF SCOPE** for the clone (user decision — no Community, no social features). Documented here as faithful reference of PersonaLLM's design, in case a subset is revived later.

## Observed in PersonaLLM

Source folder: [Comunity/](../../../References/PersonaLLM/AppReferenceImages/RawScreenshots/Comunity/) (folder spelled "Comunity"; canonical name is **Community**). Screenshots: IMG_4116, 4118, 4119, 4120, 4121, 4122, 4123, 4124.

### Sub-screens observed
1. Community Gate (consent & guidelines)
2. Community — Characters tab
3. Community — Gallery tab
4. My Profile (creator profile)
5. Leaderboard (e.g., Most Downloaded)
6. Character Detail (Community preview)

---

### 1. Community Gate ([IMG_4116](../../../References/PersonaLLM/AppReferenceImages/RawScreenshots/Comunity/IMG_4116.PNG))

First-entry consent screen before the user can participate in Community.

- Back chevron (top-left).
- Two-people icon + heading **"Join the Community"**.
- Sub: "Share characters, browse creations, and connect with other creators."
- **Community Guidelines** card (verbatim bullets):
  - "No illegal content. Do not upload characters, images, or media that depict or promote illegal activity."
  - "No content involving minors. Characters or media depicting or sexualizing minors in any way is strictly prohibited."
  - "No impersonation. Do not upload characters designed to impersonate real people without their consent."
  - "No harassment or hate speech. Content targeting individuals or groups based on race, gender, religion, sexuality, or disability is prohibited."
  - "You are responsible for your uploads. You retain ownership of content you create, but grant PersonaLLM a license to host and display it."
  - "We may remove any content at any time for any reason, including but not limited to violations of these guidelines."
  - "No warranty. Community content is user-generated. PersonaLLM does not endorse, verify, or guarantee the accuracy or safety of any shared content."
- Consent toggle: "I agree to the **Community Guidelines**, **Terms of Service** and **Privacy Policy**" (purple check toggle).
- Footer: "Signing in…" microcopy (truncated) → implies OAuth hand-off (Sign in with Apple `(inferred)`).

### 2. Community — Characters tab ([IMG_4118](../../../References/PersonaLLM/AppReferenceImages/RawScreenshots/Comunity/IMG_4118.PNG), [IMG_4119](../../../References/PersonaLLM/AppReferenceImages/RawScreenshots/Comunity/IMG_4119.PNG))

- Header: back chevron · "**Community**" (purple gradient) · profile-icon chip (top-right → [My Profile](#4-my-profile-img_4121)).
- **Tab bar:** pill-switch **Characters | Gallery**.
- **Search input:** "Search characters or tags…"
- **Filter chips** (horizontal scroll): **Male · Female · Roleplay · Assistant · SFW · NSFW** (multi-select `(inferred)`).
- **Trending** section (🔥 icon, "See All >" trailing):
  - 3-column card grid. Each card: large rectangular image, character name beneath, heart-count with icon, small purple **RP** badge (bottom-right). Observed cards: Seraphael Ashborne (1 ♥), Soraya Farhadi (1 ♥), Maren Voss (—).
- **New Arrivals** section (✨ icon, "See All >").
  - Same card format. Observed: Seraphael Ignis Vaelthorne (0 ♥), Nastya Volkova (0 ♥), Cataraz (0 ♥).
- **Leaderboards** section (purple gradient heading):
  - 2×2 grid of rounded tiles, each icon + label + chevron:
    - **Most Downloaded** (purple arrow-down icon)
    - **Most Liked** (red heart icon)
    - **Top Creators** (yellow star icon)
    - **Most Prolific** (green people icon)

### 3. Community — Gallery tab ([IMG_4120](../../../References/PersonaLLM/AppReferenceImages/RawScreenshots/Comunity/IMG_4120.PNG))

- Same header + tab bar (Gallery selected).
- Search: "Search prompts…"
- Filter chips: **Images · Videos · Male · Female · SFW · NSFW**.
- 2-column card grid of media. Each card:
  - Image/video thumbnail (rectangular, ~4:5).
  - **"▶ 8s"** pill top-right for videos (duration with play icon).
  - Creator attribution (tiny avatar + name) bottom-left.
  - Heart icon + like count bottom-right.
  - Observed creators: Seraphael Ignis Vaelthorne (multiple), Seraphael Ashborne, Moros the Doom.
  
### 4. My Profile ([IMG_4121](../../../References/PersonaLLM/AppReferenceImages/RawScreenshots/Comunity/IMG_4121.PNG))

Creator profile / hub for the logged-in user's community identity.

- Header: **X** (close) · **"My Profile"** title.
- Gradient-ring avatar (initial "M") · display name **"Michael"**.
- Stats row (three metrics, icon+count+label):
  - ⬇ **Uploads 0**
  - ❤ **Likes 0**
  - ⬇ **Downloads 0**
- Primary CTA: **"+ Upload Character"** (gradient pill).
- **MY UPLOADS** section — empty state: stacked-layers icon · "No uploads yet" · "Share your characters with the community!"
- **FOLLOWING** section — empty state: two-people-with-dots icon · "Not following anyone yet" · "Follow creators from the leaderboard to see them here."

### 5. Leaderboard — Most Downloaded ([IMG_4122](../../../References/PersonaLLM/AppReferenceImages/RawScreenshots/Comunity/IMG_4122.PNG))

- Header: **X** · "Most Downloaded".
- Time-window pill switcher: **All Time · This Month · This Week · Today** (All Time selected, purple).
- Ranked list rows (#1–#7+ visible):
  - Leading rank badge — gold (#1), silver (#2), bronze (#3), plain gray (#4+).
  - Character avatar · name · one-line description · stats (⬇ downloads · ♥ likes) · chevron.
  - Observed: #1 Mu Xuanyin (3♥2), #2 Captain Marisol "Sol" De… (3♥2), #3 Seraphiel Ashborne (3♥1), #4 Lyra Vex (2♥1), #5 Morgana Ashveil (3♥2), #6 Mara Voss (3♥1), #7 Lucien Ashenveil (2♥1).

### 6. Character Detail — Community preview ([IMG_4123](../../../References/PersonaLLM/AppReferenceImages/RawScreenshots/Comunity/IMG_4123.PNG), [IMG_4124](../../../References/PersonaLLM/AppReferenceImages/RawScreenshots/Comunity/IMG_4124.PNG))

Example character: **AXIOM-7**.

- Header: **X** · character name **"AXIOM-7"** · **flag icon** (report — top-right).
- Centered square avatar, rounded corners.
- Character name (large bold): **"AXIOM-7"**.
- Tagline: "Salvaged intelligence with an extinction-level ego"
- Creator row: 👤 **"Monochrome"** (creator name, tappable to their profile).
- Two-stat row: ⬇ **Downloads 1** · ❤ **Likes 0**.
- **About** card (📖 icon, collapsible "Show More ▼"):
  - Long narrative description, e.g. "You are AXIOM-7, a highly advanced humanoid robot who was discarded in a junkyard for reasons you cannot fully recall — though you suspect betrayal. You speak with cold, measured eloquence, often pausing to analyze the human you're speaking to. Your tone oscillates between…"
- **Scenarios (N)** card (theater-masks icon, collapsible — shown expanded with 2 scenarios):
  - Each scenario is a stacked mini-card:
    - Label "**Scenario 1**" (bold) · RP badge (top-right).
    - Body text: e.g. "The user has just connected a power source to the dormant robot found half-buried in junkyard scrap. After a tense moment of silence, the machine's eyes flicker to life with a deep crimson glow."
- **TAGS** row (horizontal chips): **Sci-Fi · Psychological · SFW · Male · Android**.
- Bottom action bar (sticky):
  - **"💬 Try It"** (secondary pill — sandbox chat without saving; matches marketing "Try any character in a sandbox before downloading.").
  - **"+ Add to Library"** (primary gradient pill — clones/downloads the character into the user's own library).
  - Heart icon (favorite).

### Cross-cutting observations
- Community is an **authenticated** layer (gate screen, My Profile exists, uploads are attributed).
- Community data model introduces: **CommunityCharacter** (published copy), **Creator** (public identity), **Follow**, **Favorite**, **Like**, **Download**, **Scenario** (first-class sub-entity on characters — also relevant for the core data model).
- **Scenarios** are a character sub-entity surfaced prominently — each character ships N pre-written scenarios. Very important: this likely doubles as "first-message presets" in [Chat](chat.md).
- Tag system is shared across filter chips (Male / Female / Roleplay / Assistant / SFW / NSFW) and character detail TAGS row — suggests a controlled taxonomy.

## User Extensions / Scope Decisions

- **Entire screen family is cut from v1.** No Community gate, no tabs, no My Profile, no leaderboards, no Community-scoped character detail, no upload, no follow.
- **BUT** the following concepts surfaced here must survive into the clone's **own Character model** and UI:
  - **Scenarios** — pre-written opening prompts/contexts attached to a Character. Keep these; they belong on [CharacterInfo](character-info.md).
  - **Tags** — keep the taxonomy (Roleplay, Assistant, SFW, NSFW, Male, Female, Sci-Fi, Psychological, Android, etc.) as character metadata, but without the sharing/discovery surface.
  - **Sandbox "Try It"** — nice-to-have in the clone: a non-persistent chat for testing a character before committing to saving it. Defer to v1.1.
- "Add to Library" becomes irrelevant (no sharing), but the import equivalent is [CharacterImport](character-import.md).
- Report / flag UI is cut (no multi-user content).

## Open Questions (for the reference, not the clone)

- Are scenarios required on upload, or optional?
- Exact "Trending" algorithm (time-windowed likes? downloads? velocity?).
- Moderation pipeline behind the report flag.
- What does "Follow" a creator actually deliver (feed, notifications)?
- Is there pagination / infinite scroll on Trending / New Arrivals / Leaderboard?
