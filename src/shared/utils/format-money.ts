/**
 * Colombian peso formatting. Integer COP, thousands separator, no decimals.
 *
 * Intl is available in Hermes with the full ICU build that React Native ships,
 * but the formatter is created once: instantiating Intl per list row is a
 * measurable cost when scrolling.
 */
const copFormatter = new Intl.NumberFormat('es-CO', {
  style: 'currency',
  currency: 'COP',
  maximumFractionDigits: 0,
  minimumFractionDigits: 0,
})

export function formatCop(amountCop: number): string {
  return copFormatter.format(amountCop)
}
