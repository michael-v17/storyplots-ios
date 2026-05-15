import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { loadCharacter, type Character } from "../lib/characters";
import {
  listConversationsForCharacter,
  loadConversation,
  type Conversation,
} from "../lib/conversations";
import { useSession } from "../lib/session";
import { ChatShellSkeleton } from "../lib/ChatShellSkeleton";
import { ChatShell } from "../features/chat/ChatShell";
import { useDocumentTitle } from "../lib/useDocumentTitle";

type State =
  | { status: "loading" }
  | { status: "missing"; reason?: string }
  | { status: "ready"; character: Character; conversation: Conversation; conversations: Conversation[] };

export function Chat() {
  const { characterId = "", conversationId = "" } = useParams<{ characterId: string; conversationId: string }>();
  const sess = useSession();
  const userId = sess.status === "ready" ? sess.session?.user.id ?? null : null;
  const [state, setState] = useState<State>({ status: "loading" });
  useDocumentTitle(state.status === "ready" ? state.character.name : "Chat");

  useEffect(() => {
    if (sess.status !== "ready" || !userId) return;
    let cancelled = false;
    (async () => {
      try {
        const [char, conv, list] = await Promise.all([
          loadCharacter(characterId),
          loadConversation(conversationId),
          listConversationsForCharacter(userId, characterId),
        ]);
        if (cancelled) return;
        if (!char || !conv || conv.character_id !== characterId) {
          setState({ status: "missing" });
          return;
        }
        setState({ status: "ready", character: char, conversation: conv, conversations: list });
      } catch (err) {
        // Plan 0123: previously a thrown promise (network drop, Supabase
        // hiccup, expired JWT) left the chat stuck on the skeleton forever
        // because the IIFE rejected silently. Fall through to "missing"
        // with the error message so the user gets a refresh affordance
        // instead of a permanent loading state.
        if (cancelled) return;
        console.error("[Chat] failed to load conversation", err);
        setState({ status: "missing", reason: err instanceof Error ? err.message : String(err) });
      }
    })();
    return () => { cancelled = true; };
  }, [sess.status, userId, characterId, conversationId]);

  if (state.status === "loading") return <ChatShellSkeleton testId="chat-loading" />;
  if (state.status === "missing") {
    return (
      <main data-testid="chat-missing" style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: "1rem", padding: "2rem", height: "100%", textAlign: "center", color: "var(--sp-fg-2)" }}>
        <strong style={{ color: "var(--sp-fg)", fontSize: "1.05rem" }}>
          Couldn't load this conversation.
        </strong>
        {state.reason && (
          <span style={{ fontSize: "0.85em", color: "var(--sp-fg-3)", maxWidth: 480 }}>
            {state.reason}
          </span>
        )}
        <button
          type="button"
          onClick={() => window.location.reload()}
          style={{ padding: "0.5rem 1rem", borderRadius: "var(--sp-radius)", background: "var(--sp-bg-2)", border: "1px solid var(--sp-border)", color: "var(--sp-fg)", cursor: "pointer" }}
        >
          Reload
        </button>
      </main>
    );
  }

  return (
    <ChatShell
      character={state.character}
      conversation={state.conversation}
      conversations={state.conversations}
      userId={userId!}
      onConversationsChange={(next) =>
        setState((prev) => prev.status === "ready" ? { ...prev, conversations: next } : prev)
      }
    />
  );
}
