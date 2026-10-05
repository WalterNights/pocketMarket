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

/**
 * Unicode combining diacritics. Written as escapes on purpose: the literal
 * characters are invisible in the source and impossible to review.
 */
const COMBINING_MARKS = new RegExp('[\u0300-\u036f]', 'g')

/**
 * Lower case, accents stripped: "Piña" -> "pina". Whatever is compared
 * against normalised text must be normalised too (ING-001).
 */
export function normalise(text: string): string {
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

/**
 * "Perro caliente" is a hot dog. Fused into one token so that the bare word
 * "perro" — a pet signal — never sees it: "Combo perro caliente + bebida" is
 * food for people.
 */
const HOT_DOG = /\bperros?\s+calientes?\b/g

/**
 * A name that opens with the same word twice: "Aros AROS DE CEBOLLA",
 * "Quitamanchas QUITAMANCHAS EN POLVO". It is what is left when the source
 * repeats the product type after the brand and the brand is stripped. The
 * second copy is the one that carries the rest of the phrase, so the first is
 * dropped: every head rule ("aros de cebolla") then reads the name it expects.
 */
const REPEATED_HEAD = /^(\s*)([a-z]{3,}?)(?:e?s)?\s+(?=\2(?:e?s)?\b)/

function stripModifiers(text: string): string {
  return text
    .replace(REPEATED_HEAD, '$1')
    .replace(FLAVOUR_PHRASE, ' ')
    .replace(FILLING_PHRASE, ' ')
    .replace(HOT_DOG, ' perrocaliente ')
}

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
 * The whole keyword is lower-cased with them, so a regex fragment inside one
 * cannot use an upper-case class ("\S" would compile as "\s"): write "[^ ]".
 *
 * With `head`, the keyword only matches as the FIRST word of the name (an
 * optional "3 x" pack count aside). See HEAD_RULES.
 */
function compile<T = string>(
  rules: readonly (readonly [string, T])[],
  { head = false }: { head?: boolean } = {},
): readonly (readonly [RegExp, T])[] {
  const anchor = head ? '^\\s*(?:\\d+\\s*x\\s*)?' : '\\b'

  return rules.map(([keyword, slug]) => {
    const word = normalise(keyword)

    const pattern = word.endsWith('*')
      ? new RegExp(`${anchor}${word.slice(0, -1)}`)
      : new RegExp(`${anchor}${word}(?:e?s)?\\b`)

    return [pattern, slug] as const
  })
}

function firstMatch<T = string>(
  rules: readonly (readonly [RegExp, T])[],
  haystack: string,
): T | null {
  for (const [pattern, slug] of rules) {
    if (pattern.test(haystack)) return slug
  }
  return null
}

/**
 * The match that starts EARLIEST in the name, not the first rule in the list.
 * For fresh produce the head noun comes first: "Tomate pera" is a tomato of
 * the pear variety, not a pear, whichever rule happens to sit higher.
 */
function earliestMatch(
  rules: readonly (readonly [RegExp, string])[],
  haystack: string,
): string | null {
  let best: { index: number; slug: string } | null = null
  for (const [pattern, slug] of rules) {
    const m = pattern.exec(haystack)
    if (m !== null && (best === null || m.index < best.index)) best = { index: m.index, slug }
  }
  return best?.slug ?? null
}

/**
 * Pets, by what the name says explicitly. Runs before everything else that
 * reads the name: "Galletas para perros" is not a cracker and "Shampoo para
 * perros" is not personal care. Only unambiguous phrasings live here; the bare
 * word "perro" stays at the bottom of RULES, below "pan perro" and "salchicha
 * súper perro". "ALIM PERRO" is how the ERPs abbreviate "alimento".
 */
const PET_RULES: readonly (readonly [RegExp, string])[] = compile([
  ['alim(?:ento)?\\.? (?:para )?(?:perro|gato|cachorro|felino|canino)', 'mascotas'],
  ['para perro', 'mascotas'],
  ['para gato', 'mascotas'],
  ['para mascota', 'mascotas'],
  ['cachorro', 'mascotas'],
  ['felino', 'mascotas'],
])

/**
 * Household and personal care, before any food rule.
 *
 * A cleaning product's name is full of food words that describe its scent or
 * its active ingredient: "ropa COLOR" (the seasoning rule), "manzana/canela"
 * (a spice), "vinagre" (an oil), "avena" (a cereal), "en polvo" (a seasoning
 * form). None of them is the product. Not edible is a stronger fact than any
 * ingredient, so it is decided first. Clorox and Blancox are brands used as
 * the common noun for bleach in Colombia, the way the shopper says them.
 */
const NON_FOOD_RULES: readonly (readonly [RegExp, string])[] = compile([
  ['detergente', 'aseo-hogar'],
  ['jabon en polvo', 'aseo-hogar'],
  ['jabon para ropa', 'aseo-hogar'],
  ['lavaloza*', 'aseo-hogar'],
  ['lavaplatos', 'aseo-hogar'],
  ['lavavajilla*', 'aseo-hogar'],
  ['blanqueador', 'aseo-hogar'],
  ['clorox', 'aseo-hogar'],
  ['blancox', 'aseo-hogar'],
  ['cloro', 'aseo-hogar'],
  ['limpiador', 'aseo-hogar'],
  ['limpia pisos', 'aseo-hogar'],
  ['limpiapisos', 'aseo-hogar'],
  ['limpiavidrios', 'aseo-hogar'],
  ['desinfectante', 'aseo-hogar'],
  ['suavizante', 'aseo-hogar'],
  // Not the stem "ambient*": "Leche larga vida ambiente" is shelf-stable milk.
  // The bare "ambient" is how the ERPs abbreviate it ("Ambient Glade aero").
  ['ambientador*', 'aseo-hogar'],
  ['ambiental', 'aseo-hogar'],
  ['ambient\\b', 'aseo-hogar'],
  // Drain cleaner, before the head noun "soda" makes it a soft drink
  ['soda caustica', 'aseo-hogar'],
  ['insecticida', 'aseo-hogar'],
  ['escoba', 'aseo-hogar'],
  ['trapero', 'aseo-hogar'],
  ['esponja', 'aseo-hogar'],
  ['bolsa de basura', 'aseo-hogar'],
  ['bolsas para basura', 'aseo-hogar'],
  ['papel higienico', 'aseo-hogar'],
  ['papel cocina', 'aseo-hogar'],
  ['papel aluminio', 'aseo-hogar'],
  ['servilleta', 'aseo-hogar'],
  ['shampoo', 'cuidado-personal'],
  ['champu', 'cuidado-personal'],
  ['acondicionador', 'cuidado-personal'],
  ['crema dental', 'cuidado-personal'],
  ['pasta dental', 'cuidado-personal'],
  ['cepillo dental', 'cuidado-personal'],
  ['desodorante', 'cuidado-personal'],
  ['jabon de baño', 'cuidado-personal'],
  ['toalla higienica', 'cuidado-personal'],
  ['afeitar', 'cuidado-personal'],
])

/**
 * Frozen is a form, and the strongest one: "Maíz dulce congelado" is in the
 * freezer, whatever the maize rules say, and "Palitos de queso congelados" is
 * not the shelf snack. Runs before the head nouns for that reason.
 */
const FROZEN_RULES: readonly (readonly [RegExp, string])[] = compile([
  ['congelad*', 'congelados'],
  // Ice cream is the product, wherever the word sits and whatever it tastes
  // of: "Helado chocolate", "Torta de helado", "Galleta con helado". It used to
  // be the LAST ingredient rule, so every flavour outranked it. Three things
  // are not ice cream: iced tea, the powder to make ice cream at home, and
  // "menta helada" (the feminine never matches). "HELAD" is the ERP spelling.
  ['(?<!\\bte )(?<!\\bpara )(?<!\\bpreparar )helado', 'congelados'],
  ['(?<!\\bte )helad', 'congelados'],
  // Puff pastry is sold as "pasta" or "masa" de hojaldre, from the freezer
  ['(?:pasta|masa) (?:de )?hojaldre', 'congelados'],
])

/**
 * CLOSED AISLES: source buckets that hold one kind of thing, so the bucket
 * decides and the food rules never run. Weaker than AUTHORITATIVE_SOURCES: the
 * pet and non-food layers still go first (Supermú files an air freshener in
 * its frozen aisle), and each aisle lists the few head nouns it gives back.
 *
 * "aseo-hogar" has no food in it, and its names are made of food words that
 * no list keeps up with: "Ropa Color", "Balde para agua", "Betún en pasta",
 * "Vinagre de limpieza", "Vela aromática", "Copa de vino". Same reasoning as
 * the pet aisle (ING-008), one layer down.
 *
 * "congelados" is the freezer: "Ravioli de pollo", "Nuggets de pollo",
 * "Palito de queso para freír" and "Helado chocolate" are frozen food, not
 * chicken, a shelf snack or cocoa. Arepas come back out: Supermú keeps its
 * chilled arepas there and the shopper looks for them under Arepas.
 */
const CLOSED_AISLES: Readonly<Record<string, readonly (readonly [RegExp, string])[]>> = {
  'aseo-hogar': [],
  congelados: compile(
    [
      ['arep*', 'arepas'],
      ['tortilla', 'arepas'],
    ],
    { head: true },
  ),
}

/**
 * A head noun that names different products in different aisles. The word
 * alone cannot tell them apart, the aisle can: "Papa pastusa" in produce is a
 * potato and "Papas pollo" in the snack aisle is a bag of crisps.
 * `NO_AISLE` is the key for a product that arrives with no bucket at all.
 */
interface ByAisle {
  readonly aisles: Readonly<Record<string, string>>
  readonly otherwise: string
}

const NO_AISLE = 'none'

function resolve(target: string | ByAisle, aisle: string | null): string {
  if (typeof target === 'string') return target
  return target.aisles[aisle ?? NO_AISLE] ?? target.otherwise
}

/** Fresh in produce (and when nothing says otherwise); crisps anywhere else. */
const POTATO: ByAisle = {
  aisles: { 'frutas-verduras': 'verduras', [NO_AISLE]: 'verduras' },
  otherwise: 'snacks',
}

/** Bread sticks in the bakery, string cheese in dairy, a shelf snack elsewhere. */
const STICK: ByAisle = { aisles: { panaderia: 'pan', lacteos: 'quesos' }, otherwise: 'snacks' }

/**
 * Every source files sweets and snacks under one bucket ("otros"): there a
 * name that opens with "Chocolate" is a chocolate bar. In the pantry it is
 * drinking chocolate.
 */
const CHOCOLATE: ByAisle = { aisles: { otros: 'dulces' }, otherwise: 'cafe-chocolate' }

/**
 * HEAD NOUNS: product types that decide the aisle when they OPEN the name.
 *
 * Spanish names the product first and qualifies it afterwards: "Galleta
 * leche" is a cracker that tastes of milk, "Pan tajado mantequilla" is bread,
 * "Salsa para carnes" is a sauce, "Gaseosa sin azúcar" is a soft drink, "Atún
 * en aceite" is tinned tuna. The ingredient rules read every word with the same
 * weight, so whichever ingredient sits higher in RULES won — milk, butter,
 * beef, sugar, oil. Adding the qualifier words one by one would never end;
 * the missing piece was the position of the word (ING-002).
 *
 * Only product types live here, never ingredients: "Tomate pera" must not
 * become a head-noun decision, and neither may "Leche de coco".
 */
const HEAD_RULES: readonly (readonly [RegExp, string | ByAisle])[] = compile<string | ByAisle>(
  [
    // Bakery
    ['galleta', 'galletas'],
    ['saltin*', 'galletas'],
    ['wafer', 'galletas'],
    ['ponque', 'galletas'],
    ['barquillo', 'galletas'],
    ['pan', 'pan'],
    ['panecillo', 'pan'],
    ['tostada', 'pan'],
    ['arepa', 'arepas'],
    ['arepita', 'arepas'],
    ['tortilla', 'arepas'],

    // Breakfast
    ['cereal', 'cereales'],
    ['hojuela', 'cereales'],
    // Onion rings open with the same word as the breakfast loops
    ['aros? de cebolla', 'snacks'],
    ['aro', 'cereales'],
    ['cafe', 'cafe-chocolate'],

    // Dairy whose name carries a flavour
    ['yogur*', 'yogures'],
    ['bonyurt', 'yogures'],

    // Sweets
    ['bocadillo', 'dulces'],
    ['dulce', 'dulces'],
    ['cocada', 'dulces'],
    ['gelatina', 'dulces'],
    ['halls', 'dulces'],
    // A chocolate bar is a sweet, with or without milk, peanuts or rice in it
    ['chocolatin*', 'dulces'],
    ['bombon', 'dulces'],
    // Table chocolate by its own words, before the aisle decides the rest
    ['chocolates? (?:de )?mesa', 'cafe-chocolate'],
    ['chocolates? (?:instantaneo|tradicional|pastill\\w*|clavos)', 'cafe-chocolate'],
    ['chocolate', CHOCOLATE],

    // Ice cream by its shape. The lollipop and the pork cut that share the
    // word "paleta" are named in EXCEPTIONS.
    ['paleta', 'congelados'],
    ['chococono', 'congelados'],
    ['choco cono', 'congelados'],
    ['cono', 'congelados'],

    // Snacks
    ['snack', 'snacks'],
    ['pasaboca*', 'snacks'],
    // "PBOCA" is how Olímpica's ERP abbreviates it
    ['pboca', 'snacks'],
    ['crispeta', 'snacks'],
    ['palomita', 'snacks'],
    ['papas fritas', 'snacks'],
    ['papa frita', 'snacks'],
    // Pre-cut potatoes for the fryer are frozen, whichever aisle lists them
    ['papas? (?:a la )?frances\\w*', 'congelados'],
    ['papas? en cascos?', 'congelados'],
    ['papas? (?:para )?air ?fryer', 'congelados'],
    ['papa', POTATO],
    ['papita', POTATO],
    // Breaded fish or chicken sticks live in the freezer, not on the snack shelf
    ['palitos? de (?:pescado|merluza|pollo)', 'congelados'],
    ['palito', STICK],
    ['rosquita', 'snacks'],
    ['doritos', 'snacks'],
    ['nachos', 'snacks'],
    ['mani', 'snacks'],
    ['almendra', 'snacks'],
    ['marañon', 'snacks'],
    ['uvas pasas', 'snacks'],
    ['pasas', 'snacks'],

    // Ready-made, sold frozen
    ['deditos', 'congelados'],
    ['empanada', 'congelados'],

    // Drinks
    ['gaseosa', 'gaseosas'],
    ['soda', 'gaseosas'],
    ['jugo', 'jugos'],
    ['nectar', 'jugos'],

    // Pantry
    ['salsa', 'sal-condimentos'],
    ['aderezo', 'sal-condimentos'],
    ['aceite', 'aceites'],
    ['vinagre', 'aceites'],
    ['atun', 'enlatados'],
    ['sardina', 'enlatados'],
    ['conserva', 'enlatados'],

    // Pasta shapes: a name that opens with one is pasta, whatever the sauce
    ['pasta', 'pastas'],
    ['spaghetti', 'pastas'],
    ['spaguetti', 'pastas'],
    ['espagueti', 'pastas'],
    ['macarron', 'pastas'],
    ['fettuccin*', 'pastas'],
    ['penne', 'pastas'],
    ['fusilli', 'pastas'],
    // "Conchas" is a pasta shape; "Concha de coco" is the shell of something
    // else, and a taco shell is a tortilla
    ['conchas? (?:[^ ]+ )?para tacos?', 'arepas'],
    ['conchas?\\b(?! de )', 'pastas'],
    ['cabello de angel', 'pastas'],
    ['tallarin', 'pastas'],
    ['fideo', 'pastas'],
  ],
  { head: true },
)

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
  ['gelatina en polvo', 'dulces'],
  // Dishes and pastes whose name opens with another aisle's head noun
  ['chile con carne', 'enlatados'],
  // "Pasta de X" is a paste of X (tomato, garlic, onion, sesame) unless X is
  // what pasta is made from. Naming the pastes one by one missed onion,
  // pepper and tahini; the flours and legumes are the short list.
  [
    'pasta de (?!arroz|trigo|maiz|semola|huevo|lenteja|garbanzo|quinua|quinoa|sopa|hojaldre)[a-z]+',
    'sal-condimentos',
  ],
  // Iced tea is a drink, not an infusion and not ice cream
  ['te helado', 'jugos'],
  // "Paleta" is also a pork or beef shoulder, and a lollipop
  ['paletas? (?:de )?(?:cerdo|res|cordero|ternera)', 'carnes'],
  ['paletas? caram\\b', 'dulces'],
  ['paletas? (?:[^ ]+ ){0,3}(?:chile|candy)', 'dulces'],
  ['salsa de arequipe', 'dulces'],
  ['salsa arequipe', 'dulces'],
  // Plant "milks" are drunk as milk; the nut itself is a snack
  ['almendrola', 'leche'],
  ['bebida de almendra*', 'leche'],
  ['bebida de avena', 'leche'],
  ['bebida de soya', 'leche'],
  ['bebida vegetal', 'leche'],
  ['leche de almendra*', 'leche'],
])

