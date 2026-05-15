import { useEffect, useRef, useState } from "react";
import { displayUrl, type GeneratedImage } from "../../lib/images";

type Props = {
  images: GeneratedImage[];       // ordered oldest → newest (position asc)
  activeIndex: number;
  onStep: (nextIndex: number) => void;
  onOpen: (image: GeneratedImage) => void;
};

// Cycle 0096 — IntersectionObserver gate. Don't resolve the signed URL
// (and don't let the browser fetch image bytes) until the bubble is at
// least 200 px above the viewport. In a chat with 50+ scenes the
// browser's native loading="lazy" still does most of the work, but the
// observer also stops us from generating signed URLs on mount for
// scrolled-out bubbles — saves Storage API calls and gives us a clean
// place to layer Cycle 0094's dual-store display_url choice on top.
const PREFETCH_MARGIN = "200px";

export function MessageImage({ images, activeIndex, onStep, onOpen }: Props) {
  const image = images[activeIndex];
  const wrapperRef = useRef<HTMLDivElement | null>(null);
  const [inView, setInView] = useState(false);
  const [url, setUrl] = useState<string | null>(null);
  const [errored, setErrored] = useState(false);

  // Once the bubble enters the viewport (or its 200px halo) we stop
  // observing — the URL is fetched once and cached locally; scrolling
  // out doesn't unload it.
  useEffect(() => {
    if (inView) return;
    const node = wrapperRef.current;
    if (!node) return;
    if (typeof IntersectionObserver === "undefined") {
      // SSR or very old browsers — fall through to eager load.
      setInView(true);
      return;
    }
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          setInView(true);
          observer.disconnect();
        }
      },
      { rootMargin: PREFETCH_MARGIN },
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, [inView, image?.id, image?.sfw_blocked]);

  // Resolve the display URL only after the bubble has been observed in
  // (or near) the viewport. The displayUrl helper picks fal CDN for
  // <24h-old fal rows and signed Storage URL otherwise (Cycle 0094).
  // Stepper changes refetch within the same bubble — `inView` stays true.
  useEffect(() => {
    if (!inView) return;
    let cancelled = false;
    setUrl(null);
    setErrored(false);
    if (!image || image.sfw_blocked) return;
    displayUrl(image)
      .then((u) => { if (!cancelled) setUrl(u); })
      .catch(() => { if (!cancelled) setErrored(true); });
    return () => { cancelled = true; };
  }, [inView, image?.id, image?.storage_ref, image?.external_url, image?.sfw_blocked]);

  if (!image) return null;

  const stepper = images.length > 1 ? (
    <div data-testid={`image-stepper-${image.message_id ?? image.id}`} style={stepperStyle}>
      <button
        type="button"
        data-testid="image-stepper-prev"
        onClick={() => onStep((activeIndex - 1 + images.length) % images.length)}
        style={stepperBtn}
        aria-label="Previous image"
      >
        ‹
      </button>
      <span data-testid="image-stepper-count" style={{ fontSize: "0.75em", color: "var(--sp-fg-3)" }}>
        {activeIndex + 1}/{images.length}
      </span>
      <button
        type="button"
        data-testid="image-stepper-next"
        onClick={() => onStep((activeIndex + 1) % images.length)}
        style={stepperBtn}
        aria-label="Next image"
      >
        ›
      </button>
    </div>
  ) : null;

  if (image.sfw_blocked) {
    return (
      <div style={{ marginTop: "0.5rem" }}>
        {stepper}
        <div
          data-testid={`msg-image-blocked-${image.id}`}
          style={{
            padding: "0.75rem",
            border: "1px solid var(--sp-warning)",
            borderRadius: "var(--sp-radius)",
            background: "var(--sp-warning-soft)",
            color: "var(--sp-fg)",
            maxWidth: 320,
            fontSize: "0.85em",
          }}
        >
          <strong>Blocked by SFW filter.</strong>
          <div style={{ color: "var(--sp-fg-3)", marginTop: "0.25rem" }}>
            Disable SFW in Profile to allow, or rewrite the scene.
          </div>
        </div>
      </div>
    );
  }

  // Fixed 320×320 box reserves space ahead of load so the bubble below
  // doesn't jump when the image resolves. Image uses objectFit: contain
  // to preserve its aspect (portrait/landscape letter-boxes into bg-3).
  return (
    <div style={{ marginTop: "0.5rem" }}>
      {stepper}
      <div
        ref={wrapperRef}
        data-testid={url ? undefined : `msg-image-loading-${image.id}`}
        data-inview={inView ? "true" : "false"}
        onClick={url ? () => onOpen(image) : undefined}
        style={{
          width: 320,
          height: 320,
          background: "var(--sp-bg-3)",
          borderRadius: "var(--sp-radius)",
          overflow: "hidden",
          cursor: url ? "pointer" : "default",
        }}
      >
        {url && (
          <img
            data-testid={`msg-image-${image.id}`}
            src={url}
            alt={image.refined_prompt || image.prompt}
            loading="lazy"
            decoding="async"
            onError={() => setErrored(true)}
            style={{
              width: "100%",
              height: "100%",
              objectFit: "contain",
              display: "block",
            }}
          />
        )}
        {errored && (
          <div
            data-testid={`msg-image-error-${image.id}`}
            style={{
              width: "100%",
              height: "100%",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "var(--sp-fg-3)",
              fontSize: "0.85em",
              padding: "0 0.75rem",
              textAlign: "center",
            }}
          >
            Image failed to load — regenerate from the panel below.
          </div>
        )}
      </div>
    </div>
  );
}

export function MessageImageSkeleton() {
  return (
    <>
      <style>{`@keyframes msgImageShimmer { 0% { background-position: 200% 0; } 100% { background-position: -200% 0; } }`}</style>
      <div
        data-testid="msg-image-skeleton"
        style={{
          marginTop: "0.5rem",
          width: 320, height: 320,
          borderRadius: "var(--sp-radius)",
          background: "linear-gradient(90deg, var(--sp-bg-2) 0%, var(--sp-bg-3) 50%, var(--sp-bg-2) 100%)",
          backgroundSize: "200% 100%",
          animation: "msgImageShimmer 1.6s ease-in-out infinite",
          display: "flex", alignItems: "center", justifyContent: "center",
          color: "var(--sp-fg-3)", fontSize: "0.85em",
        }}
      >
        Generating…
      </div>
    </>
  );
}

const stepperStyle: React.CSSProperties = {
  display: "inline-flex", alignItems: "center", gap: "0.35rem",
  marginBottom: "0.35rem",
};
const stepperBtn: React.CSSProperties = {
  fontSize: "0.85em",
  width: 22, height: 22,
  padding: 0,
  border: "1px solid var(--sp-border)",
  borderRadius: "var(--sp-radius)",
  background: "var(--sp-bg-3)",
  color: "var(--sp-fg-2)",
  cursor: "pointer",
  fontFamily: "inherit",
  lineHeight: 1,
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
};
