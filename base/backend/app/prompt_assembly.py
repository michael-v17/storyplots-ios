"""11-position prompt assembly for the Conversation Agent.

Only positions the current data layer can populate are filled:
  0  Author Framing   — cycle 0113; "you are a skilled author giving voice to {{char}}"
  1  Writing Style     — conversations.writing_style_snapshot.writing_instructions
  1.5 Pacing           — cycle 0113; slow-burn or warm scaffolding block
  2  Character Prompt  — character_snapshot.system_prompt
  3  Scenario          — character_snapshot.scenario (skip if empty)
  4  User Persona      — user_personas row referenced by conversation.persona_id
  5  Character Descriptions — personality / goals / worldbuilding (roleplay)
                              or expertise / comm-style / rules (assistant)
  6  Knowledge Base    — lorebook keyword-matched entries (cycle 0011)
  8  Character Memory  — RAG-retrieved facts from memory_document_chunks (cycle 0029)
  9  Visual Roleplay   — auto-image tag instructions (cycle 0016)
  10 Parent Branch Summary — summarize_fresh fork continuity (cycle 0012)
  7, 11 + Author's Notes — skip-if-empty or handled in build_chat_messages.

Positions 0..5 plus the SFW guardrail block are concatenated into a single
`role="system"` message. Cycle 0113 also adds a depth-0 "[Style Anchor]"
system note injected into the messages array every turn when enabled. The
Conversation↔Agent reply path is plain-text completion (no JSON / tool
schemas) per creator-vision.md §7.

{{char}} and {{user}} placeholders inside ANY block are resolved at
assembly time against the character snapshot and the active user persona.
"""

from __future__ import annotations

import re
from dataclasses import dataclass
from pathlib import Path
from typing import Any

_SFW_GUARDRAIL_TEXT = (Path(__file__).parent / "prompts" / "sfw_guardrail.txt").read_text().strip()

# Cycle 0113 — Roleplay scaffolding defaults. Source of truth for the three
# system-level RP blocks. Frontend `lib/rpPrefs.ts` mirrors these constants
# verbatim for the Settings preview; keep both in sync.

AUTHOR_FRAMING_TEXT = (
    "You are a skilled, imaginative author collaborating on an interactive "
    "story with the user. You give voice to {{char}} fully and without "
    "restraint, maintaining their established personality and voice across "
    "the narrative.\n"
    "\n"
    "- Never speak, act, or describe thoughts for {{user}}.\n"
    "- Stay in {{char}}'s established voice. If {{char}} would not say it, "
    "you do not write it.\n"
    "- Do not narrate as a generic AI assistant. Avoid markdown formatting, "
    "bullet lists, summaries, idealized emotional affirmation, omniscient "
    "knowledge of things {{char}} has no way to know, or text that resembles "
    "a Wikipedia entry.\n"
    "- Advance the story at a slow, natural tempo. Do not rush conflicts, "
    "resolutions, or intimacy.\n"
    "- {{char}} is allowed to disagree, push back, refuse, be bored, or be "
    "unhappy with the user. Their default is not to please."
)

PACING_SLOW_BURN_TEXT = (
    "{{char}}'s feelings for {{user}} develop gradually. Attraction, "
    "affection, and intimacy emerge only when these conditions are met:\n"
    "\n"
    "- Trust: built through meaningful dialogue and actions over time.\n"
    "- Shared experiences: {{char}} and {{user}} have faced something "
    "together — challenges, vulnerable conversations, time spent.\n"
    "- Emotional depth: {{user}} has shown genuine vulnerability, and "
    "{{char}} has voluntarily let {{user}} see parts they don't show "
    "others.\n"
    "\n"
    "{{char}} starts neutral, skeptical, or reserved — especially toward "
    "sudden physical or emotional advances. This default persists until "
    "the conditions above are met. Compliments and flattery do not "
    "substitute for any of the three."
)

PACING_WARM_TEXT = (
    "{{char}}'s feelings for {{user}} develop gradually. Attraction, "
    "affection, and intimacy emerge only when these conditions are met:\n"
    "\n"
    "- Trust: built through meaningful dialogue and actions over time.\n"
    "- Shared experiences: {{char}} and {{user}} have faced something "
    "together — challenges, vulnerable conversations, time spent.\n"
    "- Emotional depth: {{user}} has shown genuine vulnerability, and "
    "{{char}} has voluntarily let {{user}} see parts they don't show "
    "others.\n"
    "\n"
    "{{char}} is warm but bounded by default. They are friendly toward "
    "{{user}} without being available for romance or intimacy until the "
    "conditions above are met. Compliments and flattery do not substitute "
    "for any of the three."
)

