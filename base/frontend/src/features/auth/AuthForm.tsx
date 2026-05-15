import { useEffect, useState, type CSSProperties } from "react";
import { Link, useNavigate } from "react-router-dom";
import { supabase } from "../../lib/supabase";

type Mode = "signin" | "signup" | "reset";

const REDIRECT_TO = `${window.location.origin}/reset-password`;
const HERO_AVIF = "/images/auth-hero.avif";
const HERO_WEBP = "/images/auth-hero.webp";

// Hero image as a <picture> element rather than CSS background-image. Lets
// the browser pick AVIF when supported (smaller, better quality) and fall
// back to WebP otherwise. Object-fit cover behaves like background-size:
// cover but with proper format negotiation.
function HeroPicture({ objectPosition = "center" }: { objectPosition?: string }) {
  return (
    <picture>
      <source srcSet={HERO_AVIF} type="image/avif" />
      <source srcSet={HERO_WEBP} type="image/webp" />
      <img
        src={HERO_WEBP}
        alt=""
        aria-hidden="true"
        style={{
          position: "absolute",
          inset: 0,
          width: "100%",
          height: "100%",
          objectFit: "cover",
          objectPosition,
          display: "block",
        }}
      />
    </picture>
  );
}

// Two intentionally different layouts (Plan 0099 §"Decisión de shape"): glass
// card flotante en L, sheet sólida desde abajo en S. Same state machine, same
// testids. Detect via matchMedia rather than CSS so each branch can be a
// distinct DOM tree (avoids hidden duplicates and keeps focus management
// clean across the breakpoint switch).
//
// Breakpoint sits at 1024px because L mode shows BOTH the card column on the
// left AND the marketing pitch text on the right; with the card column
// reserving ~530 px, anything narrower than ~1024 squashes the right area
// below readable width. Below the cutoff we collapse to S (top-image +
// bottom-sheet) — mobile portrait, tablet portrait, and narrow laptop windows
// all land here.
const COMPACT_BREAKPOINT = "(max-width: 1023px)";

