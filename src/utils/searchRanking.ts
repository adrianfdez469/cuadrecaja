/**
 * Relevance ranking for free-text product search.
 *
 * A plain `includes()` filter treats "Coca Cola" and "Malta con cola" as
 * equally good answers to "cola", so the row the user actually wanted can land
 * anywhere in the list. These ranks order matches by how strongly the term
 * anchors to the text: lower is better.
 */
export const SEARCH_RANK = {
  /** The whole field is the term. */
  EXACT: 0,
  /** The field starts with the term ("coca" → "Coca Cola"). */
  PREFIX: 1,
  /** Some word inside the field starts with the term ("cola" → "Coca Cola"). */
  WORD_PREFIX: 2,
  /** The term appears somewhere ("ola" → "Coca Cola"). */
  CONTAINS: 3,
} as const;

export type SearchRank = (typeof SEARCH_RANK)[keyof typeof SEARCH_RANK];

/**
 * Rank of `term` inside `text`, or `null` when it does not match at all.
 *
 * Both arguments must already be normalized (see `normalizeSearch`): this runs
 * once per product per keystroke, so it does no normalization of its own.
 */
export function scoreMatch(text: string, term: string): SearchRank | null {
  if (!term) return null;
  const index = text.indexOf(term);
  if (index === -1) return null;
  if (index === 0)
    return text.length === term.length ? SEARCH_RANK.EXACT : SEARCH_RANK.PREFIX;
  // `normalizeSearch` collapses whitespace to single spaces, so a word
  // boundary is exactly a preceding space.
  if (text[index - 1] === " ") return SEARCH_RANK.WORD_PREFIX;
  return SEARCH_RANK.CONTAINS;
}

/**
 * Best (lowest) rank across several fields, or `null` if none match.
 */
export function scoreBestMatch(
  texts: string[],
  term: string,
): SearchRank | null {
  let best: SearchRank | null = null;
  for (const text of texts) {
    const rank = scoreMatch(text, term);
    if (rank === null) continue;
    if (rank === SEARCH_RANK.EXACT) return rank;
    if (best === null || rank < best) best = rank;
  }
  return best;
}

/**
 * Keeps only the items that match `term` and sorts them by relevance.
 *
 * Ties keep the input order, so an already-sorted catalog stays predictable
 * below the ranked head of the list.
 */
export function rankBySearch<T>(
  items: T[],
  term: string,
  getSearchableFields: (item: T) => string[],
): T[] {
  const matches: { item: T; rank: SearchRank; index: number }[] = [];

  items.forEach((item, index) => {
    const rank = scoreBestMatch(getSearchableFields(item), term);
    if (rank !== null) matches.push({ item, rank, index });
  });

  matches.sort((a, b) => a.rank - b.rank || a.index - b.index);

  return matches.map((m) => m.item);
}
