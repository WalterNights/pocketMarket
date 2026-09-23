import { createClient } from '@supabase/supabase-js'

import { classifyProduct } from '../../core/classify'

/**
 * Re-files the catalogue already in the database under the current rules.
 *
 *   pnpm run reclassify -- --dry-run
 *
 * Classification rules change whenever a product shows up on the wrong shelf,
 * and re-running the whole ingestion to apply a one-line rule means asking the
 * store for its entire catalogue again. That is slow and impolite: our own
 * rule is one visit per store per day.
 *
 * This touches `category_id` and nothing else. Prices, availability and
 * `last_seen_at` are facts about the source and are none of its business.
 */

const PAGE = 1000

type Row = {
  id: string
  name: string
  source_bucket: string | null
  category_id: string | null
}

function flag(name: string): boolean {
  return process.argv.includes(`--${name}`)
}

async function main(): Promise<void> {
  const url = process.env.SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (url === undefined || key === undefined) {
    throw new Error('Faltan SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY')
  }

  const dryRun = flag('dry-run')
  const supabase = createClient(url, key, { auth: { persistSession: false } })

  const { data: categories, error: catError } = await supabase.from('category').select('id, slug')
  if (catError !== null) throw new Error(`categorías: ${catError.message}`)

  const idBySlug = new Map((categories ?? []).map((c) => [c.slug as string, c.id as string]))
  const slugById = new Map((categories ?? []).map((c) => [c.id as string, c.slug as string]))

  let from = 0
  let seen = 0
  let moved = 0
  const movements = new Map<string, number>()

  for (;;) {
    const { data, error } = await supabase
      .from('store_product')
      .select('id, name, source_bucket, category_id')
      .order('id')
      .range(from, from + PAGE - 1)

    if (error !== null) throw new Error(`lectura: ${error.message}`)

    const rows = (data ?? []) as Row[]
    if (rows.length === 0) break

    // Grouped by destination, because PostgREST updates one set of values per
    // request. One request per category (39 at most) instead of one per row —
    // and an upsert is not an option here: it builds an INSERT, which fails on
    // every NOT NULL column these partial rows do not carry.
    const byTarget = new Map<string | null, string[]>()

    for (const row of rows) {
      seen += 1

      const slug = classifyProduct(row.name, row.source_bucket)
      const target = idBySlug.get(slug) ?? null

      if (target === row.category_id) continue

      moved += 1
      const before = slugById.get(row.category_id ?? '') ?? 'sin categoría'
      const key = `${before} -> ${slug}`
      movements.set(key, (movements.get(key) ?? 0) + 1)

      const ids = byTarget.get(target)
      if (ids === undefined) byTarget.set(target, [row.id])
      else ids.push(row.id)
    }

    if (!dryRun) {
      for (const [target, ids] of byTarget) {
        const { error: writeError } = await supabase
          .from('store_product')
          .update({ category_id: target })
          .in('id', ids)

        if (writeError !== null) throw new Error(`escritura: ${writeError.message}`)
      }
    }

    if (rows.length < PAGE) break
    from += PAGE
  }

  const top = [...movements.entries()].sort((a, b) => b[1] - a[1]).slice(0, 15)

  console.log('')
  console.log(`  revisados   ${seen}`)
  console.log(`  reubicados  ${moved}${dryRun ? ' (dry-run, nada escrito)' : ''}`)
  console.log('')
  for (const [move, count] of top) {
    console.log(`  ${String(count).padStart(5)}  ${move}`)
  }
  console.log('')
}

main().catch((cause: unknown) => {
  console.error(cause instanceof Error ? cause.message : String(cause))
  process.exit(1)
})
