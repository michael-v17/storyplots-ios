/**
 * Reinforcement Validator — local, non-LLM.
 *
 * architecture.md §4.6: "Local, non-LLM. Default implementation lives in
 * the React client (TypeScript) — this is what v0 ships."
 *
 * Normalization: strip/collapse whitespace, lowercase, remove extraneous
 * punctuation (preserving contraction apostrophes).
 *
 * Pass threshold: ≥95% normalized similarity (1 - editDistance/maxLen).
 */

const PASS_THRESHOLD = 0.95;

function normalize(s: string): string {
  return s
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ")
    // Remove punctuation except contraction apostrophes (e.g. don't, I'm).
    .replace(/(?<![a-z])'|'(?![a-z])|[.,!?;:"\u2018\u2019\u201C\u201D\u2014\u2013()\[\]{}]/gi, "")
    .trim();
}

function levenshtein(a: string, b: string): number {
  const m = a.length;
  const n = b.length;
  const dp: number[] = Array.from({ length: n + 1 }, (_, i) => i);
  for (let i = 1; i <= m; i++) {
    let prev = dp[0];
    dp[0] = i;
    for (let j = 1; j <= n; j++) {
      const temp = dp[j];
      dp[j] = a[i - 1] === b[j - 1] ? prev : 1 + Math.min(prev, dp[j], dp[j - 1]);
      prev = temp;
    }
  }
  return dp[n];
}

export function validateRewrite(attempt: string, target: string): { pass: boolean; similarity: number } {
  const a = normalize(attempt);
  const t = normalize(target);
  if (a === t) return { pass: true, similarity: 1 };
  const maxLen = Math.max(a.length, t.length);
  if (maxLen === 0) return { pass: true, similarity: 1 };
  const dist = levenshtein(a, t);
  const similarity = 1 - dist / maxLen;
  return { pass: similarity >= PASS_THRESHOLD, similarity };
}
