import { normaliseText } from '@/shared/utils/normalise-text'

/** More words than this add nothing to a product search and only cost time. */
const MAX_TERMS = 6

/** No product word is longer; a pasted paragraph must not become one giant term. */
const MAX_TERM_LENGTH = 30

/**
 * What the user typed, as a Postgres `tsquery` that matches while they are
 * still typing: every word is a PREFIX ("gom" finds "gomitas"), and all words
 * must be present ("leche alm" finds "Leche de almendras").
 *
 * Accents and case are dropped because the search index is built without them
 * — the ñ included: the index stores "piña" as "pina", so the query must too.
 * Anything that is not a letter or a digit separates words, which also keeps
 * tsquery operators typed by the user (& | ! : *) out of the query.
 *
 * Returns null when there is nothing to search for.
 */
export function toPrefixQuery(text: string): string | null {
  const terms = normaliseText(text)
    .split(/[^a-z0-9]+/)
    .filter((term) => term.length > 0)
    .map((term) => term.slice(0, MAX_TERM_LENGTH))
    .slice(0, MAX_TERMS)

  if (terms.length === 0) return null
  return terms.map((term) => `${term}:*`).join('&')
}
