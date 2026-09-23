/**
 * Puts a product in the right aisle.
 *
 * The source only gives coarse buckets — Éxito's "Despensa" holds rice, pasta,
 * oil, tinned fish and coffee all at once — so the fine category has to be
 * deduced from the product name. Same approach as the icons, and for the same
 * reason: the name is the only place the information lives.
 *
 * Pure module: no network, no state. Every rule here is a test case.
 */

const COMBINING_MARKS = new RegExp('[̀-ͯ]', 'g')

function normalise(text: string): string {
  return text.toLowerCase().normalize('NFD').replace(COMBINING_MARKS, '')
}

/**
 * Phrases that say what a product TASTES OF or IS FILLED WITH, never what it
 * is. "Sabor a fresa" does not make something a strawberry, and "ravioli
 * relleno de pollo" is pasta, not chicken. Both are stripped before any
 * ingredient rule runs, or every powdered drink lands in Fruits.
 *
 * The connector is optional because the source writes it both ways: "sabor a
 * pollo" and "sabor pollo" are the same product.
 */
const FLAVOUR_PHRASE = /\bsabor(?:es)?\s+(?:a\s+|de\s+)?\S+(?:\s\S+)?/g
const FILLING_PHRASE = /\brellen[oa]s?\s+(?:de|con)\s+\S+(?:\s\S+)?/g

function stripModifiers(text: string): string {
  return text.replace(FLAVOUR_PHRASE, ' ').replace(FILLING_PHRASE, ' ')
}

/**
 * Rules are written in plain Spanish but matched against normalised text, so
 * the keywords have to lose their accents too. Without this every rule holding
 * an "n with tilde" -- pina, alino, panal, bunuelo -- silently never matched.
 */
/**
 * Turns a rule table into matchers.
 *
 * Keywords match WHOLE WORDS, plural included. Substring matching is what put
 * "repollo" in Chicken (po-LLO-), "espinaca" in Fruit (es-PINA-ca), "lechuga
 * morada" in Fruit (-MORA-da) and "limonaria" in Fruit (LIMON-aria). Three
 * different aisles, one cause.
 *
 * A keyword ending in `*` is a deliberate stem and keeps prefix matching:
 * "enlatad*" has to catch enlatado, enlatada and enlatados, which no plural
 * rule covers.
 *
 * Accents are stripped here too, because the haystack is normalised before the
 * comparison and a rule written "piña" would otherwise never match (ING-001).
 */
function compile(
  rules: readonly (readonly [string, string])[],
): readonly (readonly [RegExp, string])[] {
  return rules.map(([keyword, slug]) => {
    const word = normalise(keyword)

    const pattern = word.endsWith('*')
      ? new RegExp(`\\b${word.slice(0, -1)}`)
      : new RegExp(`\\b${word}(?:e?s)?\\b`)

    return [pattern, slug] as const
  })
}

/**
 * FORM rules, applied BEFORE the ingredient ones.
 *
 * How a product is presented outranks what it is made of: a tomato in a tin is
 * tinned food, powdered onion is a seasoning, and strawberry jam is a spread.
 * Getting this backwards is what put drinks in Fruits and soup in Vegetables.
 */
const EXCEPTIONS: readonly (readonly [RegExp, string])[] = compile([
  ['leche en polvo', 'leche'],
  ['leche deslactosada en polvo', 'leche'],
  ['crema de leche', 'leche'],
  ['chocolate en polvo', 'cafe-chocolate'],
  ['cafe en polvo', 'cafe-chocolate'],
  ['cafe molido', 'cafe-chocolate'],
  ['achocolatad*', 'cafe-chocolate'],
  ['cocoa en polvo', 'cafe-chocolate'],
  ['panela pulverizada', 'azucar-panela'],
  ['azucar en polvo', 'azucar-panela'],
  ['gelatina en polvo', 'yogures'],
])

