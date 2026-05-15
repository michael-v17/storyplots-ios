import { useEffect, useMemo, useState } from "react";
import { ArrowUpDown, Heart, Search } from "lucide-react";
import type { Character } from "../lib/characters";
import { listCharacters } from "../lib/characters";
import { Icon } from "../lib/Icon";
import {
  displayUrl,
  IMAGE_LIST_CAP,
  listAllImages,
  type GeneratedImage,
} from "../lib/images";
import { useSession } from "../lib/session";
import { ImageViewer } from "../features/chat/ImageViewer";
import { useDocumentTitle } from "../lib/useDocumentTitle";

type Loaded = {
  images: GeneratedImage[];
  characters: Character[];
};

export function Gallery() {
  useDocumentTitle("Gallery");
  const sess = useSession();
  const userId = sess.status === "ready" ? sess.session?.user.id ?? null : null;
  const [state, setState] = useState<Loaded | null>(null);
  const [filterCharacter, setFilterCharacter] = useState<string>("all");
  const [favoritesOnly, setFavoritesOnly] = useState(false);
  const [sort, setSort] = useState<"newest" | "oldest">("newest");
  const [searchQuery, setSearchQuery] = useState("");
  const [viewer, setViewer] = useState<GeneratedImage | null>(null);

  useEffect(() => {
    if (!userId) return;
    let cancelled = false;
    (async () => {
      const [images, characters] = await Promise.all([
        listAllImages(),
        listCharacters(userId),
      ]);
      if (cancelled) return;
      setState({ images, characters });
    })();
    return () => { cancelled = true; };
  }, [userId]);

  const filtered = useMemo(() => {
    if (!state) return [];
    // An image is renderable if it has EITHER a Supabase Storage ref OR
    // a fal CDN URL (external_url). fal generations land on the CDN
    // immediately and are backfilled to Storage async by the sweeper —
    // requiring storage_ref alone hid every fresh fal image from the
    // Gallery. displayUrl() picks the best source per image.
    let list = state.images.filter((i) => !i.sfw_blocked && (i.storage_ref || i.external_url));
    if (filterCharacter !== "all") list = list.filter((i) => i.character_id === filterCharacter);
    if (favoritesOnly) list = list.filter((i) => i.favorite);
    if (searchQuery.trim()) {
      const q = searchQuery.trim().toLowerCase();
      list = list.filter((i) => (i.refined_prompt ?? i.prompt).toLowerCase().includes(q));
    }
    list = [...list].sort((a, b) => {
      const diff = new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
      return sort === "newest" ? -diff : diff;
    });
    return list;
  }, [state, filterCharacter, favoritesOnly, sort, searchQuery]);

  if (!state) {
    return (
      <main data-testid="gallery-loading" style={wrap}>
        <div role="status" aria-label="Loading">
          {/* Chrome ghosts mirror the real Gallery (cycle 0125): the
              "Gallery" header, the count line, and the search + favorite
              + sort filter row — so the loading state reads like the
              real screen instead of a bare grid of squares. */}
          <div className="sp-skeleton" style={{ height: 30, width: 160, borderRadius: 6, margin: "0 auto 1.75rem" }} aria-hidden />
          <div className="sp-skeleton" style={{ height: 13, width: 90, borderRadius: 6, margin: "0 auto 0.75rem" }} aria-hidden />
          <div style={{ display: "flex", gap: "0.5rem", alignItems: "center", marginBottom: "1.25rem" }} aria-hidden>
            <div className="sp-skeleton" style={{ flex: 1, height: 36, borderRadius: "var(--sp-radius)" }} />
            <div className="sp-skeleton" style={{ width: 38, height: 38, borderRadius: "50%", flexShrink: 0 }} />
            <div className="sp-skeleton" style={{ width: 38, height: 38, borderRadius: "50%", flexShrink: 0 }} />
          </div>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fill, minmax(160px, 1fr))",
              gap: "0.5rem",
            }}
          >
            {Array.from({ length: 12 }, (_, i) => (
              <div
                key={i}
                className="sp-skeleton"
                style={{ aspectRatio: "1 / 1" }}
                aria-hidden
              />
            ))}
          </div>
        </div>
      </main>
    );
  }

  const hasMultipleChars = state.characters.length > 1;

  return (
    <main data-testid="gallery" className="sp-page-content" style={wrap}>
      <header className="sp-main-header" style={{ marginBottom: "1.75rem" }}>
        <h1 className="sp-h2 sp-wordmark sp-page-h1" style={{ margin: 0 }}>Gallery</h1>
      </header>

      <p style={{ color: "var(--sp-fg-3)", fontSize: "0.85em", fontWeight: 500, textAlign: "center", marginBottom: "0.75rem", margin: "0 0 0.75rem" }}>
        {filtered.length} image{filtered.length === 1 ? "" : "s"}
        {state.images.length >= IMAGE_LIST_CAP && (
          <span data-testid="gallery-cap-notice" style={{ marginLeft: "0.4rem", color: "var(--sp-warning)" }}>
            · showing latest {IMAGE_LIST_CAP}
          </span>
        )}
      </p>

      <div style={{ display: "flex", gap: "0.5rem", alignItems: "center", marginBottom: hasMultipleChars ? "0.5rem" : "1.25rem" }}>
        <div style={{ flex: 1, position: "relative" }}>
          <Icon
            icon={Search}
            size={15}
            style={{ position: "absolute", left: "0.75rem", top: "50%", transform: "translateY(-50%)", color: "var(--sp-fg-3)", pointerEvents: "none" }}
          />
          <input
            type="search"
            data-testid="gallery-search"
            placeholder="Search prompts…"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            style={searchInputStyle}
          />
        </div>

        <button
          type="button"
          data-testid="gallery-favorites-only"
          onClick={() => setFavoritesOnly((v) => !v)}
          aria-pressed={favoritesOnly}
          aria-label="Favorites only"
          title="Favorites only"
          style={iconChipStyle(favoritesOnly)}
        >
          <Icon icon={Heart} size={17} fill={favoritesOnly ? "currentColor" : "none"} />
        </button>

        <button
          type="button"
          data-testid="gallery-sort"
          onClick={() => setSort((s) => s === "newest" ? "oldest" : "newest")}
          aria-label={sort === "newest" ? "Sorted: newest first" : "Sorted: oldest first"}
          title={sort === "newest" ? "Newest first — click for oldest" : "Oldest first — click for newest"}
          style={iconChipStyle(sort === "oldest")}
        >
          <Icon icon={ArrowUpDown} size={17} />
        </button>
      </div>

      {hasMultipleChars && (
        <div style={{ marginBottom: "1.25rem" }}>
          <select
            data-testid="gallery-filter-character"
            value={filterCharacter}
            onChange={(e) => setFilterCharacter(e.target.value)}
            style={pillSelectStyle}
          >
            <option value="all">All characters</option>
            {state.characters.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
        </div>
      )}

      {filtered.length === 0 ? (
        <section data-testid="gallery-empty" style={emptyCardStyle}>
          No images here yet. Generate one from any chat with 🎨 Generate image.
        </section>
      ) : (
        <section
          data-testid="gallery-grid"
          style={{
            display: "grid",
            gap: "0.5rem",
            gridTemplateColumns: "repeat(auto-fill, minmax(160px, 1fr))",
          }}
        >
          {filtered.map((img) => (
            <GalleryTile key={img.id} image={img} onOpen={() => setViewer(img)} />
          ))}
        </section>
      )}

      {viewer && (
        <ImageViewer
          image={viewer}
          canRegenerate={false}
          onClose={() => setViewer(null)}
          onChange={(updated) => {
            setViewer(updated);
            setState((prev) => prev ? { ...prev, images: prev.images.map((i) => i.id === updated.id ? updated : i) } : prev);
          }}
          onDeleted={(deleted) => {
            setState((prev) => prev ? { ...prev, images: prev.images.filter((i) => i.id !== deleted.id) } : prev);
            setViewer(null);
          }}
          onRegenerate={() => { /* disabled in Gallery context */ }}
        />
      )}
    </main>
  );
}

