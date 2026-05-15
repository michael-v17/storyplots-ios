import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { isAnonymous, useSession } from "../../lib/session";
import { avatarUrl, loadPersona, type Persona } from "../../lib/persona";

// Icon-rail footer for the collapsed persistent sidebar. Mirrors the
// UserSection data flow (persona photo + fallback) but compact: a single
// circular button. Anonymous/signed-out users get a "Sign up" pictogram
// that still links to /sign-up.
export function CollapsedUserAvatar({ onNavClick }: { onNavClick?: () => void }) {
  const sess = useSession();
  const session = sess.status === "ready" ? sess.session : null;
  const [persona, setPersona] = useState<Persona | null>(null);
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!session || isAnonymous(session)) { setPersona(null); setPhotoUrl(null); return; }
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

  const anon = !session || isAnonymous(session);
  const href = anon ? (session ? "/sign-up" : "/sign-in") : "/profile";
  const title = anon
    ? (session ? "Sign up to access from anywhere" : "Sign in")
    : persona?.name ?? "Your persona";

  return (
    <div style={{ display: "flex", justifyContent: "center", padding: "0.5rem", margin: "0 4px" }}>
      <Link
        to={href}
        data-testid="persona-link-collapsed"
        onClick={onNavClick}
        title={title}
        aria-label={title}
        style={{
          // 32×32 matches the expanded YourPersonaCard avatar (and the
          // RecentChats avatars), so identity is consistent across all
          // sidebar states.
          width: 32, height: 32, borderRadius: "50%",
          backgroundColor: "var(--sp-border)",
          display: "inline-flex", alignItems: "center", justifyContent: "center",
          overflow: "hidden",
          color: "var(--sp-fg-2)",
          fontSize: "0.85rem",
        }}
      >
        {photoUrl ? (
          <img src={photoUrl} alt="" width={32} height={32} loading="lazy" decoding="async" style={{ objectFit: "cover" }} />
        ) : anon ? (
          <span aria-hidden>↗</span>
        ) : (
          <span aria-hidden>👤</span>
        )}
      </Link>
    </div>
  );
}