const FORM_RULES: readonly (readonly [RegExp, string])[] = compile([
  // Untables
  ['mermelada', 'mermeladas'],
  ['jalea', 'mermeladas'],
  ['crema de avellana', 'mermeladas'],
  ['crema de mani', 'mermeladas'],

  // Sopas y caldos: "crema de tomate en sobre" es sopa, no tomate
  ['sopa', 'sopas'],
  ['crema de champi*', 'sopas'],
  ['crema de pollo', 'sopas'],
  ['crema de tomate', 'sopas'],
  ['crema de espar*', 'sopas'],
  ['crema de verdura', 'sopas'],
  ['crema de cebolla', 'sopas'],
  ['caldo', 'sopas'],
  ['consome', 'sopas'],
  ['cremita', 'sopas'],

  // Conservas: "tomate en lata" es enlatado, no verdura fresca
  ['en lata', 'enlatados'],
  ['enlatad*', 'enlatados'],
  ['en conserva', 'enlatados'],
  ['encurtid*', 'enlatados'],
  ['al natural en', 'enlatados'],

  // Deshidratados y molidos: son condimentos, no el vegetal fresco
  ['en polvo', 'sal-condimentos'],
  // Palabra entera a proposito: como raiz se traga "carne de res molida".
  // Las especias molidas ya entran por su propio nombre.
  ['molido', 'sal-condimentos'],
  ['deshidratad*', 'sal-condimentos'],
  ['granulad*', 'sal-condimentos'],

  // Mezclas para preparar
  ['premezcla', 'harinas'],
  ['mezcla lista', 'harinas'],
  ['mezcla para', 'harinas'],

  // Bebidas en polvo o preparadas: la forma manda sobre el sabor
  ['bebida refrescante', 'jugos'],
  ['bebida en polvo', 'jugos'],
  ['refresco en polvo', 'jugos'],
  ['bebida hidratante', 'jugos'],
  ['bebida láctea', 'leche'],
  ['alimento lácteo', 'yogures'],

  // Sopas instantáneas y bases: el animal del sabor no es el producto
  ['ramen', 'sopas'],
  ['base para', 'sopas'],

  // Embutidos: la charcutería manda sobre el animal. "Salchicha de pollo" es
  // un embutido, no pollo, y así estaba cayendo todo el jamón en Pollo.
  ['jamón', 'embutidos'],
  ['salchich*', 'embutidos'],
  ['chorizo', 'embutidos'],
  ['mortadela', 'embutidos'],
  ['tocineta', 'embutidos'],
  ['butifarra', 'embutidos'],
  ['salami', 'embutidos'],

  // Preparados y aderezos
  ['adobo', 'sal-condimentos'],
  ['puré de papa', 'sopas'],
  ['puré de', 'enlatados'],
  ['antipasto', 'enlatados'],
  ['barra nutritiva', 'cereales'],
  ['barra de cereal', 'cereales'],
])

/**
 * Keyword to category slug. ORDER MATTERS: the first match wins, so anything
 * specific must sit above the general rule that would otherwise swallow it.
 * "Leche de coco" is not milk; "leche condensada" is not milk either.
 */
