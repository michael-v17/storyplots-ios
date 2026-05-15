import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { loadConversation, type Conversation } from "../../lib/conversations";

type Props = {
  conversation: Conversation;
};

export function BranchBreadcrumb({ conversation }: Props) {
  const parentId = conversation.branch_parent_conversation_id;
  const [parent, setParent] = useState<Conversation | null>(null);

  useEffect(() => {
    let cancelled = false;
    if (!parentId) { setParent(null); return; }
    loadConversation(parentId).then((p) => { if (!cancelled) setParent(p); }).catch(() => {});
    return () => { cancelled = true; };
  }, [parentId]);

  if (!parentId) return null;

  const modeLabel = conversation.branch_mode === "summarize_fresh" ? "summarized fork" : "forked";
  const title = parent?.title ?? "…";

  return (
    <Link
      data-testid="branch-breadcrumb"
      to={`/chat/${parent?.character_id ?? conversation.character_id}/${parentId}`}
      style={{
        display: "inline-flex", alignItems: "center", gap: "0.35rem",
        fontSize: "0.75em", color: "var(--sp-fg-3)",
        padding: "0.2rem 0.6rem", borderRadius: "var(--sp-radius)",
        background: "var(--sp-bg-2)",
        border: "1px solid var(--sp-border-soft)",
        textDecoration: "none",
      }}
    >
      <span>↳</span>
      <span>Parent: "{title}" · {modeLabel}</span>
    </Link>
  );
}