// v0.2 is registered-only; anonymous sessions are no longer auto-created
// (boot.ts removed in cycle 0106, AppShell now redirects unauthenticated
// visitors to /sign-in). The signup path always creates a fresh email
// account — no more anon→linked-account upgrade branch.
export function AuthForm({ mode }: { mode: Mode }) {
  const nav = useNavigate();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  // Cycle 0110: when sign-in fails because the user has not confirmed
  // their email, we surface a dedicated message + a resend button right
  // in the form (rather than a generic error). `null` means no unverified
  // state; a string means "show the resend block for this email".
  const [unverifiedEmail, setUnverifiedEmail] = useState<string | null>(null);
  const [resendCooldown, setResendCooldown] = useState(0);
  const [resendBusy, setResendBusy] = useState(false);

  const [compact, setCompact] = useState<boolean>(() =>
    typeof window !== "undefined" ? window.matchMedia(COMPACT_BREAKPOINT).matches : false,
  );
  useEffect(() => {
    const mql = window.matchMedia(COMPACT_BREAKPOINT);
    const update = () => setCompact(mql.matches);
    if (mql.addEventListener) {
      mql.addEventListener("change", update);
      return () => mql.removeEventListener("change", update);
    }
    mql.addListener(update);
    return () => mql.removeListener(update);
  }, []);

  // Detect recovery-session entry on /reset-password. Supabase puts
  // `type=recovery` in the URL fragment when forwarding from its email link,
  // then asynchronously parses it and fires PASSWORD_RECOVERY. We treat the
  // presence of the hash as "resolving" until the SDK confirms, so a user
  // who submits fast doesn't send a second reset email.
  const [recovering, setRecovering] = useState<boolean | "resolving">(() => {
    if (mode !== "reset") return false;
    return window.location.hash.includes("type=recovery") ? "resolving" : false;
  });
  useEffect(() => {
    if (mode !== "reset") return;
    const { data: sub } = supabase.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY") setRecovering(true);
    });
    return () => sub.subscription.unsubscribe();
  }, [mode]);

  async function withBusy(fn: () => Promise<{ error: { message: string } | null }>) {
    setError(null);
    setSubmitting(true);
    try {
      const { error } = await fn();
      if (error) setError(error.message);
      return !error;
    } finally {
      setSubmitting(false);
    }
  }

  // Resend cooldown ticks down 1/s while > 0. Keeps users from hammering
  // Supabase's SMTP rate limit (default ~4 emails/hour, easy to exhaust).
  useEffect(() => {
    if (resendCooldown <= 0) return;
    const id = window.setTimeout(() => setResendCooldown((c) => c - 1), 1000);
    return () => window.clearTimeout(id);
  }, [resendCooldown]);

  async function resendVerification() {
    if (!unverifiedEmail || resendBusy || resendCooldown > 0) return;
    setResendBusy(true);
    try {
      const { error } = await supabase.auth.resend({
        type: "signup",
        email: unverifiedEmail,
        options: { emailRedirectTo: `${window.location.origin}/` },
      });
      if (error) {
        setError(error.message);
      } else {
        setNotice(`Verification email sent to ${unverifiedEmail}.`);
        setResendCooldown(30);
      }
    } finally {
      setResendBusy(false);
    }
  }

  // OAuth flow temporarily wired but unused — Google button is disabled and
  // GitHub was removed. Re-introduce when the provider is configured in
  // Supabase. The anon→linkIdentity vs signInWithOAuth split is the part to
  // preserve when re-adding.

  async function onEmailSubmit(e: React.FormEvent) {
    e.preventDefault();
    setUnverifiedEmail(null);
    setNotice(null);
    if (mode === "signin") {
      setError(null);
      setSubmitting(true);
      try {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) {
          // Supabase returns code: "email_not_confirmed" on a 400 when the
          // user hasn't clicked the verification link. Promote that into a
          // dedicated resend block instead of a generic error string.
          if (error.code === "email_not_confirmed") {
            setUnverifiedEmail(email);
          } else {
            setError(error.message);
          }
          return;
        }
        nav("/");
      } finally {
        setSubmitting(false);
      }
      return;
    }
    if (mode === "signup") {
      // emailRedirectTo lands the user back on the app root after they
      // click the magic link. Supabase JS v2 with detectSessionInUrl
      // (default true) auto-handles the `?token_hash=…&type=signup`
      // query string at `/` and exchanges it for a session — no
      // dedicated callback route needed.
      const ok = await withBusy(() =>
        supabase.auth.signUp({
          email,
          password,
          options: { emailRedirectTo: `${window.location.origin}/` },
        }),
      );
      if (ok) nav(`/verify-email?email=${encodeURIComponent(email)}`);
      return;
    }
    if (recovering === "resolving") return;
    if (recovering === true) {
      const ok = await withBusy(() => supabase.auth.updateUser({ password }));
      if (ok) nav("/");
      return;
    }
    const ok = await withBusy(() =>
      supabase.auth.resetPasswordForEmail(email, { redirectTo: REDIRECT_TO }),
    );
    if (ok) setNotice("Check your email for a password reset link.");
  }

  if (recovering === "resolving") {
    return (
      <main
        data-testid="auth-reset"
        style={{
          minHeight: "100vh",
          display: "grid",
          placeItems: "center",
          background: "var(--sp-bg)",
          color: "var(--sp-fg-2)",
          padding: "1rem",
        }}
      >
        <p>Preparing password reset…</p>
      </main>
    );
  }

  const isRecovering = recovering === true;

  function titleFor(): string {
    if (mode === "signin") return "Welcome back";
    if (mode === "signup") return "Create your account";
    return isRecovering ? "Set a new password" : "Reset your password";
  }

  function subFor(): string {
    if (mode === "signin") return "Sign in to your StoryPlots workspace.";
    if (mode === "signup") return "Step into your first story in seconds.";
    return isRecovering
      ? "Choose a new password for your account."
      : "We'll email you a link to set a new password.";
  }

  function submitLabel(): string {
    if (submitting) return "…";
    if (mode === "signin") return "Sign in";
    if (mode === "signup") return "Create account";
    return isRecovering ? "Save new password" : "Send reset link";
  }

  // ---------------- Form block (shared between L and S) ----------------

  const showEmail = !isRecovering;
  const showPassword = mode !== "reset" || isRecovering;
  const showOAuth = mode !== "reset";

  const formBlock = (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      <form
        onSubmit={onEmailSubmit}
        style={{ display: "flex", flexDirection: "column", gap: 14 }}
      >
        {showEmail && (
          <div style={fieldStyle}>
            <label htmlFor="auth-email" style={labelStyle}>
              Email
            </label>
            <input
              id="auth-email"
              type="email"
              name="email"
              placeholder="you@storyplots.app"
              autoComplete="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              style={inputStyle}
            />
          </div>
        )}
        {showPassword && (
          <div style={fieldStyle}>
            <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between" }}>
              <label htmlFor="auth-password" style={{ ...labelStyle, marginBottom: 0 }}>
                {isRecovering ? "New password" : "Password"}
              </label>
              {mode === "signin" && (
                <Link
                  to="/reset-password"
                  data-testid="auth-forgot-link"
                  style={{
                    fontSize: 12,
                    color: "var(--sp-brand-1)",
                    fontWeight: 600,
                    textDecoration: "none",
                  }}
                >
                  Forgot password?
                </Link>
              )}
            </div>
            <input
              id="auth-password"
              type="password"
              name="password"
              placeholder={isRecovering ? "New password" : "••••••••"}
              autoComplete={mode === "signin" ? "current-password" : "new-password"}
              required
              minLength={6}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              style={inputStyle}
            />
          </div>
        )}
        <button
          type="submit"
          disabled={submitting}
          data-testid={`${mode}-submit`}
          style={primaryButtonStyle(submitting)}
        >
          {submitLabel()} {!submitting && <span aria-hidden="true">→</span>}
        </button>
      </form>

      {error && (
        <p
          role="alert"
          data-testid="auth-error"
          style={{
            margin: 0,
            padding: "10px 12px",
            background: "var(--sp-destructive-soft)",
            border: "1px solid var(--sp-destructive)",
            color: "var(--sp-fg)",
            borderRadius: "var(--sp-radius)",
            fontSize: 13,
          }}
        >
          {error}
        </p>
      )}
      {notice && (
        <p
          role="status"
          data-testid="auth-notice"
          style={{
            margin: 0,
            color: "var(--sp-fg-2)",
            fontSize: 13,
          }}
        >
          {notice}
        </p>
      )}
      {unverifiedEmail && (
        <div
          role="status"
          data-testid="auth-unverified"
          style={{
            margin: 0,
            padding: "12px 14px",
            background: "var(--sp-warning-soft)",
            border: "1px solid var(--sp-warning)",
            borderRadius: "var(--sp-radius)",
            color: "var(--sp-fg)",
            fontSize: 13,
            display: "flex",
            flexDirection: "column",
            gap: 8,
          }}
        >
          <strong style={{ color: "var(--sp-fg)", fontWeight: 600 }}>
            Email not yet verified
          </strong>
          <span style={{ color: "var(--sp-fg-2)" }}>
            Click the link we sent to <strong>{unverifiedEmail}</strong> to
            activate your account. Didn't get it?
          </span>
          <button
            type="button"
            data-testid="auth-resend-verification"
            onClick={resendVerification}
            disabled={resendBusy || resendCooldown > 0}
            style={{
              alignSelf: "flex-start",
              padding: "6px 12px",
              border: "1px solid var(--sp-border)",
              borderRadius: 999,
              background: "transparent",
              color: "var(--sp-fg)",
              cursor: resendBusy || resendCooldown > 0 ? "not-allowed" : "pointer",
              opacity: resendBusy || resendCooldown > 0 ? 0.6 : 1,
              fontSize: 13,
              fontWeight: 500,
            }}
          >
            {resendBusy
              ? "Sending…"
              : resendCooldown > 0
                ? `Resend in ${resendCooldown}s`
                : "Resend verification email"}
          </button>
        </div>
      )}

      {showOAuth && (
        <>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 10,
              margin: "2px 0",
              color: "var(--sp-fg-3)",
              fontSize: 12,
              letterSpacing: "0.08em",
            }}
          >
            <div style={{ flex: 1, height: 1, background: "var(--sp-border)" }} />
            <span>OR</span>
            <div style={{ flex: 1, height: 1, background: "var(--sp-border)" }} />
          </div>

          {/* Google OAuth provider isn't wired up in Supabase yet — the
              button stays visible but disabled so the surface foreshadows
              the option. Re-enable by removing `disabled` and the title
              hint once provider config lands. */}
          <button
            type="button"
            data-testid="auth-oauth-google"
            disabled
            aria-disabled="true"
            title="Coming soon"
            style={ghostButtonStyle(true)}
          >
            Continue with Google · soon
          </button>
        </>
      )}

      <div
        style={{
          textAlign: "center",
          marginTop: 4,
          fontSize: 13,
          color: "var(--sp-fg-2)",
        }}
      >
        {mode === "signin" && (
          <>
            New to StoryPlots?{" "}
            <Link to="/sign-up" style={inlineLinkStyle}>
              Create account
            </Link>
          </>
        )}
        {mode === "signup" && (
          <>
            Already have an account?{" "}
            <Link to="/sign-in" style={inlineLinkStyle}>
              Sign in
            </Link>
          </>
        )}
        {mode === "reset" && !isRecovering && (
          <>
            Remembered it?{" "}
            <Link to="/sign-in" style={inlineLinkStyle}>
              Sign in
            </Link>
          </>
        )}
      </div>
    </div>
  );

  // ---------------- Brand pitch (shared) ----------------

  const brandPitch = (variant: "l" | "s") => (
    <div
      data-testid="auth-brand-pitch"
      style={{
        display: "flex",
        flexDirection: "column",
        gap: variant === "l" ? 14 : 12,
        maxWidth: variant === "l" ? 460 : "100%",
        // Two-layer shadow: tight (sharp dark edge for letter
        // legibility) + wide (soft halo that lifts the text off the
        // bright hero image without darkening it). Replaces the
        // single-blur shadow that wasn't strong enough on the
        // brightest mid-zones of the cosmic vortex hero.
        textShadow:
          "0 1px 3px rgba(0, 0, 0, 0.9), 0 4px 24px rgba(0, 0, 0, 0.7)",
      }}
    >
      {variant === "s" && (
        <img
          src="/logos/logo.png"
          alt="StoryPlots"
          style={{
            height: 44,
            width: "auto",
            display: "block",
            alignSelf: "flex-start",
            flexShrink: 0,
            // Air between the wordmark and the chip below — matches the
            // top-left wordmark/pitch separation of the L layout.
            marginBottom: 20,
            filter: "drop-shadow(0 2px 12px rgba(0, 0, 0, 0.55))",
          }}
        />
      )}
      <span
        style={{
          alignSelf: "flex-start",
          padding: "3px 10px",
          borderRadius: "var(--sp-radius)",
          // Amber-tinted to match the new brand-1 (#F5B547). Slightly
          // higher alpha than the previous violet because amber sits
          // lighter on the dark bg and needs a touch more presence.
          background: "rgba(245, 181, 71, 0.18)",
          color: "var(--sp-fg)",
          fontSize: 10,
          fontWeight: 700,
          letterSpacing: "0.16em",
          textTransform: "uppercase",
          textShadow: "none",
          border: "1px solid rgba(245, 181, 71, 0.45)",
        }}
      >
        Step into stories
      </span>
      <h1
        style={{
          margin: 0,
          fontSize: variant === "l" ? 40 : 32,
          fontWeight: 700,
          lineHeight: 1.1,
          color: "var(--sp-fg)",
          letterSpacing: "-0.01em",
        }}
      >
        {titleFor()}
      </h1>
      <p
        style={{
          margin: 0,
          fontSize: variant === "l" ? 16 : 15,
          lineHeight: 1.5,
          // Pure --sp-fg + no opacity (was --sp-fg-1 at 0.95) so the
          // sub copy reads with the same contrast as the H1 against
          // the bright hero image — the text-shadow on the parent
          // already does the lift.
          color: "var(--sp-fg)",
        }}
      >
        {subFor()}
      </p>
    </div>
  );

  // ---------------- Footer (shared) ----------------

  const footer = (variant: "l" | "s") => (
    <div
      style={{
        textAlign: "center",
        fontSize: 11,
        // L sits over the bright hero — uses fg-2 + a dual-layer text-shadow
        // for legibility. The page-wide overlay (auth-shell-l background)
        // does the heavy lifting; this is just polish. S keeps fg-3 inside
        // the dark sheet.
        color: variant === "l" ? "var(--sp-fg-2)" : "var(--sp-fg-3)",
        lineHeight: 1.5,
        textShadow:
          variant === "l"
            ? "0 1px 2px rgba(0, 0, 0, 0.85), 0 2px 12px rgba(0, 0, 0, 0.6)"
            : undefined,
      }}
    >
      By continuing, you agree to StoryPlots's{" "}
      <a href="/terms" style={footerLinkStyle}>
        Terms
      </a>{" "}
      and{" "}
      <a href="/privacy" style={footerLinkStyle}>
        Privacy Policy
      </a>
      .
      <div style={{ marginTop: 6, opacity: 0.8 }}>© 2026 StoryPlots</div>
    </div>
  );

  // ---------------- Compact (S) layout: top image + bottom sheet ----------------

  if (compact) {
    return (
      <main
        data-testid={`auth-${mode}`}
        data-shape="s"
        style={{
          minHeight: "100vh",
          background: "var(--sp-bg)",
          color: "var(--sp-fg)",
          display: "flex",
          flexDirection: "column",
          position: "relative",
        }}
      >
        {/* Image area + sheet both stretch edge-to-edge so there are no
            visible "frame" gutters on intermediate viewports (looked like
            black bars on tablet-portrait / narrow-laptop). The visual
            content is capped instead — brand pitch and form content live
            inside max-width 460 wrappers centered horizontally. The sheet
            and image fill the screen; the content reads contained. */}
        <section
          aria-hidden="true"
          data-testid="auth-shell-s"
          style={{
            flex: "0 0 42vh",
            position: "relative",
            backgroundColor: "var(--sp-bg-1)",
            overflow: "hidden",
          }}
        >
          <HeroPicture objectPosition="center 30%" />
          <div
            style={{
              position: "absolute",
              inset: 0,
              // Top-only fade: --sp-bg solid at the edge for Safari
              // address bar match, then transitions to transparent
              // over 8% so the integration with the page bg has a
              // little more presence than 5% gave (still subtle —
              // shorter than the original 12% which read as a banner).
              background:
                "linear-gradient(180deg, var(--sp-bg) 0%, transparent 8%)",
              pointerEvents: "none",
            }}
          />
        </section>

        {/* Brand pitch overlay — left-aligned but content capped at maxWidth
            460 so the H1 / sub copy stay readable widths on tablets. */}
        <div
          style={{
            position: "absolute",
            top: 28,
            left: 0,
            right: 0,
            zIndex: 2,
            display: "flex",
            justifyContent: "center",
            pointerEvents: "none",
          }}
        >
          <div
            style={{
              width: "100%",
              maxWidth: 460,
              padding: "0 24px",
              boxSizing: "border-box",
            }}
          >
            {brandPitch("s")}
          </div>
        </div>

        <section
          style={{
            flex: 1,
            background: "var(--sp-bg-2)",
            borderTop: "1px solid var(--sp-border-soft)",
            borderTopLeftRadius: "var(--sp-radius-sheet)",
            borderTopRightRadius: "var(--sp-radius-sheet)",
            padding: "28px 22px 24px",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            marginTop: -20,
            position: "relative",
            zIndex: 1,
          }}
        >
          {/* Form content capped at the same width as the brand pitch above
              so logo / pitch / form align on a shared center column. */}
          <div
            style={{
              width: "100%",
              maxWidth: 420,
              display: "flex",
              flexDirection: "column",
              flex: 1,
            }}
          >
            {formBlock}
            <div style={{ marginTop: "auto", paddingTop: 24 }}>{footer("s")}</div>
          </div>
        </section>
      </main>
    );
  }

  // ---------------- Wide (L) layout: full hero + glass card ----------------

  // Cluster grid groups wordmark + brand pitch + card + side pitch + footer as
  // one cohesive block centered both horizontally and vertically over the
  // hero. Footer occupies row 2 of the same grid so it travels with the
  // composition rather than detaching as page furniture. Plan 0107.

  return (
    <main
      data-testid={`auth-${mode}`}
      data-shape="l"
      style={{
        minHeight: "100vh",
        position: "relative",
        backgroundColor: "var(--sp-bg)",
        color: "var(--sp-fg)",
        // overflow-y: auto so very short viewports + signup mode (taller
        // form) scroll instead of clipping the cluster. overflow-x: hidden
        // keeps the hero from causing horizontal overflow at narrow widths.
        overflowX: "hidden",
        overflowY: "auto",
      }}
    >
      <HeroPicture />
      <div
        aria-hidden="true"
        data-testid="auth-shell-l"
        style={{
          position: "absolute",
          inset: 0,
          // Three stacked layers (top → bottom):
          // 1) Uniform dark tint over the whole hero — drops the overall
          //    luminance so even the brightest vortex zone sits under
          //    text without losing legibility. Replaces the per-element
          //    backplates idea — the bg is the overlay.
          // 2) Top fade (linear) — matches the mobile auth pattern:
          //    --sp-bg solid → transparent in 5% so the browser
          //    address bar / window chrome extends the page bg
          //    seamlessly into the hero.
          // 3) Mid-strength vignette (radial) — keeps the edge fall-off
          //    that focuses attention on the form column.
          background:
            "linear-gradient(rgba(0,0,0,0.35), rgba(0,0,0,0.35)), " +
            "linear-gradient(180deg, var(--sp-bg) 0%, transparent 5%), " +
            "radial-gradient(ellipse at 28% 72%, rgba(13,10,21,0.08) 0%, rgba(13,10,21,0.35) 47%, rgba(13,10,21,0.65) 100%)",
          pointerEvents: "none",
        }}
      />

      <div
        style={{
          position: "relative",
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          zIndex: 2,
          padding: "24px 0",
          boxSizing: "border-box",
        }}
      >
        {/* Row 1: left col (wordmark + pitch + card) | gap track | side pitch.
            Row 2: footer in left col. Side pitch uses align-self:end to
            bottom-align with the card (preserves cycle 0099 baseline). */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "minmax(0, 420px) minmax(40px, 1fr) minmax(0, 460px)",
            gridTemplateRows: "auto auto",
            width: "min(100% - 112px, 1360px)",
          }}
        >
          {/* Wordmark gets extra marginBottom on top of the flex gap so it
              reads as the cluster's brand anchor with breathing room from
              the pitch. */}
          <div style={{ gridRow: "1 / 2", gridColumn: "1 / 2", display: "flex", flexDirection: "column", gap: 24 }}>
            <img
              src="/logos/logo.png"
              alt="StoryPlots"
              style={{
                height: 60,
                width: "auto",
                alignSelf: "flex-start",
                marginBottom: 24,
                filter: "drop-shadow(0 2px 12px rgba(0, 0, 0, 0.55))",
              }}
            />
            {brandPitch("l")}
            <section
              style={{
                padding: "28px 28px 24px",
                background: "color-mix(in srgb, var(--sp-bg-2) 88%, transparent)",
                backdropFilter: "blur(14px) saturate(120%)",
                WebkitBackdropFilter: "blur(14px) saturate(120%)",
                border: "1px solid var(--sp-border-soft)",
                borderRadius: "var(--sp-radius)",
                boxShadow: "var(--sp-shadow-lg)",
                color: "var(--sp-fg)",
              }}
            >
              {formBlock}
            </section>
          </div>

          <div
            data-testid="auth-side-pitch"
            style={{
              gridRow: "1 / 2",
              gridColumn: "3 / 4",
              alignSelf: "end",
              textAlign: "right",
              color: "var(--sp-fg)",
              textShadow: "0 2px 8px rgba(0, 0, 0, 0.6)",
              pointerEvents: "none",
            }}
          >
            <h2
              style={{
                margin: 0,
                fontSize: 38,
                fontWeight: 700,
                lineHeight: 1.12,
                letterSpacing: "-0.01em",
                color: "var(--sp-fg)",
              }}
            >
              Every character has a heartbeat.
            </h2>
            <p
              style={{
                marginTop: 16,
                marginBottom: 0,
                fontSize: 17,
                lineHeight: 1.5,
                color: "var(--sp-fg-1)",
              }}
            >
              Build a cast with the depth of a novelist's notebook. Explore a
              new plot with every conversation.
            </p>
          </div>

          <div style={{ gridRow: "2 / 3", gridColumn: "1 / 2", paddingTop: 16 }}>
            {footer("l")}
          </div>
        </div>
      </div>
    </main>
  );
}

