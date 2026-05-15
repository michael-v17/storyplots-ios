import { useState } from "react";
import { Link } from "react-router-dom";
import { isAnonymous, useSession } from "../../lib/session";

const KEY = "sp:home-nudge-dismissed";

export function HomeNudge() {
  const sess = useSession();
  const [dismissed, setDismissed] = useState<boolean>(() => localStorage.getItem(KEY) === "1");

  if (sess.status !== "ready") return null;
  if (!isAnonymous(sess.session)) return null;
  if (dismissed) return null;

  return (
    <div data-testid="home-nudge" style={style}>
      <span style={{ color: "var(--sp-fg-1)" }}>Sign up to access your data from anywhere — your guest data will carry over.</span>
      <Link to="/sign-up" style={{ color: "var(--sp-brand-1)", fontWeight: 600 }}>Sign up</Link>
      <button
        type="button"
        aria-label="Dismiss"
        onClick={() => { localStorage.setItem(KEY, "1"); setDismissed(true); }}
        style={{ background: "transparent", border: "none", color: "var(--sp-fg-3)", fontSize: "1.1rem", padding: "0 0.25rem" }}
      >×</button>
    </div>
  );
}

const style: React.CSSProperties = {
  display: "flex",
  gap: "0.75rem",
  alignItems: "center",
  justifyContent: "center",
  padding: "0.6rem 1rem",
  background: "var(--sp-bg-2)",
  borderBottom: "1px solid var(--sp-border)",
};