function GalleryTile({ image, onOpen }: { image: GeneratedImage; onOpen: () => void }) {
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    let cancelled = false;
    // displayUrl (cycle 0094): fal CDN URL for fresh images, signed
    // Storage URL once backfilled — same strategy as ImageViewer.
    displayUrl(image).then((u) => { if (!cancelled) setUrl(u); }).catch(() => {});
    return () => { cancelled = true; };
  }, [image.id, image.storage_ref, image.external_url]);

  return (
    <button
      type="button"
      data-testid={`gallery-tile-${image.id}`}
      onClick={onOpen}
      style={{
        position: "relative",
        width: "100%", aspectRatio: "1 / 1", padding: 0,
        border: "1px solid var(--sp-border)",
        borderRadius: "var(--sp-radius)",
        backgroundColor: "var(--sp-bg-3)",
        cursor: "pointer", overflow: "hidden",
      }}
      aria-label={image.refined_prompt?.slice(0, 80) || image.prompt.slice(0, 80)}
    >
      {url && (
        <img
          src={url}
          alt=""
          loading="lazy"
          decoding="async"
          style={{
            position: "absolute", inset: 0,
            width: "100%", height: "100%",
            objectFit: "cover",
            display: "block",
          }}
        />
      )}
      {image.favorite && (
        <span
          aria-hidden
          style={{
            position: "absolute", top: 6, right: 6,
            color: "var(--sp-destructive)", background: "rgba(0,0,0,0.45)",
            borderRadius: "50%", width: 24, height: 24,
            display: "flex", alignItems: "center", justifyContent: "center",
          }}
        >
          <Icon icon={Heart} size={14} fill="currentColor" />
        </span>
      )}
    </button>
  );
}

