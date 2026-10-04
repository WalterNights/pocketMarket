/**
 * Retiring what a source stopped listing — shops or products. Never a delete
 * (rule 16): the row stays, marked inactive, because user data points at it.
 */

/**
 * Rows missing from a run are retired only if they are at most this share of
 * the rows found. A chain does not close a quarter of its shops in a month,
 * nor drop a quarter of its catalogue in three days; a source that answered
 * half its pages does — and must not empty half the app.
 */
export const MAX_RETIRE_RATIO = 0.25

/** PURE: may the `missing` rows (active before, not seen now) be marked inactive? */
export function mayRetire(found: number, missing: number): boolean {
  return missing <= found * MAX_RETIRE_RATIO
}