const RULES: readonly (readonly [RegExp, string])[] = compile([
  // --- Trampas primero: nombres que contienen una palabra de otra categoría ---
  // Estas van antes que FORM_RULES vía excepción explícita: leche en polvo SÍ
  // es leche, aunque "en polvo" normalmente indique condimento.
  ['leche en polvo', 'leche'],
  ['crema de leche', 'leche'],
  ['chocolate en polvo', 'cafe-chocolate'],
  ['cafe en polvo', 'cafe-chocolate'],
  ['cafe molido', 'cafe-chocolate'],
  ['leche deslactosada en polvo', 'leche'],
  ['leche de coco', 'enlatados'],
  ['leche condensada', 'enlatados'],
  ['arroz con leche', 'cereales'],
  ['harina de arroz', 'harinas'],
  ['papel higienico', 'aseo-hogar'],
  ['papel cocina', 'aseo-hogar'],
  ['agua de panela', 'azucar-panela'],
  ['jugo de limon', 'sal-condimentos'],

  // --- Huevos: categoría propia, se compran solos ---
  ['huevo', 'huevos'],

  // --- Lácteos, cada uno por su lado ---
  ['yogur', 'yogures'],
  ['kumis', 'yogures'],
  ['avena en bolsa', 'yogures'],
  ['postre', 'yogures'],
  ['gelatina', 'yogures'],
  ['arequipe', 'yogures'],
  ['queso', 'quesos'],
  ['cuajada', 'quesos'],
  ['mantequilla', 'mantequilla'],
  ['margarina', 'mantequilla'],
  ['leche', 'leche'],

  // --- Mascotas y bebés, antes que cualquier animal ---
  // "Alimento para gatos sabor pollo" es comida de gato. La regla del animal
  // se lo llevaba a Pollo porque estaba más arriba.
  ['alimento para gato', 'mascotas'],
  ['alimento para perro', 'mascotas'],
  ['alimento gato', 'mascotas'],
  ['alimento perro', 'mascotas'],
  ['mascota', 'mascotas'],
  ['fórmula infantil', 'bebes'],
  ['compota', 'bebes'],

  // --- Proteínas ---
  // El pavo no es pollo, y "pechuga" a secas sí lo es: el pavo va primero.
  ['pavo', 'carnes'],
  ['pollo', 'pollo'],
  ['pechuga', 'pollo'],
  ['muslo', 'pollo'],
  ['alas de', 'pollo'],
  ['pescado', 'pescados'],
  ['tilapia', 'pescados'],
  ['salmon', 'pescados'],
  ['trucha', 'pescados'],
  ['camaron', 'pescados'],
  ['mojarra', 'pescados'],
  ['bagre', 'pescados'],
  ['carne', 'carnes'],
  ['res', 'carnes'],
  ['cerdo', 'carnes'],
  ['costilla', 'carnes'],
  ['lomo', 'carnes'],
  ['punta de anca', 'carnes'],
  ['sobrebarriga', 'carnes'],
  ['chicharron', 'carnes'],

  // --- Despensa ---
  ['arroz', 'arroz'],
  ['lenteja', 'granos'],
  ['frijol', 'granos'],
  ['garbanzo', 'granos'],
  ['arveja', 'granos'],
  ['blanquillo', 'granos'],
  ['soya', 'granos'],
  ['pasta', 'pastas'],
  ['spaghetti', 'pastas'],
  ['espagueti', 'pastas'],
  ['macarron', 'pastas'],
  ['tallarin', 'pastas'],
  ['lasagna', 'pastas'],
  ['fideo', 'pastas'],
  ['ñoqui', 'pastas'],
  ['aceite', 'aceites'],
  ['vinagre', 'aceites'],
  ['balsámic*', 'aceites'],
  ['oliva', 'aceites'],
  ['azucar', 'azucar-panela'],
  ['panela', 'azucar-panela'],
  ['endulzante', 'azucar-panela'],
  ['miel', 'azucar-panela'],
  ['atún', 'enlatados'],
  ['aceituna', 'enlatados'],
  ['enteros pelados', 'enlatados'],
  ['sardina', 'enlatados'],
  ['enlatad*', 'enlatados'],
  ['conserva', 'enlatados'],
  ['harina', 'harinas'],
  ['mezcla para', 'harinas'],
  ['cafe', 'cafe-chocolate'],
  ['aromatica', 'te-aromaticas'],
  ['manzanilla', 'te-aromaticas'],
  ['yerbabuena', 'te-aromaticas'],
  ['hierbabuena', 'te-aromaticas'],
  ['te negro', 'te-aromaticas'],
  ['te verde', 'te-aromaticas'],
  ['infusión', 'te-aromaticas'],
  ['limonaria', 'te-aromaticas'],
  ['citronela', 'te-aromaticas'],
  ['té helado', 'jugos'],
  ['té', 'te-aromaticas'],
  ['bebida achocolatada', 'cafe-chocolate'],
  ['chocolate', 'cafe-chocolate'],
  ['chocolate de mesa', 'cafe-chocolate'],
  ['cocoa', 'cafe-chocolate'],
  ['cacao', 'cafe-chocolate'],
  // Maiz y feculas
  ['maiz pira', 'snacks'],
  ['maiz trillado', 'granos'],
  ['fecula', 'harinas'],
  ['maizena', 'harinas'],
  ['avena', 'cereales'],
  ['cereal', 'cereales'],
  ['granola', 'cereales'],
  ['muesli', 'cereales'],
  // Especias: iban a "otros" y son condimentos
  ['pimienta', 'sal-condimentos'],
  ['canela', 'sal-condimentos'],
  ['oregano', 'sal-condimentos'],
  ['curcuma', 'sal-condimentos'],
  ['comino', 'sal-condimentos'],
  ['laurel', 'sal-condimentos'],
  ['especia', 'sal-condimentos'],
  ['finas hierbas', 'sal-condimentos'],
  ['ajo en polvo', 'sal-condimentos'],
  ['achiote', 'sal-condimentos'],
  ['color', 'sal-condimentos'],
  ['sal', 'sal-condimentos'],
  ['salsa', 'sal-condimentos'],
  ['mayonesa', 'sal-condimentos'],
  ['mostaza', 'sal-condimentos'],
  ['condimento', 'sal-condimentos'],
  ['aliño', 'sal-condimentos'],
  ['chile', 'sal-condimentos'],
  ['ssa', 'sal-condimentos'],
  ['sazonador', 'sal-condimentos'],

  // --- Panadería ---
  ['pan', 'pan'],
  ['pandebono', 'pan'],
  ['pandeyuca', 'pan'],
  ['buñuelo', 'pan'],
  ['arepa', 'arepas'],
  ['tortilla', 'arepas'],
  ['galleta', 'galletas'],
  ['ponque', 'galletas'],
  ['torta', 'galletas'],
  ['brownie', 'galletas'],
  ['wafer', 'galletas'],
  ['barquillo', 'galletas'],
  ['oblea', 'galletas'],

  // --- Bebidas, desglosadas ---
  ['gaseosa', 'gaseosas'],
  ['coca cola', 'gaseosas'],
  ['coca-cola', 'gaseosas'],
  ['pepsi', 'gaseosas'],
  ['sprite', 'gaseosas'],
  ['colombiana', 'gaseosas'],
  ['manzana postobon', 'gaseosas'],
  ['quatro', 'gaseosas'],
  ['premio', 'gaseosas'],
  ['jugo', 'jugos'],
  ['nectar', 'jugos'],
  ['refresco', 'jugos'],
  ['hit', 'jugos'],
  ['te helado', 'jugos'],
  ['agua', 'agua'],
  ['cerveza', 'licores'],
  ['vino', 'licores'],
  ['aguardiente', 'licores'],
  ['ron', 'licores'],
  ['whisky', 'licores'],
  ['tequila', 'licores'],

  // --- Otros ---
  ['papas fritas', 'snacks'],
  ['pasabocas', 'snacks'],
  ['snack', 'snacks'],
  ['mani', 'snacks'],
  ['platanitos*', 'snacks'],
  ['chicharron de*', 'snacks'],
  ['crispeta', 'snacks'],
  ['tostacos', 'snacks'],
  ['deditos', 'snacks'],
  ['chocolatina', 'dulces'],
  ['bombon', 'dulces'],
  ['caramelo', 'dulces'],
  ['gomita', 'dulces'],
  ['chicle', 'dulces'],
  ['dulce', 'dulces'],
  ['pañal', 'bebes'],
  ['compota', 'bebes'],
  ['formula infantil', 'bebes'],
  ['perro', 'mascotas'],
  ['gato', 'mascotas'],
  ['mascota', 'mascotas'],
  ['concentrado', 'mascotas'],
  ['detergente', 'aseo-hogar'],
  ['jabon en polvo', 'aseo-hogar'],
  ['lavaplatos', 'aseo-hogar'],
  ['blanqueador', 'aseo-hogar'],
  ['limpiador', 'aseo-hogar'],
  ['desinfectante', 'aseo-hogar'],
  ['suavizante', 'aseo-hogar'],
  ['escoba', 'aseo-hogar'],
  ['bolsa de basura', 'aseo-hogar'],
  ['shampoo', 'cuidado-personal'],
  ['champu', 'cuidado-personal'],
  ['crema dental', 'cuidado-personal'],
  ['cepillo dental', 'cuidado-personal'],
  ['desodorante', 'cuidado-personal'],
  ['jabon de baño', 'cuidado-personal'],
  ['papel higienico', 'cuidado-personal'],
  ['toalla higienica', 'cuidado-personal'],
  ['afeitar', 'cuidado-personal'],
  ['congelad*', 'congelados'],
  ['helado', 'congelados'],
])