const wrap: React.CSSProperties = {
  maxWidth: 960, margin: "1.5rem auto", padding: "0 1rem",
};

function iconChipStyle(active: boolean): React.CSSProperties {
  return {
    width: 38, height: 38,
    border: active ? "1px solid var(--sp-brand-1)" : "1px solid var(--sp-border)",
    borderRadius: "50%",
    background: active ? "rgba(139,92,246,0.12)" : "var(--sp-bg-2)",
    color: active ? "var(--sp-brand-1)" : "var(--sp-fg-3)",
    display: "flex", alignItems: "center", justifyContent: "center",
    cursor: "pointer",
    flexShrink: 0,
    padding: 0,
    transition: "border-color 160ms var(--sp-ease), background 160ms var(--sp-ease), color 160ms var(--sp-ease)",
  };
}

const searchInputStyle: React.CSSProperties = {
  width: "100%",
  background: "var(--sp-bg-2)",
  color: "var(--sp-fg)",
  border: "1px solid var(--sp-border)",
  borderRadius: "var(--sp-radius)",
  padding: "0.5rem 1rem 0.5rem 2.25rem",
  fontSize: "0.9em",
  fontFamily: "inherit",
  boxSizing: "border-box",
};

const pillSelectStyle: React.CSSProperties = {
  background: "var(--sp-bg-2)",
  color: "var(--sp-fg)",
  border: "1px solid var(--sp-border)",
  borderRadius: "var(--sp-radius)",
  padding: "0.45rem 0.9rem",
  fontSize: "0.9em",
  fontFamily: "inherit",
  cursor: "pointer",
};

const emptyCardStyle: React.CSSProperties = {
  textAlign: "center",
  padding: "3rem 1rem",
  color: "var(--sp-fg-3)",
  background: "var(--sp-bg-2)",
  border: "1.5px dashed var(--sp-border-strong)",
  borderRadius: "var(--sp-radius)",
  fontSize: "0.95em",
};
