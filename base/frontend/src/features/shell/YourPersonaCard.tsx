import { useEffect, useState } from "react";
import { Link, useMatch } from "react-router-dom";
import { useSession } from "../../lib/session";
import { avatarUrl, loadPersona, type Persona } from "../../lib/persona";

// Footer Persona entry. Renders as a ghost row matching Sidebar's
// itemStyle (transparent bg → bg-3 when active) so the three footer
// rows (Persona / Settings / Sign out) read as one consistent stack.
// The avatar's 36px size is the only visual differentiator vs the
// 18px icons in the other rows — heavy enough to anchor identity
// without competing with selected fills nearby.
export function YourPersonaCard({ onNavClick }: { onNavClick?: () => void }) {
  const isActive = !!useMatch("/profile");
  const sess = useSession();
  const session = sess.status === "ready" ? sess.session : null;
  const [persona, setPersona] = useState<Persona | null>(null);
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!session) { setPersona(null); setPhotoUrl(null); return; }
    let cancelled = false;
    (async () => {
      const p = await loadPersona(session.user.id).catch(() => null);
      if (cancelled) return;
      setPersona(p);
      setPhotoUrl(await avatarUrl(p?.photo_ref ?? null));
    })();
    return () => { cancelled = true; };
  }, [session?.user.id]);

  if (sess.status !== "ready") return null;
  if (!session) return null;

  const label = persona?.name ?? "Your Persona";
  const hint = persona ? "Tap to edit" : "Tap to set up";

  return (
    <Link
      to="/profile"
      data-testid="sidebar-persona-card"
      onClick={onNavClick}
      style={{ ...cardStyle, background: isActive ? "var(--sp-bg-3)" : "transparent" }}
    >
      <div
        aria-hidden
        style={{
          // 32×32 mirrors the RecentChats avatars rendered just above
          // this row in expanded mode — so the right-side column of
          // circular avatars reads as one continuous vertical thread.
          // --sp-border (luma ~88) is the mid-gray that's visible
          // against the page bg without competing with content; when
          // a photo loads, backgroundImage covers it.
          width: 32, height: 32, borderRadius: "50%",
          backgroundColor: "var(--sp-border)",
          backgroundImage: photoUrl ? `url(${photoUrl})` : undefined,
          backgroundSize: photoUrl ? "cover" : undefined,
          backgroundPosition: photoUrl ? "center" : undefined,
          color: "var(--sp-fg-2)",
          display: "flex", alignItems: "center", justifyContent: "center",
          flexShrink: 0,
          fontSize: "0.85rem",
        }}
      >
        {!photoUrl && "👤"}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontWeight: 600, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", color: "var(--sp-fg)", fontSize: "0.95em" }}>{label}</div>
        <div style={{ fontSize: "0.75em", color: "var(--sp-fg-3)" }}>{hint}</div>
      </div>
      <span aria-hidden style={{ color: "var(--sp-fg-3)" }}>›</span>
    </Link>
  );
}

const cardStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: "0.65rem",
  padding: "0.5rem 0.6rem",
  margin: "0 0.5rem",
  // Hairline border in the same neutral as the collapse-toggle button
  // and the chat ghost pills — turns the persona row into a small
  // card that reads as a divider between the recent-chats list above
  // and the Settings + Sign out actions below.
  border: "1px solid var(--sp-border)",
  borderRadius: "var(--sp-radius)",
  textDecoration: "none",
  color: "inherit",
  transition: "background 120ms var(--sp-ease)",
};
