// Ghost-tile loading state for routes that render a CharacterGrid:
// Home, Characters, Gallery. The shape mirrors CharacterCard so when
// the real data resolves there's zero layout shift — square image
// frame on top, text-block strip below. Shimmer wave is the shared
// `.sp-skeleton` class defined in tokens.css.
//
// Opt-in chrome ghosts (cycle 0124): `withAddCard` mirrors the dashed
// "Add Character" card that sits above the grid on Home + Characters;
// `withSectionHeader` mirrors Home's "Recent Characters" header row
// (between the add-card and the grid); `withFilterBar` mirrors the
// search-input + layout-button row on Characters. All default off so
// Gallery (also a consumer) is untouched. They make the loading state
// look like the real screen instead of bare tiles with no chrome —
// and keep the grid from shifting down when the real data resolves.

const tileStyle: React.CSSProperties = {
  display: "flex",
  flexDirection: "column",
  background: "var(--sp-bg-2)",
  border: "1px solid var(--sp-border-soft)",
  borderRadius: "var(--sp-radius)",
  overflow: "hidden",
};

const imageBlockStyle: React.CSSProperties = {
  width: "100%",
  aspectRatio: "1 / 1",
};

const metaWrapStyle: React.CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: 8,
  padding: "0.75rem",
};

const nameLineStyle: React.CSSProperties = {
  height: 14,
  width: "70%",
  borderRadius: 6,
};

const taglineLineStyle: React.CSSProperties = {
  height: 10,
  width: "90%",
  borderRadius: 6,
};

const taglineLine2Style: React.CSSProperties = {
  height: 10,
  width: "60%",
  borderRadius: 6,
};

function SkeletonCard() {
  return (
    <div style={tileStyle} aria-hidden>
      <div className="sp-skeleton" style={imageBlockStyle} />
      <div style={metaWrapStyle}>
        <div className="sp-skeleton" style={nameLineStyle} />
        <div className="sp-skeleton" style={taglineLineStyle} />
        <div className="sp-skeleton" style={taglineLine2Style} />
      </div>
    </div>
  );
}

// Mirrors the dashed "Add Character" card in Home.tsx / Characters.tsx:
// dashed border box, 40px circle, two stacked text lines. Dimensions
// are tuned to the real card (~81px tall, 1.75rem gap below) so the
// grid doesn't jump when data resolves.
const addCardStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: "0.9rem",
  padding: "1rem 1.25rem",
  background: "var(--sp-bg-2)",
  border: "1.5px dashed var(--sp-border-strong)",
  borderRadius: "var(--sp-radius)",
  marginBottom: "1.75rem",
};

function SkeletonAddCard() {
  return (
    <div style={addCardStyle} aria-hidden>
      <div className="sp-skeleton" style={{ width: 40, height: 40, borderRadius: "50%", flexShrink: 0 }} />
      <div style={{ display: "flex", flexDirection: "column", justifyContent: "center", gap: 8, flex: 1, minHeight: 49 }}>
        <div className="sp-skeleton" style={{ height: 13, width: "35%", borderRadius: 6 }} />
        <div className="sp-skeleton" style={{ height: 10, width: "60%", borderRadius: 6 }} />
      </div>
    </div>
  );
}

// Mirrors Home's "Recent Characters" header row: a section title bar
// (+ a short "See all" link ghost), with the same 1.25rem gap below it
// the real <header> carries — so the grid below it doesn't jump.
function SkeletonSectionHeader() {
  return (
    <div
      style={{ display: "flex", justifyContent: "space-between", alignItems: "center", height: 34, marginBottom: "1.25rem" }}
      aria-hidden
    >
      <div className="sp-skeleton" style={{ height: 26, width: 180, borderRadius: 6 }} />
      <div className="sp-skeleton" style={{ height: 12, width: 48, borderRadius: 6 }} />
    </div>
  );
}

// Mirrors the Characters filter row: a flex-1 search input + three
// square layout-toggle buttons.
function SkeletonFilterBar() {
  return (
    <div
      style={{ display: "flex", gap: "0.75rem", alignItems: "center", marginBottom: "1.25rem", flexWrap: "wrap" }}
      aria-hidden
    >
      <div className="sp-skeleton" style={{ height: 40, flex: 1, minWidth: 200, borderRadius: "var(--sp-radius)" }} />
      <div style={{ display: "flex", gap: "0.35rem" }}>
        {[0, 1, 2].map((i) => (
          <div key={i} className="sp-skeleton" style={{ width: 44, height: 40, borderRadius: "var(--sp-radius)" }} />
        ))}
      </div>
    </div>
  );
}

// Mirrors Home's compact Grammar summary card (`grammarCardStyle` +
// `kpiGridStyle`): a bordered card below the grid with a header line +
// 4 KPI-block ghosts. Dimensions track the compact card treatment.
const grammarCardStyle: React.CSSProperties = {
  marginTop: "1.25rem",
  padding: "1rem",
  background: "var(--sp-bg-2)",
  border: "1px solid var(--sp-border)",
  borderRadius: "var(--sp-radius)",
};

function SkeletonGrammarCard() {
  return (
    <div style={grammarCardStyle} aria-hidden>
      <div className="sp-skeleton" style={{ height: 16, width: 110, borderRadius: 6, marginBottom: "0.55rem" }} />
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(120px, 1fr))", gap: "0.5rem" }}>
        {[0, 1, 2, 3].map((i) => (
          <div
            key={i}
            className="sp-skeleton"
            style={{ height: 58, borderRadius: "var(--sp-radius)" }}
          />
        ))}
      </div>
    </div>
  );
}

export function SkeletonGrid({
  count = 6,
  testId,
  withAddCard = false,
  withSectionHeader = false,
  withFilterBar = false,
  withGrammarCard = false,
}: {
  count?: number;
  testId?: string;
  withAddCard?: boolean;
  withSectionHeader?: boolean;
  withFilterBar?: boolean;
  withGrammarCard?: boolean;
}) {
  return (
    <div role="status" aria-label="Loading" data-testid={testId}>
      {withAddCard && <SkeletonAddCard />}
      {withSectionHeader && <SkeletonSectionHeader />}
      {withFilterBar && <SkeletonFilterBar />}
      <div className="sp-character-grid">
        {Array.from({ length: count }, (_, i) => (
          <SkeletonCard key={i} />
        ))}
      </div>
      {withGrammarCard && <SkeletonGrammarCard />}
    </div>
  );
}