const FORM_RULES: readonly (readonly [RegExp, string])[] = compile([
  // Untables
  ['mermelada', 'mermeladas'],
  ['jalea', 'mermeladas'],
  ['crema de avellana', 'mermeladas'],
  ['crema de mani', 'mermeladas'],

  // Soups and stocks: "crema de tomate en sobre" is soup, not a tomato
  ['sopa', 'sopas'],
  // "Crema pollo champiñones" drops the "de"; the rule must not depend on it.
  ['crema (?:de )?(?:champi\\w*|pollo|tomate|espar\\w*|verdura|cebolla)', 'sopas'],
  ['crema sopera', 'sopas'],
  ['caldo', 'sopas'],
  ['consome', 'sopas'],
  ['cremita', 'sopas'],

  // Preserves: "tomate en lata" is tinned food, not a fresh vegetable
  ['en lata', 'enlatados'],
  ['enlatad*', 'enlatados'],
  ['en conserva', 'enlatados'],
  ['encurtid*', 'enlatados'],
  ['al natural en', 'enlatados'],

  // Dried and ground: seasonings, not the fresh vegetable
  ['en polvo', 'sal-condimentos'],
  // Whole word on purpose: as a stem it swallows "carne de res molida".
  // Ground spices already match by their own name.
  ['molido', 'sal-condimentos'],
  ['deshidratad*', 'sal-condimentos'],
  ['granulad*', 'sal-condimentos'],

  // Ready-to-prepare mixes
  ['premezcla', 'harinas'],
  ['mezcla lista', 'harinas'],
  ['mezcla para', 'harinas'],

  // Powdered or prepared drinks: the form outranks the flavour
  ['bebida refrescante', 'jugos'],
  ['bebida en polvo', 'jugos'],
  ['refresco en polvo', 'jugos'],
  ['bebida hidratante', 'jugos'],
  ['bebida láctea', 'leche'],
  ['alimento lácteo', 'yogures'],

  // Instant soups and bases: the animal in the flavour is not the product
  ['ramen', 'sopas'],
  ['base para', 'sopas'],

  // Cold cuts: charcuterie outranks the animal. "Salchicha de pollo" is a
  // sausage, not chicken, and that is how all the ham was landing in Chicken.
  ['jamón', 'embutidos'],
  ['salchich*', 'embutidos'],
  ['chorizo', 'embutidos'],
  ['mortadela', 'embutidos'],
  ['tocineta', 'embutidos'],
  ['butifarra', 'embutidos'],
  ['salami', 'embutidos'],
  ['pepperoni', 'embutidos'],

  // Dressings and prepared sauces
  ['adobo', 'sal-condimentos'],
  ['puré de papa', 'sopas'],
  ['puré de', 'enlatados'],
  ['antipasto', 'enlatados'],
  ['barra nutritiva', 'cereales'],
  ['barra de cereal', 'cereales'],

  // A snack pack says so somewhere in the name: "Paquete pasabocas papas pollo"
  ['pasaboca*', 'snacks'],
])

