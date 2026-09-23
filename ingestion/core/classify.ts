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
 * "Sabor a fresa" does not make something a strawberry, and "sabor a pollo"
 * does not make an instant soup chicken. The flavour phrase is stripped before
 * any ingredient rule runs, or every powdered drink lands in Fruits.
 */
const FLAVOUR_PHRASE = /\bsabor(?:es)?\s+(?:a|de)\s+\S+(?:\s\S+)?/g

function stripFlavour(text: string): string {
  return text.replace(FLAVOUR_PHRASE, ' ')
}

/**
 * FORM rules, applied BEFORE the ingredient ones.
 *
 * How a product is presented outranks what it is made of: a tomato in a tin is
 * tinned food, powdered onion is a seasoning, and strawberry jam is a spread.
 * Getting this backwards is what put drinks in Fruits and soup in Vegetables.
 */
const EXCEPTIONS: readonly (readonly [string, string])[] = [
  ['leche en polvo', 'leche'],
  ['leche deslactosada en polvo', 'leche'],
  ['crema de leche', 'leche'],
  ['chocolate en polvo', 'cafe-chocolate'],
  ['cafe en polvo', 'cafe-chocolate'],
  ['cafe molido', 'cafe-chocolate'],
  ['achocolatad', 'cafe-chocolate'],
  ['cocoa en polvo', 'cafe-chocolate'],
  ['panela pulverizada', 'azucar-panela'],
  ['azucar en polvo', 'azucar-panela'],
  ['gelatina en polvo', 'yogures'],
]

const FORM_RULES: readonly (readonly [string, string])[] = [
  // Untables
  ['mermelada', 'mermeladas'],
  ['jalea', 'mermeladas'],
  ['crema de avellana', 'mermeladas'],
  ['crema de mani', 'mermeladas'],

  // Sopas y caldos: "crema de tomate en sobre" es sopa, no tomate
  ['sopa', 'sopas'],
  ['crema de champi', 'sopas'],
  ['crema de pollo', 'sopas'],
  ['crema de tomate', 'sopas'],
  ['crema de espar', 'sopas'],
  ['crema de verdura', 'sopas'],
  ['crema de cebolla', 'sopas'],
  ['caldo', 'sopas'],
  ['consome', 'sopas'],
  ['cremita', 'sopas'],

  // Conservas: "tomate en lata" es enlatado, no verdura fresca
  ['en lata', 'enlatados'],
  ['enlatad', 'enlatados'],
  ['en conserva', 'enlatados'],
  ['encurtid', 'enlatados'],
  ['al natural en', 'enlatados'],

  // Deshidratados y molidos: son condimentos, no el vegetal fresco
  ['en polvo', 'sal-condimentos'],
  ['molido', 'sal-condimentos'],
  ['deshidratad', 'sal-condimentos'],
  ['granulad', 'sal-condimentos'],

  // Mezclas para preparar
  ['premezcla', 'harinas'],
  ['mezcla lista', 'harinas'],
  ['mezcla para', 'harinas'],

  // Bebidas en polvo o preparadas: la forma manda sobre el sabor
  ['bebida refrescante', 'jugos'],
  ['bebida en polvo', 'jugos'],
  ['refresco en polvo', 'jugos'],
  ['bebida hidratante', 'jugos'],
  ['bebida lactea', 'leche'],
]

/**
 * Keyword to category slug. ORDER MATTERS: the first match wins, so anything
 * specific must sit above the general rule that would otherwise swallow it.
 * "Leche de coco" is not milk; "leche condensada" is not milk either.
 */
const RULES: readonly (readonly [string, string])[] = [
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

  // --- Proteínas ---
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
  ['jamon', 'embutidos'],
  ['salchich', 'embutidos'],
  ['chorizo', 'embutidos'],
  ['mortadela', 'embutidos'],
  ['tocineta', 'embutidos'],
  ['butifarra', 'embutidos'],
  ['salchichon', 'embutidos'],
  ['carne', 'carnes'],
  ['res ', 'carnes'],
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
  ['aceite', 'aceites'],
  ['vinagre', 'aceites'],
  ['oliva', 'aceites'],
  ['azucar', 'azucar-panela'],
  ['panela', 'azucar-panela'],
  ['endulzante', 'azucar-panela'],
  ['miel', 'azucar-panela'],
  ['atun', 'enlatados'],
  ['sardina', 'enlatados'],
  ['enlatad', 'enlatados'],
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
  ['infusion', 'te-aromaticas'],
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
  ['color ', 'sal-condimentos'],
  ['sal ', 'sal-condimentos'],
  ['salsa', 'sal-condimentos'],
  ['mayonesa', 'sal-condimentos'],
  ['mostaza', 'sal-condimentos'],
  ['condimento', 'sal-condimentos'],
  ['aliño', 'sal-condimentos'],
  ['caldo', 'sal-condimentos'],
  ['sazonador', 'sal-condimentos'],

  // --- Panadería ---
  ['pan ', 'pan'],
  ['pan,', 'pan'],
  ['pandebono', 'pan'],
  ['buñuelo', 'pan'],
  ['arepa', 'arepas'],
  ['tortilla', 'arepas'],
  ['galleta', 'galletas'],
  ['ponque', 'galletas'],
  ['torta', 'galletas'],
  ['brownie', 'galletas'],
  ['wafer', 'galletas'],

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
  ['hit ', 'jugos'],
  ['te helado', 'jugos'],
  ['agua', 'agua'],
  ['cerveza', 'licores'],
  ['vino', 'licores'],
  ['aguardiente', 'licores'],
  ['ron ', 'licores'],
  ['whisky', 'licores'],
  ['tequila', 'licores'],

  // --- Frescos ---
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

  // --- Otros ---
  ['papas fritas', 'snacks'],
  ['pasabocas', 'snacks'],
  ['mani', 'snacks'],
  ['platanitos', 'snacks'],
  ['chicharron de', 'snacks'],
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
  ['congelad', 'congelados'],
  ['helado', 'congelados'],
]

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
  // Flavour first: it poisons every ingredient rule downstream.
  const haystack = ` ${stripFlavour(normalise(productName))} `

  // Explicit exceptions outrank even the form rules: milk powder IS milk,
  // though "en polvo" otherwise means seasoning.
  for (const [keyword, slug] of EXCEPTIONS) {
    if (haystack.includes(keyword)) return slug
  }

  // Form beats ingredient. "Crema de tomate en sobre" is soup, not a tomato.
  for (const [keyword, slug] of FORM_RULES) {
    if (haystack.includes(keyword)) return slug
  }

  for (const [keyword, slug] of RULES) {
    if (haystack.includes(keyword)) return slug
  }

  if (sourceCategory !== null) {
    const fallback = SOURCE_FALLBACK[sourceCategory]
    if (fallback !== undefined) return fallback
  }

  return 'otros'
}
