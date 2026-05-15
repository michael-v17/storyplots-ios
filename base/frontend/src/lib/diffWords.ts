// Tiny word-level LCS diff used by the inline grammar correction row.
// Returns a token array tagged "same" | "added" | "removed" so the
// renderer can colorize the corrected sentence (added words pop in
// brand amber, removed words strike through the original).
//
// Not a general-purpose diff lib — preserves whitespace so reassembly
// reproduces the original string. Good enough for short grammar
// corrections (≤ ~40 words). For longer prose use a real diff lib.

export type DiffToken = { kind: "same" | "added" | "removed"; text: string };

function tokenize(s: string): string[] {
  // Split into runs of [word] or [non-word]. Keeps whitespace + punctuation
  // as their own tokens so the diff aligns by lexical units, not chars.
  return s.match(/[A-Za-zÀ-ÿ0-9']+|\s+|[^\s\w]/g) ?? [];
}

function isWord(tok: string): boolean {
  return /^[A-Za-zÀ-ÿ0-9']+$/.test(tok);
}

export function diffWords(original: string, corrected: string): {
  removedTokens: DiffToken[]; // for rendering the original (same + removed)
  addedTokens: DiffToken[];   // for rendering the corrected (same + added)
} {
  const a = tokenize(original);
  const b = tokenize(corrected);

  // Compare WORDS only (case-insensitive). Whitespace/punctuation are
  // passed through as "same" wherever they line up; treating them as
  // diffable produces noisy spans (e.g. trailing period flagged as
  // changed when only the preceding word changed).
  const aWords: { token: string; index: number; lc: string }[] = [];
  const bWords: { token: string; index: number; lc: string }[] = [];
  a.forEach((t, i) => { if (isWord(t)) aWords.push({ token: t, index: i, lc: t.toLowerCase() }); });
  b.forEach((t, i) => { if (isWord(t)) bWords.push({ token: t, index: i, lc: t.toLowerCase() }); });

  // LCS table over the word-only projections.
  const n = aWords.length;
  const m = bWords.length;
  const dp: number[][] = Array.from({ length: n + 1 }, () => new Array(m + 1).fill(0));
  for (let i = 1; i <= n; i++) {
    for (let j = 1; j <= m; j++) {
      dp[i][j] = aWords[i - 1].lc === bWords[j - 1].lc
        ? dp[i - 1][j - 1] + 1
        : Math.max(dp[i - 1][j], dp[i][j - 1]);
    }
  }
  // Backtrack to mark matched word positions.
  const aMatched = new Set<number>();
  const bMatched = new Set<number>();
  let i = n, j = m;
  while (i > 0 && j > 0) {
    if (aWords[i - 1].lc === bWords[j - 1].lc) {
      aMatched.add(aWords[i - 1].index);
      bMatched.add(bWords[j - 1].index);
      i--; j--;
    } else if (dp[i - 1][j] >= dp[i][j - 1]) {
      i--;
    } else {
      j--;
    }
  }

  const removedTokens: DiffToken[] = a.map((tok, k) => {
    if (!isWord(tok)) return { kind: "same", text: tok };
    return aMatched.has(k) ? { kind: "same", text: tok } : { kind: "removed", text: tok };
  });
  const addedTokens: DiffToken[] = b.map((tok, k) => {
    if (!isWord(tok)) return { kind: "same", text: tok };
    return bMatched.has(k) ? { kind: "same", text: tok } : { kind: "added", text: tok };
  });

  return { removedTokens, addedTokens };
}