/**
 * Fresh produce, kept apart from every other rule and applied ONLY when the
 * source itself says the product came from the fruit and vegetable aisle.
 *
 * Fruit names turn up everywhere: "Barquillo pie de limon", "Reduccion
 * balsamica de manzana", "Helado de fresa", "Papas fritas". Matched on the
 * name alone, an ingredient rule drags all of that into Fruits, which is
 * exactly what the app was showing. A real lemon is sold in the produce aisle
 * and a lemon wafer is not, so the source bucket is the discriminator here,
 * not a longer list of words.
 */
const PRODUCE_RULES: readonly (readonly [RegExp, string])[] = compile([
  ['banano', 'frutas'],
  ['platano', 'frutas'],
  ['manzana', 'frutas'],
  ['naranja', 'frutas'],
  ['mandarina', 'frutas'],
  ['uva', 'frutas'],
  ['fresa', 'frutas'],
  ['mango', 'frutas'],
  ['papaya', 'frutas'],
  ['piña', 'frutas'],
  ['aguacate', 'frutas'],
  ['limon', 'frutas'],
  ['pera', 'frutas'],
  ['mora', 'frutas'],
  ['maracuya', 'frutas'],
  ['papa', 'verduras'],
  ['cebolla', 'verduras'],
  ['tomate', 'verduras'],
  ['zanahoria', 'verduras'],
  ['lechuga', 'verduras'],
  ['yuca', 'verduras'],
  ['ahuyama', 'verduras'],
  ['pimenton', 'verduras'],
  ['brocoli', 'verduras'],
  ['espinaca', 'verduras'],
  ['cilantro', 'verduras'],
  ['habichuela', 'verduras'],
  ['pepino', 'verduras'],
  ['repollo', 'verduras'],
])