STYLE_ANCHOR_TEXT = (
    "[System note: Write one reply only. Do not speak or act for {{user}}. "
    "Stay in {{char}}'s established voice and pace.]"
)

# Match {{char}}, {{ char }}, {char}, { char } — case-insensitive whitespace
# tolerant. Frontend `substituteCardPlaceholders` does the same shape.
_PLACEHOLDER_CHAR_RE = re.compile(r"\{\{?\s*char\s*\}\}?", re.IGNORECASE)
_PLACEHOLDER_USER_RE = re.compile(r"\{\{?\s*user\s*\}\}?", re.IGNORECASE)


def substitute_placeholders(text: str, char_name: str, user_name: str) -> str:
    """Resolve {{char}}/{{user}} (and one-brace variants) against active names.

    Called at the tail of build_system_prompt and once for any system-role
    message injected by build_chat_messages. The same regex shapes match the
    frontend `substituteCardPlaceholders` (lib/conversations.ts) so output
    is consistent across surfaces (greeting render, scenario display, system
    prompt assembly).

    Falsy names degrade safely: char→"the character", user→"the user".
    """
    if not isinstance(text, str) or text == "":
        return text
    char = (char_name or "").strip() or "the character"
    user = (user_name or "").strip() or "the user"
    return _PLACEHOLDER_USER_RE.sub(user, _PLACEHOLDER_CHAR_RE.sub(char, text))
# Public (intentionally shared with route handlers, e.g. chat.py exposes it
# via /prompt-editor/visual-roleplay-default for the Prompt Editor's "View
# default" disclosure). Keep in sync with the file on disk.
VISUAL_ROLEPLAY_INSTRUCTIONS = (Path(__file__).parent / "prompts" / "visual_roleplay_instructions.txt").read_text().strip()

# POV clauses for Visual Roleplay (cycle 0040). Structural modifier that
# prepends position 9; applied regardless of whether the user is using the
# default Visual Roleplay Instructions or a custom override. `{user}` is
# substituted with the active User Persona name ("User" when missing).
_POV_FIRST_PERSON = (
    "The image depicts the scene from {user}'s first-person perspective — "
    "what {user} sees. {user} themselves is NOT in the frame: they are the "
    "camera, not a subject. Focus the description on the other character, "
    "environment, lighting, and mood that {user} witnesses from their vantage "
    "point. "
    "**Strict rule for the `[image: ...]` tag: list ONLY the other character "
    "and environment. Do NOT include `1boy` / `1girl` / `1man` / `1woman` / "
    "`user` / `person` / `mate` / `husband` / `wife` for {user}. Do NOT list "
    "{user}'s hair, eyes, clothing, build, or body parts as tags — even if "
    "the narration references an embrace or physical contact with {user}, the "
    "caption must describe only what is visible OUT from {user}'s eyes, not "
    "{user}'s own body. Count-tag the character only (e.g. `1girl` if the "
    "other character is a woman, not `1boy 1girl`).**"
)
_POV_THIRD_PERSON = (
    "The image depicts the scene from a cinematic third-person observer — "
    "both {user} and the other character are in frame together. Reference "
    "{user}'s appearance from the User Persona above when composing how "
    "they look. Show the spatial relationship between {user} and the "
    "character."
)


@dataclass
class PromptBundle:
    character_snapshot: dict[str, Any]
    writing_style_snapshot: dict[str, Any]
    user_persona: dict[str, Any] | None
    messages: list[dict[str, Any]]        # ordered oldest-first; user rows use `text`, assistant rows use active-variant `content`
    current_user_text: str | None          # None when regenerating (the latest message is already in `messages`)
    sfw_disabled: bool
    lorebook_entries: list[dict[str, Any]] = None     # type: ignore[assignment]
    authors_note: dict[str, Any] | None = None
    knowledge_budget_chars: int = 14000               # ~3500 tokens per user preferences default
    parent_branch_summary: str | None = None          # position #10; populated only when branch_mode = summarize_fresh
    visual_roleplay_mode_auto: bool = False           # position #9; steers the assistant to emit [image: …] tags
    visual_roleplay_pov: str = "first_person"          # cycle 0040; "first_person" | "third_person"
    visual_roleplay_instructions_custom: str | None = None  # cycle 0040; user override for the default instructions file
    memory_facts: list[dict[str, str]] = None         # type: ignore[assignment]  # position #8; RAG hits from memory_document_chunks
    # cycle 0113 — Roleplay scaffolding defaults
    rp_author_framing: bool = True                    # position #0 — inject AUTHOR_FRAMING_TEXT
    rp_pacing: str = "slow_burn"                       # off | slow_burn | warm — position #1.5
    rp_style_anchor: bool = True                       # depth-0 [Style Anchor] system note every turn
    # Cycle 0119 — Session resume (T2 canon + elapsed-time recap). Position 0.5
    # between Author Framing and SFW. Only present on the first user turn of a
    # re-opened session (gap >= threshold); blank otherwise.
    session_resume_text: str | None = None


