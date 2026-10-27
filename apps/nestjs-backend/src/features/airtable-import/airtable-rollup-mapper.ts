/**
 * Maps an Airtable rollup aggregation (the `formulaTextParsed` of a rollup
 * column, e.g. "SUM(values)") to a Table rollup expression ("sum({values})").
 *
 * Table rollups accept a fixed set of aggregation functions, every one of which
 * has a direct Airtable counterpart, so a single `FUNC(values)` aggregation
 * translates 1:1. Anything outside that — a compound or custom aggregation such
 * as "SUM(values) * 2" or "ROUND(AVERAGE(values), 1)" — has no live equivalent
 * and returns null, so the importer falls back to a static value snapshot.
 */

/** Airtable rollup function (upper-case) → Table rollup function. */
const airtableRollupToTable: Record<string, string> = {
  SUM: 'sum',
  AVERAGE: 'average',
  MAX: 'max',
  MIN: 'min',
  COUNT: 'count',
  COUNTA: 'counta',
  COUNTALL: 'countall',
  AND: 'and',
  OR: 'or',
  XOR: 'xor',
  ARRAYJOIN: 'array_join',
  ARRAYUNIQUE: 'array_unique',
  ARRAYCOMPACT: 'array_compact',
  CONCATENATE: 'concatenate',
};

// One `FUNC(values)` call and nothing else. ARRAYJOIN also accepts a trailing
// separator argument, which is dropped: Table's array_join joins with a comma.
const singleAggregation = /^([a-z]+)\s*\(\s*values\s*(?:,[^)]*)?\)$/i;

/**
 * Returns the Table rollup expression for an Airtable aggregation, or null when
 * the aggregation is compound/custom and cannot be a live Table rollup.
 */
export const mapAirtableRollupAggregation = (formulaTextParsed: string): string | null => {
  const match = formulaTextParsed.trim().match(singleAggregation);
  if (!match) return null;
  const teableFn = airtableRollupToTable[match[1].toUpperCase()];
  return teableFn ? `${teableFn}({values})` : null;
};
