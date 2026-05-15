# Screen — Fork Conversation (Branch)

## Observed in PersonaLLM

Sources: [Branch/IMG_4195.PNG](../../../References/PersonaLLM/AppReferenceImages/RawScreenshots/Branch/IMG_4195.PNG), [IMG_4196](../../../References/PersonaLLM/AppReferenceImages/RawScreenshots/Branch/IMG_4196.PNG).

### Entry point
From an active [Chat](chat.md) message → rail `⑂` chip (Branch) or from the **Fork from here** option in the user-message long-press sheet ([chat.md §Message actions](chat.md)).

### Modal layout
Header: **Cancel · "Fork Conversation"** (centered, no Save — CTA is the primary button).
Destructive theme: CTA pill is **red**.

### Body

1. **Fork-branch icon** (red ⑂, centered).
2. Heading: **"Fork Conversation"** (or **"Summarize & Start Fresh"** when that option is picked — see below).
3. Sub: "Create a new branch from this point to explore a different path"
4. **Starting point** card (read-only) — shows an ellipsized preview of the message the fork is anchored on (e.g., the last assistant line: "*My eyes ignite — two points of red cutting through the dust and gloom of this… place. Servos grind, joints protest, and I feel every scratch, every dent, every in…*").
5. **Branch Name** text input — placeholder **"Auto-generated if empty"**.
   - Auto-generation pipeline: the [Branch Summary System Prompt](settings/prompt-editor.md#4b-branch-summary-system-prompt) instructs the summarizer to prefix its output with `TITLE: <3–5 word title>`. The app parses that line to name the branch.
6. **Mode picker** — two radio cards (mutually exclusive):

| Mode | Card copy | Data behavior |
|---|---|---|
| ⑂ **Keep previous messages** (default, [IMG_4195](../../../References/PersonaLLM/AppReferenceImages/RawScreenshots/Branch/IMG_4195.PNG)) | "Create a new branch with all messages copied" | New Conversation is initialized with a **full copy** of the source messages up to the fork point. |
| 📄 **Summarize & start fresh** ([IMG_4196](../../../References/PersonaLLM/AppReferenceImages/RawScreenshots/Branch/IMG_4196.PNG)) | "AI summarizes earlier messages; branch starts lightweight" | New Conversation is initialized **empty** but carries a **parent-branch Context Summary** generated via [Branch Summary template](settings/prompt-editor.md#4a-branch-summary-template). This summary is injected as prompt-assembly position **#10 (Context Summary)** going forward. |

7. **CTA** (red pill, full width):
   - "Keep previous messages" mode → **"Create Branch"**
   - "Summarize & start fresh" mode → **"Summarize & Branch"**

### What happens after submit

- A new [Conversation](chat.md#b-conversations-list-img_4132) record is created for the same Character, linked to the parent via `branchParentConversationId` (and `branchParentMessageId` for the fork anchor).
- The branch appears in the Character's Conversations list ([Chat/IMG_4132](../../../References/PersonaLLM/AppReferenceImages/RawScreenshots/Chat/IMG_4132.PNG)) as an independent row.
- The auto-generated title (or user-entered Branch Name) is used as the Conversation title.
- In **Summarize & start fresh** mode, the parent-branch summary is stored on the new Conversation and injected every turn as position #10 of the [prompt assembly](../07-prompts-and-llm-touchpoints.md).

### Architecture conclusion

PersonaLLM branches are **new Conversation records** (not tree nodes within one conversation). This answers the Pass C open question: forking clones the conversation rather than maintaining a tree of variants inside a single Conversation.

Relationship:
```
Conversation (parent)
  └── forkedAt: Message(id=X)
      ├── "Keep previous messages"  → new Conversation with messages[0..X] copied
      └── "Summarize & start fresh" → new Conversation empty + parentBranchSummary text
```

## User Extensions / Scope Decisions

- Keep both modes verbatim. Both have real product value:
  - **Keep previous messages** = traditional variant exploration; preserves full history.
  - **Summarize & start fresh** = clean slate with continuity; useful when the chat drifted off-topic.
- Keep the **auto-generated Branch Name** via `TITLE:` convention. Let the user override.
- In the clone's data model ([03-data-model.md](../03-data-model.md)):
  - `Conversation.branchParentConversationId` → parent Conversation
  - `Conversation.branchParentMessageId` → anchor Message
  - `Conversation.parentBranchSummary` → text (only populated in "Summarize & start fresh" mode)
- On web, the destructive red theme is overkill for a non-destructive action — use the regular primary color. "Keep previous messages" is not a risk.
- Show the **parent conversation breadcrumb** at the top of a branched conversation (e.g., `Parent: "[Title]" · Forked at message 42`) so users can navigate back.

## Open Questions

- Can a branch be forked again (branch-of-a-branch)? Likely yes, but confirm.
- Does the parent conversation "know" it has children (for a tree-view UI), or is the relationship unidirectional?
- What happens to the branch when the parent Conversation is deleted? Cascade, or orphan?
- Is there a "Compare branches" view, or does the user switch by tapping different rows in the Conversations list?
