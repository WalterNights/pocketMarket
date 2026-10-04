/**
 * Combining diacritics left behind by NFD normalisation. Written with escapes
 * on purpose: the literal characters are invisible in the source and impossible
 * to review (known-issues.md, "Caracteres invisibles en el fuente").
 */
const COMBINING_MARKS = new RegExp('[\u0300-\u036f]', 'g')

/**
 * Lowercase and strip accents, so "Plátano" and "platano" compare equal.
 *
 * Whatever is compared against normalised text must be normalised too: an
 * accented key never matches an accent-free haystack (ING-001).
 */
export function normaliseText(text: string): string {
  return text.toLowerCase().normalize('NFD').replace(COMBINING_MARKS, '')
}
