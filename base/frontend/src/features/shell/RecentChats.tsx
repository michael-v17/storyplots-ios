import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { Link, useMatch } from "react-router-dom";
import { avatarUrl } from "../../lib/avatars";
import { supabase } from "../../lib/supabase";
import { listRecentConversations, type Conversation } from "../../lib/conversations";
import { relativeTime } from "../../lib/relativeTime";
import { useSession } from "../../lib/session";

type CharacterLite = {
  id: string;
  avatar_ref: string | null;
  accent_color: string;
};

// `fitToHeight` is the mobile-drawer mode (cycle 0132): instead of letting the
// list overflow into a scroll, render only as many rows as fit the space left
// after the nav items + footer.
type RecentChatsProps = { collapsed?: boolean; fitToHeight?: boolean };

export function RecentChats({ collapsed = false, fitToHeight = false }: RecentChatsProps = {}) {
  const sess = useSession();
  const userId = sess.status === "ready" ? sess.session?.user.id ?? null : null;
  const [convs, setConvs] = useState<Conversation[] | null>(null);
  const [chars, setChars] = useState<Record<string, CharacterLite>>({});
  const [avatars, setAvatars] = useState<Record<string, string | null>>({});
  const [snippets, setSnippets] = useState<Record<string, string>>({});
  const listRef = useRef<HTMLDivElement>(null);
  const [maxRows, setMaxRows] = useState<number | null>(null);

  // Cycle 0132 — in fit-to-height mode, measure the space the list container
  // gets (flex:1 inside the fixed-height drawer panel) and the height of a
  // rendered row, then cap the list so it never scrolls.
  //
  // No measure→slice→re-measure loop: the list container is `flex:1;
  // overflow:hidden`, so its clientHeight is fixed by the surrounding flexbox
  // and does NOT change with the row count; `setMaxRows` to the same value is
  // a React no-op. `convs` IS a required dependency — the drawer Sidebar is
  // always mounted and renders before conversations load, so the effect must
  // re-run once `convs` populates and the row DOM exists for `measure()` to
  // read `[data-recent-row]`. useLayoutEffect avoids a flash of the full list.
  useLayoutEffect(() => {
    if (!fitToHeight) { setMaxRows(null); return; }
    const el = listRef.current;
    if (!el) return;
    const measure = () => {
      const avail = el.clientHeight;
      const row = el.querySelector<HTMLElement>("[data-recent-row]");
      const rowH = row?.offsetHeight ?? 0;
      if (avail > 0 && rowH > 0) setMaxRows(Math.max(1, Math.floor(avail / rowH)));
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [fitToHeight, convs]);

  useEffect(() => {
    if (!userId) { setConvs([]); return; }
    let cancelled = false;

    async function doLoad() {
      const list = await listRecentConversations(userId!, 5).catch(() => [] as Conversation[]);
      if (cancelled) return;
      setConvs(list);
      const charIds = Array.from(new Set(list.map((c) => c.character_id)));
      const convIds = list.map((c) => c.id);

      // Parallel: character metadata + last-message snippets per conversation.
      const [charData, snippetEntries] = await Promise.all([
        charIds.length
          ? supabase.from("characters").select("id, avatar_ref, accent_color").in("id", charIds)
          : Promise.resolve({ data: [] as CharacterLite[] } as const),
        Promise.all(convIds.map(async (cid) => [cid, await fetchSnippet(cid)] as const)),
      ]);
      if (cancelled) return;

      const byId: Record<string, CharacterLite> = {};
      for (const c of (charData.data ?? []) as CharacterLite[]) byId[c.id] = c;
      setChars(byId);
      setSnippets(Object.fromEntries(snippetEntries));

      const avatarEntries = await Promise.all(
        (charData.data ?? []).map(async (c) => [c.id, c.avatar_ref ? await avatarUrl(c.avatar_ref).catch(() => null) : null] as const),
      );
      if (cancelled) return;
      setAvatars(Object.fromEntries(avatarEntries));
    }

    doLoad();

    const channel = supabase
      .channel(`recent-chats-${userId}`)
      .on("postgres_changes", {
        event: "*", schema: "public", table: "conversations",
        filter: `user_id=eq.${userId}`,
      }, () => doLoad())
      .on("postgres_changes", {
        event: "UPDATE", schema: "public", table: "characters",
        filter: `user_id=eq.${userId}`,
      }, () => doLoad())
      .subscribe();

    return () => {
      cancelled = true;
      void supabase.removeChannel(channel);
    };
  }, [userId]);

  // Returns a trimmed snippet for the most recent message in a conversation.
  // Assistant messages store the current text in message_variants, so we
  // resolve active_variant_id when the row's `text` column is null.
  async function fetchSnippet(convId: string): Promise<string> {
    const { data: msgs } = await supabase
      .from("messages")
      .select("id, role, text, active_variant_id")
      .eq("conversation_id", convId)
      .order("created_at", { ascending: false })
      .limit(1);
    const m = msgs?.[0];
    if (!m) return "";
    if (m.text) return m.text;
    if (m.role === "assistant" && m.active_variant_id) {
      const { data: v } = await supabase
        .from("message_variants")
        .select("content")
        .eq("id", m.active_variant_id)
        .single();
      return (v?.content as string | undefined) ?? "";
    }
    return "";
  }

  // Active chat detection — replaces the old "Chat" pseudo-nav-item;
  // visual distinction now lives on the active conversation row inside
  // RecentChats itself (highlighted bg + thicker accent ring).
  const chatMatch = useMatch("/chat/:characterId/:conversationId");
  const activeConvId = chatMatch?.params.conversationId ?? null;

  if (convs === null) return <Skeleton collapsed={collapsed} />;
  if (convs.length === 0) return null;

  // Plan 0101 §4: collapsed sidebar shows just avatar circles in a
  // vertical column. Each avatar is the link to its conversation; tooltip
  // (title) shows the character name. No section label, no snippets.
  if (collapsed) {
    return (
      <section
        data-testid="recent-chats"
        style={{
          padding: "0.6rem 0",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: "0.5rem",
        }}
      >
        {convs.map((conv) => {
          const char = chars[conv.character_id];
          const photo = avatars[conv.character_id];
          const name = conv.character_snapshot?.name ?? "Character";
          const accent = char?.accent_color ?? "var(--sp-border-strong)";
          const isActive = conv.id === activeConvId;
          return (
            <Link
              key={conv.id}
              to={`/chat/${conv.character_id}/${conv.id}`}
              data-testid={`recent-${conv.id}`}
              data-active={isActive ? "true" : "false"}
              title={name}
              aria-label={name}
              aria-current={isActive ? "page" : undefined}
              style={{
                display: "block",
                width: 32,
                height: 32,
                borderRadius: "50%",
                backgroundColor: photo ? "var(--sp-bg-3)" : accent,
                backgroundImage: photo ? `url(${photo})` : undefined,
                backgroundSize: photo ? "cover" : undefined,
                backgroundPosition: photo ? "center" : undefined,
                color: "white",
                fontSize: "0.8em",
                fontWeight: "bold",
                lineHeight: "32px",
                textAlign: "center",
                textDecoration: "none",
                // Active: thicker accent ring + white outer halo so the
                // current chat pops against the rest of the avatar
                // column. Idle: standard 2/3px ring.
                boxShadow: isActive
                  ? `0 0 0 2px var(--sp-bg), 0 0 0 5px ${accent}, 0 0 12px -2px ${accent}`
                  : `0 0 0 2px var(--sp-bg), 0 0 0 3px ${accent}`,
                flexShrink: 0,
              }}
            >
              {!photo && name.trim().charAt(0).toUpperCase()}
            </Link>
          );
        })}
      </section>
    );
  }

  // In fit-to-height mode, render only the rows that fit (maxRows). Until the
  // first measure lands maxRows is null → render all, the layout effect slices
  // before paint.
  const shown = fitToHeight && maxRows != null ? convs.slice(0, maxRows) : convs;

  return (
    <section data-testid="recent-chats" style={fitToHeight ? fitSectionStyle : { padding: "0.5rem 0" }}>
      <div style={labelStyle}>RECENT CHATS</div>
      <div ref={listRef} style={fitToHeight ? fitListStyle : undefined}>
      {shown.map((conv) => {
        const char = chars[conv.character_id];
        const photo = avatars[conv.character_id];
        const name = conv.character_snapshot?.name ?? "Character";
        const snippet = snippets[conv.id] ?? "";
        const accent = char?.accent_color ?? "var(--sp-border-strong)";
        const isActive = conv.id === activeConvId;
        return (
          <Link
            key={conv.id}
            to={`/chat/${conv.character_id}/${conv.id}`}
            data-testid={`recent-${conv.id}`}
            data-recent-row
            data-active={isActive ? "true" : "false"}
            aria-current={isActive ? "page" : undefined}
            style={rowStyle}
          >
            <div
              aria-hidden
              style={{
                width: 32, height: 32, borderRadius: "50%",
                backgroundColor: photo ? "var(--sp-bg-3)" : accent,
                backgroundImage: photo ? `url(${photo})` : undefined,
                backgroundSize: photo ? "cover" : undefined,
                backgroundPosition: photo ? "center" : undefined,
                color: "white", fontSize: "0.8em", fontWeight: "bold",
                display: "flex", alignItems: "center", justifyContent: "center",
                flexShrink: 0,
                // Active: same 3px ring as idle BUT add a glow halo so
                // the active chat reads as alive without the bg-3 fill
                // on the row that felt heavy. Idle: ring only, no glow.
                boxShadow: isActive
                  ? `0 0 0 2px var(--sp-bg-1), 0 0 0 3px ${accent}, 0 0 14px 2px ${accent}`
                  : `0 0 0 2px var(--sp-bg-1), 0 0 0 3px ${accent}`,
              }}
            >
              {!photo && name.trim().charAt(0).toUpperCase()}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: "flex", alignItems: "baseline", gap: "0.4rem" }}>
                <span style={{ flex: 1, minWidth: 0, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", fontSize: "0.9em", fontWeight: 500, color: "var(--sp-fg)" }}>
                  {name}
                </span>
                {conv.last_message_at && (
                  <span style={{ fontSize: "0.7em", color: "var(--sp-fg-4)", flexShrink: 0 }}>
                    {relativeTime(conv.last_message_at)}
                  </span>
                )}
              </div>
              {snippet && (
                <div style={{ fontSize: "0.75em", color: "var(--sp-fg-3)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                  {snippet.slice(0, 80)}
                </div>
              )}
            </div>
          </Link>
        );
      })}
      </div>
    </section>
  );
}

function Skeleton({ collapsed = false }: { collapsed?: boolean }) {
  if (collapsed) {
    return (
      <section
        aria-hidden
        style={{
          padding: "0.6rem 0",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: "0.5rem",
        }}
      >
        {[0, 1, 2].map((i) => (
          <div key={i} style={{ width: 32, height: 32, borderRadius: "50%", background: "var(--sp-bg-3)" }} />
        ))}
      </section>
    );
  }
  return (
    <section aria-hidden style={{ padding: "0.5rem 0" }}>
      <div style={labelStyle}>RECENT CHATS</div>
      {[0, 1, 2].map((i) => (
        <div key={i} style={{ ...rowStyle, cursor: "default", background: "transparent" }}>
          <div style={{ width: 24, height: 24, borderRadius: "50%", background: "var(--sp-bg-3)", flexShrink: 0 }} />
          <div style={{ flex: 1, height: 12, background: "var(--sp-bg-3)", borderRadius: "var(--sp-radius)" }} />
        </div>
      ))}
    </section>
  );
}

const labelStyle: React.CSSProperties = {
  fontSize: "var(--sp-text-xs)",
  fontWeight: 600,
  letterSpacing: "var(--sp-tracking-caps)",
  textTransform: "uppercase",
  color: "var(--sp-fg-3)",
  padding: "0 1rem 0.35rem",
};

const rowStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: "0.6rem",
  padding: "0.6rem 1rem",
  color: "inherit",
  textDecoration: "none",
  fontSize: "0.9em",
  borderRadius: "var(--sp-radius)",
};

// Cycle 0132 — fit-to-height (mobile drawer): the section claims the space
// left between the nav items and the footer, the label stays pinned, and the
// row list clips instead of scrolling. The layout effect caps the row count so
// nothing is actually clipped mid-row.
const fitSectionStyle: React.CSSProperties = {
  padding: "0.5rem 0",
  flex: 1,
  minHeight: 0,
  display: "flex",
  flexDirection: "column",
  overflow: "hidden",
};
const fitListStyle: React.CSSProperties = {
  flex: 1,
  minHeight: 0,
  overflow: "hidden",
};
