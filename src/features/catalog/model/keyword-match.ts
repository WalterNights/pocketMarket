import { normaliseText } from '@/shared/utils/normalise-text'

/**
 * Whole-word keyword matching over product names.
 *
 * Substring matching finds short words inside longer ones: "res" in fresa and
 * refresco, "pan" in pañal and Pantene, "agua" in aguacate. Ingestion paid for
 * exactly this already (ING-006), so keywords compile to whole-word regular
 * expressions with an optional plural: `pan` matches "pan" and "panes", never
 * "panal".
 *
 * A keyword ending in `*` is an explicit stem: `salchich*` matches salchicha,
 * salchichón and salchichas. Stems are opt-in; whole word is the default.
 *
 * Keys are normalised like the haystack (lowercase, no accents), so they can be
 * written in plain Spanish — a normalised haystack never contains "ñ" (ING-001).
 *
 * Pure module: no React, no network (rule 3).
 */

const STEM_MARKER = '*'
const REGEX_SPECIALS = /[.*+?^${}()|[\]\\]/g

function escapeRegex(text: string): string {
  return text.replace(REGEX_SPECIALS, '\\$&')
}

/** Compiles one keyword. Exported for tests; tables use `compileKeywordTable`. */
export function compileKeyword(keyword: string): RegExp {
  const normalised = normaliseText(keyword).trim()

  if (normalised.endsWith(STEM_MARKER)) {
    const stem = normalised.slice(0, -STEM_MARKER.length)
    return new RegExp(`\\b${escapeRegex(stem)}`)
  }

  return new RegExp(`\\b${escapeRegex(normalised)}(?:e?s)?\\b`)
}

export type CompiledKeywordTable<T> = readonly (readonly [RegExp, T])[]

/** Compiles a keyword table once, at module load. Order is preserved. */
export function compileKeywordTable<T>(
  table: readonly (readonly [string, T])[],
): CompiledKeywordTable<T> {
  return table.map(([keyword, value]) => [compileKeyword(keyword), value] as const)
}

/**
 * First value whose keyword appears in `text`, or undefined. `text` is
 * normalised here, so callers pass the raw product name.
 */
export function firstMatch<T>(table: CompiledKeywordTable<T>, text: string): T | undefined {
  const haystack = normaliseText(text)
  for (const [pattern, value] of table) {
    if (pattern.test(haystack)) return value
  }
  return undefined
}
