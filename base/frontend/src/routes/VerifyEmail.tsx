import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { supabase } from "../lib/supabase";
import { useDocumentTitle } from "../lib/useDocumentTitle";

// Public route (outside AppShell) shown after a successful signup. Tells
// the user to check their inbox and click the verification link. Includes
// a resend button with a 30 s cooldown so users don't hammer Supabase's
// SMTP rate limit.
export function VerifyEmail() {
  useDocumentTitle("Verify Email");
  const [params] = useSearchParams();
  const email = params.get("email") ?? "";

  const [busy, setBusy] = useState(false);
  const [cooldown, setCooldown] = useState(0);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (cooldown <= 0) return;
    const id = window.setTimeout(() => setCooldown((c) => c - 1), 1000);
    return () => window.clearTimeout(id);
  }, [cooldown]);

  async function resend() {
    if (!email || busy || cooldown > 0) return;
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      const { error: err } = await supabase.auth.resend({
        type: "signup",
        email,
        options: { emailRedirectTo: `${window.location.origin}/` },
      });
      if (err) {
        setError(err.message);
      } else {
        setNotice("Verification email re-sent. Check your inbox.");
        setCooldown(30);
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <main
      data-testid="verify-email"
      style={{
        minHeight: "100vh",
        display: "grid",
        placeItems: "center",
        background: "var(--sp-bg)",
        color: "var(--sp-fg)",
        padding: "1.5rem",
      }}
    >
      <div
        style={{
          width: "100%",
          maxWidth: 440,
          padding: "2rem 1.75rem",
          background: "var(--sp-bg-2)",
          border: "1px solid var(--sp-border)",
          borderRadius: "var(--sp-radius)",
          display: "flex",
          flexDirection: "column",
          gap: 18,
        }}
      >
        <img
          src="/logos/logo.png"
          alt="StoryPlots"
          style={{ height: 40, width: "auto", alignSelf: "flex-start" }}
        />
        <h1 className="sp-h2" style={{ margin: 0 }}>
          Check your email
        </h1>
        <p style={{ margin: 0, color: "var(--sp-fg-2)", lineHeight: 1.5 }}>
          We sent a verification link to{" "}
          {email ? (
            <strong data-testid="verify-email-address" style={{ color: "var(--sp-fg)" }}>
              {email}
            </strong>
          ) : (
            <strong style={{ color: "var(--sp-fg)" }}>your email address</strong>
          )}
          . Click the link to activate your account, then come back here to sign in.
        </p>

        {notice && (
          <p
            role="status"
            data-testid="verify-email-notice"
            style={{ margin: 0, fontSize: 13, color: "var(--sp-fg-2)" }}
          >
            {notice}
          </p>
        )}
        {error && (
          <p
            role="alert"
            data-testid="verify-email-error"
            style={{
              margin: 0,
              padding: "10px 12px",
              background: "var(--sp-destructive-soft)",
              border: "1px solid var(--sp-destructive)",
              borderRadius: "var(--sp-radius)",
              color: "var(--sp-fg)",
              fontSize: 13,
            }}
          >
            {error}
          </p>
        )}

        <button
          type="button"
          data-testid="verify-email-resend"
          onClick={resend}
          disabled={!email || busy || cooldown > 0}
          style={{
            padding: "10px 16px",
            border: "none",
            borderRadius: "var(--sp-radius)",
            background: "var(--sp-brand-grad)",
            color: "var(--sp-fg-on-brand)",
            fontWeight: 600,
            fontSize: 15,
            cursor: !email || busy || cooldown > 0 ? "not-allowed" : "pointer",
            opacity: !email || busy || cooldown > 0 ? 0.6 : 1,
          }}
        >
          {busy
            ? "Sending…"
            : cooldown > 0
              ? `Resend in ${cooldown}s`
              : "Resend verification email"}
        </button>

        <p style={{ margin: 0, fontSize: 13, color: "var(--sp-fg-3)" }}>
          Already verified?{" "}
          <Link
            to="/sign-in"
            data-testid="verify-email-signin"
            style={{ color: "var(--sp-brand-1)", fontWeight: 500 }}
          >
            Sign in
          </Link>
          .
        </p>
      </div>
    </main>
  );
}
