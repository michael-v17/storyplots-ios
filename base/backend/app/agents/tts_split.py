"""Pure text → segments splitter for TTS dual-voice routing.

Cycle 0020. See plans/0020-tts-dual-voice.md §4.

Convention (creator-vision.md §5.2):
  *italic*   → narrator voice
  "quoted"   → character voice
  plain text → narrator (default; characters always quote)

The image tag emitted by Visual Roleplay auto-mode (cycle 0016) is
stripped up front — TTS never pronounces `[image: tags]`. Adjacent
segments of the same kind are merged so the queue has the minimum
number of chunks (one API call per chunk).

The frontend's `TypographicText` component uses the same italic /
quote convention for display; keep the two parsers in sync.
"""

from __future__ import annotations

import re
from dataclasses import dataclass
from typing import Literal

from .tts_openai import strip_image_tag

Kind = Literal["narrator", "character"]


@dataclass(frozen=True)
class Segment:
    kind: Kind
    text: str


# Tokenise the stripped reply into *italic* / "quoted" spans + whatever
# plain text sits between them. `finditer` scans left-to-right with the
# first alternative that matches at a given position winning — which is
# fine because the two alternatives start with different delimiters
# (* vs "), so they don't overlap. `[^*\n]` / `[^"\n]` keep us on a
# single paragraph so an unterminated * on one line doesn't swallow
# later paragraphs.
_SEGMENT = re.compile(r'\*([^*\n]+?)\*|"([^"\n]+?)"')


def split_for_tts(raw: str) -> list[Segment]:
    text = strip_image_tag(raw or "").strip()
    if not text:
        return []

    segments: list[Segment] = []
    last = 0
    for m in _SEGMENT.finditer(text):
        if m.start() > last:
            plain = text[last : m.start()].strip()
            if plain:
                segments.append(Segment("narrator", plain))
        italic = m.group(1)
        quoted = m.group(2)
        if italic is not None:
            body = italic.strip()
            if body:
                segments.append(Segment("narrator", body))
        else:
            body = (quoted or "").strip()
            if body:
                segments.append(Segment("character", body))
        last = m.end()
    if last < len(text):
        tail = text[last:].strip()
        if tail:
            segments.append(Segment("narrator", tail))

    # Merge adjacent same-kind segments — italic narration followed by
    # plain narration should ride one TTS call, not two. Preserves the
    # speaker-flip boundaries (narrator ↔ character) exactly.
    merged: list[Segment] = []
    for seg in segments:
        if merged and merged[-1].kind == seg.kind:
            merged[-1] = Segment(seg.kind, merged[-1].text + " " + seg.text)
        else:
            merged.append(seg)
    return merged


if __name__ == "__main__":
    cases: list[tuple[str, str, list[Segment]]] = [
        (
            "plain text only",
            "She walked down the path.",
            [Segment("narrator", "She walked down the path.")],
        ),
        (
            "italic only",
            "*She smiles gently.*",
            [Segment("narrator", "She smiles gently.")],
        ),
        (
            "quoted only",
            '"Hi, I\'m Mira."',
            [Segment("character", "Hi, I'm Mira.")],
        ),
        (
            "italic + quoted + plain mixed",
            '*She smiles.* "Hello, traveler." The path winds on.',
            [
                Segment("narrator", "She smiles."),
                Segment("character", "Hello, traveler."),
                Segment("narrator", "The path winds on."),
            ],
        ),
        (
            "adjacent narrator segments merge",
            '*She turns.* She waves. "Over here!"',
            [
                Segment("narrator", "She turns. She waves."),
                Segment("character", "Over here!"),
            ],
        ),
        (
            "empty after image tag strip",
            "[image: forest_shrine]",
            [],
        ),
        (
            "trailing image tag stripped",
            '"Follow me." *She walks ahead.* [image: misty_path]',
            [
                Segment("character", "Follow me."),
                Segment("narrator", "She walks ahead."),
            ],
        ),
        (
            "empty input",
            "",
            [],
        ),
        (
            "single-char italic span adjacent to quote",
            '*!* "Hi there."',
            [
                Segment("narrator", "!"),
                Segment("character", "Hi there."),
            ],
        ),
    ]
    ok = 0
    for label, inp, expected in cases:
        got = split_for_tts(inp)
        if got == expected:
            ok += 1
        else:
            print(f"FAIL {label!r}")
            print(f"  input: {inp!r}")
            print(f"  got:      {got}")
            print(f"  expected: {expected}")
    print(f"{ok}/{len(cases)} passed")
    if ok != len(cases):
        raise SystemExit(1)