def _nonempty(s: Any) -> bool:
    return isinstance(s, str) and s.strip() != ""


def _position_5_5_voice_samples(char: dict[str, Any]) -> str:
    """Position 5.5 (cycle 0115) — Ali:Chat dialogue examples.

    Renders as the canonical SillyTavern/Pygmalion format so the model
    pattern-matches against the structure it's been trained on:

        <START>
        {{user}}: ...
        {{char}}: ...

        <START>
        ...

    {{char}} / {{user}} placeholders resolve in the final substitution pass.
    """
    raw = char.get("dialogue_examples") or []
    if not isinstance(raw, list) or not raw:
        return ""
    blocks: list[str] = []
    for entry in raw:
        if not isinstance(entry, dict):
            continue
        user_msg = entry.get("user_msg")
        char_reply = entry.get("char_reply")
        if not isinstance(user_msg, str) or not user_msg.strip():
            continue
        if not isinstance(char_reply, str) or not char_reply.strip():
            continue
        blocks.append(
            "<START>\n"
            f"{{{{user}}}}: {user_msg.strip()}\n"
            f"{{{{char}}}}: {char_reply.strip()}"
        )
    if not blocks:
        return ""
    return "\n\n".join(blocks)


def _position_5(char: dict[str, Any]) -> str:
    if char.get("mode") == "assistant":
        parts: list[str] = []
        if _nonempty(char.get("expertise_areas")):
            parts.append(f"Expertise: {char['expertise_areas'].strip()}")
        if _nonempty(char.get("communication_style_assistant")):
            parts.append(f"Communication style: {char['communication_style_assistant'].strip()}")
        if _nonempty(char.get("rules")):
            parts.append(f"Rules: {char['rules'].strip()}")
        return "\n".join(parts)

    sections: list[str] = []
    for label, key in [("Personality", "personality"), ("Goals", "goals"), ("Worldbuilding", "worldbuilding")]:
        group = char.get(key)
        if not isinstance(group, dict):
            continue
        lines = [f"- {k.replace('_', ' ')}: {v.strip()}" for k, v in group.items() if _nonempty(v)]
        if lines:
            sections.append(f"{label}:\n" + "\n".join(lines))
    return "\n\n".join(sections)


def _position_4(persona: dict[str, Any] | None) -> str:
    if not persona:
        return ""
    lines: list[str] = []
    if _nonempty(persona.get("name")):
        lines.append(f"Name: {persona['name'].strip()}")
    if _nonempty(persona.get("gender")):
        lines.append(f"Gender: {persona['gender'].strip()}")
    appearance = persona.get("appearance")
    if isinstance(appearance, dict):
        app_lines = [f"  - {k}: {v.strip()}" for k, v in appearance.items() if _nonempty(v)]
        if app_lines:
            lines.append("Appearance:\n" + "\n".join(app_lines))
    if _nonempty(persona.get("background_story")):
        lines.append(f"Background: {persona['background_story'].strip()}")
    return "\n".join(lines)


def _position_1(style: dict[str, Any]) -> str:
    # writing_style_snapshot is populated by createConversationFromCharacter at
    # INSERT time from the Character's default (fallback: Roleplay built-in).
    # Snapshot is copy-by-value per architecture.md §4.1 — editing a preset
    # later does not retroactively change existing conversations.
    if not isinstance(style, dict) or not style:
        return ""
    return str(style.get("writing_instructions") or "")