/**
 * Keyword to category slug. ORDER MATTERS: the first match wins, so anything
 * specific must sit above the general rule that would otherwise swallow it.
 * "Leche de coco" is not milk; "leche condensada" is not milk either.
 */
const RULES: readonly (readonly [RegExp, string])[] = compile([
  // --- Traps first: names holding a word from another category ---
  // These outrank FORM_RULES through an explicit exception: milk powder IS
  // milk, though "en polvo" usually means seasoning.
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
  ['agua de panela', 'azucar-panela'],

  // --- Eggs: their own category, bought on their own ---
  ['huevo', 'huevos'],

  // --- Dairy, each kind apart ---
  // Stem: the source writes "yogur", "yogurt" and "yoghurt", and whole-word
  // matching only adds a plural, so "yogurt" never matched "yogur".
  ['yogur*', 'yogures'],
  ['yoghurt', 'yogures'],
  ['kumis', 'yogures'],
  ['avena en bolsa', 'yogures'],
  ['postre', 'yogures'],
  ['gelatina', 'dulces'],
  ['arequipe', 'dulces'],
  ['queso', 'quesos'],
  ['cuajada', 'quesos'],
  ['mantequilla', 'mantequilla'],
  ['margarina', 'mantequilla'],
  ['esparcible', 'mantequilla'],
  ['leche', 'leche'],

  // --- Babies, before any animal (explicit pet phrasings are in PET_RULES) ---
  ['mascota', 'mascotas'],
  ['fórmula infantil', 'bebes'],
  ['compota', 'bebes'],

  // --- Proteins ---
  // Turkey is not chicken, and a bare "pechuga" is: turkey goes first.
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

  // --- Pantry ---
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
  // Tinned fish above the oil it is packed in
  ['atún', 'enlatados'],
  ['sardina', 'enlatados'],
  ['aceite', 'aceites'],
  ['vinagre', 'aceites'],
  ['balsámic*', 'aceites'],
  ['oliva', 'aceites'],
  ['azucar', 'azucar-panela'],
  ['panela', 'azucar-panela'],
  ['endulzante', 'azucar-panela'],
  ['miel', 'azucar-panela'],
  ['aceituna', 'enlatados'],
  ['enteros pelados', 'enlatados'],
  // Sold in tins on the dry shelf; frozen and fresh ones are caught earlier
  ['maiz tierno', 'enlatados'],
  ['maiz dulce', 'enlatados'],
  ['mix de verdura', 'enlatados'],
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
  // Maize and starches
  ['maiz pira', 'snacks'],
  ['maiz trillado', 'granos'],
  ['fecula', 'harinas'],
  ['maizena', 'harinas'],
  ['avena', 'cereales'],
  ['cereal', 'cereales'],
  ['granola', 'cereales'],
  ['muesli', 'cereales'],
  // Spices: they used to land in "otros" and are seasonings
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

  // --- Bakery ---
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

  // --- Drinks, broken down ---
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

  // --- Other ---
  ['papas fritas', 'snacks'],
  ['pasabocas', 'snacks'],
  ['snack', 'snacks'],
  ['mani', 'snacks'],
  ['platanito*', 'snacks'],
  ['chicharron de*', 'snacks'],
  ['crispeta', 'snacks'],
  ['tostacos', 'snacks'],
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
  // Household and personal care are decided in NON_FOOD_RULES, before this.
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
  ['arandano', 'frutas'],
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
  ['aji', 'verduras'],
  ['verdura', 'verduras'],
])

