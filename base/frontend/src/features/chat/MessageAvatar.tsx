import { useEffect, useState } from "react";
import { avatarUrl } from "../../lib/avatars";

type Props = {
  role: "user" | "assistant";
  avatarRef: string | null;
  accentColor: string;
  name: string;
  size?: number;
};

// Circle avatar, default 32 px (message feed). Pass `size={36}` for the
// chat header. When avatarRef resolves, renders the image; otherwise an
// accent-color circle with the first initial. Kept intentionally
// undecorated — no ring / shadow — per the minimal v0 design.
export function MessageAvatar({ role, avatarRef, accentColor, name, size = 32 }: Props) {
  const [url, setUrl] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setUrl(null);
    if (!avatarRef) return;
    avatarUrl(avatarRef).then((u) => { if (!cancelled) setUrl(u); }).catch(() => {});
    return () => { cancelled = true; };
  }, [avatarRef]);

  const initial = (name || "?").trim().charAt(0).toUpperCase();

  return (
    <div
      data-testid={`message-avatar-${role}`}
      aria-hidden
      style={{
        width: size, height: size, borderRadius: "50%",
        backgroundColor: url ? "var(--sp-bg-3)" : accentColor,
        backgroundImage: url ? `url(${url})` : undefined,
        backgroundSize: "cover", backgroundPosition: "center",
        opacity: url ? 1 : 0.75,
        color: "white", fontSize: `${Math.max(0.7, size / 40)}em`, fontWeight: "bold",
        display: "flex", alignItems: "center", justifyContent: "center",
        overflow: "hidden", flexShrink: 0,
      }}
    >
      {!url && initial}
    </div>
  );
}