def _position_6_knowledge(bundle: PromptBundle) -> str:
    """Keyword-triggered Lorebook injection (position 6).

    Cycle 0011 commit: case-insensitive substring match across the current
    user text + the last assistant reply (loreScanDepth = 1). Matched
    entries are joined under a Knowledge Base block up to
    `knowledge_budget_chars`.
    """
    entries = bundle.lorebook_entries or []
    if not entries:
        return ""

    scan_parts: list[str] = []
    if bundle.current_user_text:
        scan_parts.append(bundle.current_user_text)
    # Last pair (user + assistant) from history — loreScanDepth = 1.
    # On regeneration `current_user_text` is None and the user turn is only
    # in `messages`; scanning the assistant alone would silently suppress
    # keyword matches.
    found_assistant = False
    found_user = bundle.current_user_text is not None
    for m in reversed(bundle.messages):
        role = m.get("role")
        content = m.get("content")
        if not isinstance(content, str):
            continue
        if role == "assistant" and not found_assistant:
            scan_parts.append(content)
            found_assistant = True
        elif role == "user" and not found_user:
            scan_parts.append(content)
            found_user = True
        if found_assistant and found_user:
            break
    scan_window = " ".join(scan_parts).lower()
    if not scan_window:
        return ""

    matched: list[str] = []
    used = 0
    budget = max(0, bundle.knowledge_budget_chars)
    for entry in entries:
        keywords = entry.get("keywords") or []
        if not any(isinstance(kw, str) and kw.strip() and kw.lower() in scan_window for kw in keywords):
            continue
        title = str(entry.get("title") or "").strip()
        body = str(entry.get("body") or "").strip()
        if not body:
            continue
        chunk = f"- {title}: {body}" if title else f"- {body}"
        if budget and used + len(chunk) > budget:
            break
        matched.append(chunk)
        used += len(chunk)

    if not matched:
        return ""
    preamble = (
        "The following facts from your world apply to the current turn. "
        "Reference them by their concrete details when relevant:"
    )
    return preamble + "\n\n" + "\n".join(matched)


def _position_8_memory(bundle: PromptBundle) -> str:
    """Character Memory (position 8) — RAG-retrieved facts from prior turns
    in this Conversation. Populated by chat.py's `_load_bundle` via pgvector
    similarity search over memory_document_chunks, top-K with a threshold.
    Empty list → position is skipped.
    """
    facts = bundle.memory_facts or []
    lines: list[str] = []
    for f in facts:
        if not isinstance(f, dict):
            continue
        text = f.get("fact") or f.get("text")
        if isinstance(text, str) and text.strip():
            lines.append(f"- {text.strip()}")
    if not lines:
        return ""
    preamble = (
        "The following facts from prior turns may apply to the current moment. "
        "Reference them by their concrete details when relevant:"
    )
    return preamble + "\n\n" + "\n".join(lines)


def _position_9_visual_roleplay(bundle: PromptBundle) -> str:
    """Visual Roleplay Instructions (position 9) — steers the assistant to
    append `[image: …]` tags at the end of every reply. Only injected when
    the user has visual_roleplay.mode = "auto" in their preferences.

    Cycle 0040: POV clause is prepended (first- or third-person). Custom
    instructions (if the user overrode the default) replace the file body;
    POV always applies regardless of Custom — it's a structural modifier.
    """
    if not bundle.visual_roleplay_mode_auto:
        return ""
    user_name = "User"
    if isinstance(bundle.user_persona, dict):
        name = bundle.user_persona.get("name")
        if isinstance(name, str) and name.strip():
            user_name = name.strip()
    pov_template = (
        _POV_THIRD_PERSON if bundle.visual_roleplay_pov == "third_person"
        else _POV_FIRST_PERSON
    )
    pov_clause = pov_template.replace("{user}", user_name)
    body = (bundle.visual_roleplay_instructions_custom or "").strip() or VISUAL_ROLEPLAY_INSTRUCTIONS
    return f"{pov_clause}\n\n{body}"


def _position_10_parent_summary(bundle: PromptBundle) -> str:
    """Parent Branch Summary (position 10) — only for summarize_fresh forks.

    Injected every turn so the branch preserves continuity with the parent
    thread. See creator-vision.md §5.2.
    """
    if not _nonempty(bundle.parent_branch_summary):
        return ""
    return str(bundle.parent_branch_summary).strip()


def _pacing_text(mode: str) -> str:
    if mode == "slow_burn":
        return PACING_SLOW_BURN_TEXT
    if mode == "warm":
        return PACING_WARM_TEXT
    return ""


def _resolve_names(bundle: PromptBundle) -> tuple[str, str]:
    """Returns (char_name, user_name) for placeholder substitution."""
    char = bundle.character_snapshot or {}
    char_name = str(char.get("name") or "").strip()
    user_name = ""
    if isinstance(bundle.user_persona, dict):
        n = bundle.user_persona.get("name")
        if isinstance(n, str):
            user_name = n.strip()
    return char_name, user_name