/** Buckets where a fruit name really does mean the fruit. */
const PRODUCE_SOURCES: ReadonlySet<string | null> = new Set(['frutas-verduras', null])

/**
 * Fallback when the name says nothing: the source's own coarse bucket, mapped
 * to the closest aisle we have.
 */
const SOURCE_FALLBACK: Record<string, string> = {
  viveres: 'otros',
  lacteos: 'leche',
  carnes: 'carnes',
  'frutas-verduras': 'verduras',
  panaderia: 'pan',
  bebidas: 'jugos',
  congelados: 'congelados',
  'aseo-hogar': 'aseo-hogar',
  'cuidado-personal': 'cuidado-personal',
  bebes: 'bebes',
  mascotas: 'mascotas',
  otros: 'otros',
}

/**
 * Best aisle for a product. Never null: an unclassifiable product lands in
 * "otros" rather than disappearing from every category listing.
 */
export function classifyProduct(productName: string, sourceCategory: string | null): string {
  // Flavour and filling first: they poison every ingredient rule downstream.
  const haystack = ` ${stripModifiers(normalise(productName))} `

  // Explicit exceptions outrank even the form rules: milk powder IS milk,
  // though "en polvo" otherwise means seasoning.
  for (const [pattern, slug] of EXCEPTIONS) {
    if (pattern.test(haystack)) return slug
  }

  // Form beats ingredient. "Crema de tomate en sobre" is soup, not a tomato.
  for (const [pattern, slug] of FORM_RULES) {
    if (pattern.test(haystack)) return slug
  }

  for (const [pattern, slug] of RULES) {
    if (pattern.test(haystack)) return slug
  }

  // Fresh produce, only where produce is actually sold.
  if (PRODUCE_SOURCES.has(sourceCategory)) {
    for (const [pattern, slug] of PRODUCE_RULES) {
      if (pattern.test(haystack)) return slug
    }
  }

  if (sourceCategory !== null) {
    const fallback = SOURCE_FALLBACK[sourceCategory]
    if (fallback !== undefined) return fallback
  }

  return 'otros'
}