// ---------------- Shared inline style fragments ----------------

const fieldStyle: CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: 6,
};

const labelStyle: CSSProperties = {
  fontSize: 13,
  fontWeight: 600,
  color: "var(--sp-fg-1)",
  letterSpacing: "0.01em",
};

const inputStyle: CSSProperties = {
  width: "100%",
  // border-box so width:100% includes the padding+border; without it the
  // input outer width would be parent-content-width + 30 px (14×2 padding
  // + 1×2 border) and overflow the card right edge by 28 px.
  boxSizing: "border-box",
  padding: "11px 14px",
  background: "var(--sp-bg-3)",
  border: "1px solid var(--sp-border)",
  borderRadius: "var(--sp-radius)",
  color: "var(--sp-fg)",
  fontSize: 14,
  fontFamily: "inherit",
  outline: "none",
  // Focus state handled by global :focus-visible rule from Cycle 0070; the
  // border-strong color appears on focus via that rule.
};

const inlineLinkStyle: CSSProperties = {
  color: "var(--sp-brand-1)",
  fontWeight: 600,
  textDecoration: "none",
};

const footerLinkStyle: CSSProperties = {
  color: "var(--sp-fg-2)",
  textDecoration: "underline",
};

function primaryButtonStyle(disabled: boolean): CSSProperties {
  return {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    width: "100%",
    boxSizing: "border-box",
    padding: "13px 16px",
    border: "none",
    borderRadius: "var(--sp-radius)",
    background: disabled ? "var(--sp-bg-3)" : "var(--sp-brand-grad)",
    // Pure-black text on amber gradient for maximum legibility.
    // The token --sp-fg-on-brand resolves to #000 — sharper contrast
    // than --sp-bg (near-black with hint of warm) which can read
    // muddy against the warm-light brand gradient.
    color: disabled ? "var(--sp-fg-3)" : "var(--sp-fg-on-brand)",
    fontSize: 15,
    fontWeight: 600,
    letterSpacing: "0.01em",
    cursor: disabled ? "default" : "pointer",
    boxShadow: disabled ? "none" : "var(--sp-shadow-sm)",
    marginTop: 4,
    fontFamily: "inherit",
    transition: "transform 120ms ease, box-shadow 200ms ease",
  };
}

function ghostButtonStyle(disabled: boolean): CSSProperties {
  return {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    width: "100%",
    boxSizing: "border-box",
    padding: "11px 16px",
    background: "transparent",
    border: "1px solid var(--sp-border)",
    borderRadius: "var(--sp-radius)",
    color: disabled ? "var(--sp-fg-3)" : "var(--sp-fg)",
    fontSize: 14,
    fontWeight: 600,
    cursor: disabled ? "not-allowed" : "pointer",
    opacity: disabled ? 0.65 : 1,
    fontFamily: "inherit",
    transition: "border-color 200ms ease, background 200ms ease",
  };
}