/**
 * The fruit and vegetable aisle. There, produce is decided BEFORE the
 * ingredient rules: "Ají dulce" is a pepper, not a sweet, and nothing in a
 * generic word list knows that. Form rules still go first ("Tomate en lata").
 */
const FRESH_AISLE = 'frutas-verduras'

/**
 * Source buckets whose word is final, whatever the name says. Only buckets
 * with no human food in them belong here: "carnes" does not, because it holds
 * chicken, beef and fish that the name has to tell apart.
 *
 * "mascotas" is not perfectly homogeneous: Olímpica files a human cracker
 * ("GALLETA ROJO TAC X8 640G") in its pet aisle. It stays authoritative anyway,
 * on purpose. Overriding it needs a "human head noun and no pet word" test,
 * and pet treats routinely fail it — "Galletas Biscrok", "Snack cremoso
 * pollo" name neither the animal nor the aisle. The two errors do not cost the
 * same: a cracker hidden in Mascotas is a missing product, a dog biscuit shown
 * under Galletas is a false one (ING-008). The stray cracker is a source
 * error; if a product is listed in two aisles, the fix belongs where the
 * adapter picks the bucket, not here.
 */
const AUTHORITATIVE_SOURCES: ReadonlySet<string> = new Set(['mascotas'])

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
  // The pet aisle is authoritative. Everything the source files there is for
  // animals, but the names are full of human food words: "comida para perros
  // carne cerdo y pollo", "pulmon de cerdo", "pañal macho", "arena aroma cafe".
  // No word list keeps up with that; the aisle already answered the question.
  if (sourceCategory !== null && AUTHORITATIVE_SOURCES.has(sourceCategory)) {
    return SOURCE_FALLBACK[sourceCategory] ?? 'otros'
  }

  // Flavour and filling first: they poison every ingredient rule downstream.
  const haystack = ` ${stripModifiers(normalise(productName))} `

  // Layers, strongest first. Each one answers a question the next one cannot:
  //   who it is for      pets, then not-food-at-all
  //   closed aisle       cleaning and the freezer: the bucket decides
  //   frozen             the freezer outranks what is frozen
  //   named exceptions   milk powder is milk though "en polvo" is a seasoning
  //   head noun          "Galleta leche" is a cracker, not milk; the aisle
  //                      settles the nouns that mean two things ("Papa")
  //   form               "Tomate en lata" is tinned, not a tomato
  //   fresh produce      only in the produce aisle, and before the ingredients
  //   ingredient         the rest
  const notFood = firstMatch(PET_RULES, haystack) ?? firstMatch(NON_FOOD_RULES, haystack)
  if (notFood !== null) return notFood

  const closedAisle = sourceCategory === null ? undefined : CLOSED_AISLES[sourceCategory]
  if (closedAisle !== undefined && sourceCategory !== null) {
    return firstMatch(closedAisle, haystack) ?? SOURCE_FALLBACK[sourceCategory] ?? 'otros'
  }

  const head = firstMatch(HEAD_RULES, haystack)

  const decided =
    firstMatch(FROZEN_RULES, haystack) ??
    firstMatch(EXCEPTIONS, haystack) ??
    (head === null ? null : resolve(head, sourceCategory)) ??
    firstMatch(FORM_RULES, haystack) ??
    (sourceCategory === FRESH_AISLE ? earliestMatch(PRODUCE_RULES, haystack) : null) ??
    firstMatch(RULES, haystack) ??
    // With no aisle at all, a bare fruit name is still most likely the fruit.
    (sourceCategory === null ? earliestMatch(PRODUCE_RULES, haystack) : null)
  if (decided !== null) return decided

  if (sourceCategory !== null) {
    const fallback = SOURCE_FALLBACK[sourceCategory]
    if (fallback !== undefined) return fallback
  }

  return 'otros'
}