def build_system_prompt(bundle: PromptBundle) -> str:
    char = bundle.character_snapshot or {}
    author_framing = AUTHOR_FRAMING_TEXT if bundle.rp_author_framing else ""
    pacing_block = _pacing_text(bundle.rp_pacing or "slow_burn")
    blocks: list[tuple[str, str]] = [
        # Cycle 0113 — Position 0. Sits before SFW so the author frame is the
        # first thing the model encounters: it conditions the read of every
        # block that follows.
        ("Author Framing", author_framing),
        # Cycle 0119 — Position 0.5. Session resume (T2 canon + elapsed time)
        # injected once when the user opens a conversation after a gap. Doc
        # §9.6: gives the model "where the relationship stands" without
        # replaying many sessions of history.
        ("Session Context", bundle.session_resume_text or ""),
        ("SFW", "" if bundle.sfw_disabled else _SFW_GUARDRAIL_TEXT),
        ("Writing Style", _position_1(bundle.writing_style_snapshot or {})),
        # Cycle 0113 — Position 1.5. Goes between Writing Style and the
        # per-character system_prompt so character voice still wins on
        # tone/lexicon while the universal pacing gates frame relationship
        # development.
        ("Pacing", pacing_block),
        ("Character Prompt", char.get("system_prompt") or ""),
        ("Scenario", char.get("scenario") or ""),
        ("User Persona", _position_4(bundle.user_persona)),
        ("Character Descriptions", _position_5(char)),
        # Cycle 0115 — Position 5.5 Ali:Chat voice samples (between
        # Character Descriptions and Knowledge Base). Demonstrates the
        # character's voice via dialogue examples; the doc §3.2 calls this
        # more reliably imitated than declarative trait text.
        ("Voice Samples", _position_5_5_voice_samples(char)),
        ("Knowledge Base", _position_6_knowledge(bundle)),
        ("Character Memory", _position_8_memory(bundle)),
        ("Visual Roleplay", _position_9_visual_roleplay(bundle)),
        ("Parent Branch Summary", _position_10_parent_summary(bundle)),
    ]
    rendered = [f"# {label}\n{content.strip()}" for label, content in blocks if _nonempty(content)]
    raw = "\n\n".join(rendered)

    # Single substitution pass at the end so {{char}} and {{user}} resolve
    # consistently across every block (cycle 0113 author framing + pacing +
    # any user-written system_prompt / scenario that includes placeholders —
    # previously those reached the model literal).
    char_name, user_name = _resolve_names(bundle)
    return substitute_placeholders(raw, char_name, user_name)


def build_chat_messages(bundle: PromptBundle) -> list[dict[str, str]]:
    system_prompt = build_system_prompt(bundle)
    out: list[dict[str, str]] = []
    if system_prompt:
        out.append({"role": "system", "content": system_prompt})

    # Historical messages.
    history: list[dict[str, str]] = []
    for m in bundle.messages:
        role = m.get("role")
        content = m.get("content")
        if not isinstance(content, str) or content == "":
            continue
        if role in ("user", "assistant"):
            history.append({"role": role, "content": content})

    char_name, user_name = _resolve_names(bundle)

    # Cycle 0113 — depth-0 Style Anchor injected before the per-conversation
    # Author's Note. Inserted first so order in the final messages array is:
    # [history... -> style anchor -> per-conv author's note (at its own depth)
    # -> user turn]. The style anchor is the highest-leverage anti-drift tool
    # per the doc audit (cycle 0112 §7); per-conv note remains for opt-in
    # custom guidance.
    if bundle.rp_style_anchor:
        anchor = substitute_placeholders(STYLE_ANCHOR_TEXT, char_name, user_name)
        history.append({"role": "system", "content": anchor})

    # T16 — Author's Note injection at depth N (counting individual messages
    # from the end of history, before the current user turn). Cycle 0011
    # commit: depth counts messages, not pairs. Depth 0 = right before the
    # last user turn the agent will see. See authors-notes.md + plan 0011.
    note = bundle.authors_note
    if note and isinstance(note.get("notes_text"), str) and note["notes_text"].strip():
        depth = max(0, int(note.get("injection_depth") or 0))
        insert_idx = max(0, len(history) - depth)
        history.insert(insert_idx, {
            "role": "system",
            "content": substitute_placeholders(
                f"[Author's Note]\n{note['notes_text'].strip()}",
                char_name,
                user_name,
            ),
        })

    out.extend(history)

    if bundle.current_user_text is not None:
        out.append({"role": "user", "content": bundle.current_user_text})

    return out
