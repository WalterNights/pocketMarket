import { classifyProduct } from './classify'

describe('classifyProduct — lo que pidió el usuario', () => {
  it('los huevos son su propia categoría, no lácteos', () => {
    expect(classifyProduct('Huevos AA x 30', 'lacteos')).toBe('huevos')
    expect(classifyProduct('Huevos AAA rojos x 12', 'lacteos')).toBe('huevos')
    expect(classifyProduct('Huevos de codorniz x 12', 'lacteos')).toBe('huevos')
    expect(classifyProduct('Huevos corrientes', null)).toBe('huevos')
  })

  it('lácteos se reparten en leche, quesos y yogures', () => {
    expect(classifyProduct('Leche entera Alquería 1100 ml', 'lacteos')).toBe('leche')
    expect(classifyProduct('Queso campesino Alpina', 'lacteos')).toBe('quesos')
    expect(classifyProduct('Yogur griego natural', 'lacteos')).toBe('yogures')
    expect(classifyProduct('Mantequilla con sal', 'lacteos')).toBe('mantequilla')
  })

  it('las gaseosas no se mezclan con el resto de bebidas', () => {
    expect(classifyProduct('Gaseosa Coca Cola 350 ml', 'bebidas')).toBe('gaseosas')
    expect(classifyProduct('Pepsi 1.5 L', 'bebidas')).toBe('gaseosas')
    expect(classifyProduct('Colombiana 2 L', 'bebidas')).toBe('gaseosas')
    expect(classifyProduct('Jugo de naranja Hit', 'bebidas')).toBe('jugos')
    expect(classifyProduct('Agua Cristal 600 ml', 'bebidas')).toBe('agua')
    expect(classifyProduct('Cerveza Águila lata', 'bebidas')).toBe('licores')
  })

  it('las carnes se separan por animal', () => {
    expect(classifyProduct('Pechuga de pollo', 'carnes')).toBe('pollo')
    expect(classifyProduct('Carne de res molida', 'carnes')).toBe('carnes')
    expect(classifyProduct('Costilla de cerdo', 'carnes')).toBe('carnes')
    expect(classifyProduct('Filete de tilapia', 'carnes')).toBe('pescados')
    expect(classifyProduct('Jamón de cerdo', 'carnes')).toBe('embutidos')
  })
})

describe('classifyProduct — despensa desglosada', () => {
  it('separa lo que Éxito mete todo junto en "Despensa"', () => {
    expect(classifyProduct('Arroz blanco Diana 500 gr', 'viveres')).toBe('arroz')
    expect(classifyProduct('Lentejas Del Campo', 'viveres')).toBe('granos')
    expect(classifyProduct('Pastas Doria spaghetti', 'viveres')).toBe('pastas')
    expect(classifyProduct('Aceite de girasol Premier', 'viveres')).toBe('aceites')
    expect(classifyProduct('Azúcar Manuelita', 'viveres')).toBe('azucar-panela')
    expect(classifyProduct('Panela pulverizada', 'viveres')).toBe('azucar-panela')
    expect(classifyProduct('Lomitos de atún en agua', 'viveres')).toBe('enlatados')
    expect(classifyProduct('Harina de trigo Haz de Oros', 'viveres')).toBe('harinas')
    expect(classifyProduct('Café molido Sello Rojo', 'viveres')).toBe('cafe-chocolate')
    expect(classifyProduct('Avena en hojuelas Quaker', 'viveres')).toBe('cereales')
  })
})

describe('classifyProduct — trampas', () => {
  // Estos son los que un clasificador ingenuo manda a la categoría equivocada.
  it('la leche de coco no es leche', () => {
    expect(classifyProduct('Leche de coco 400 ml', 'viveres')).toBe('enlatados')
  })

  it('la leche condensada tampoco', () => {
    expect(classifyProduct('Leche condensada La Lechera', 'viveres')).toBe('enlatados')
  })

  it('pero la leche en polvo sí es leche', () => {
    expect(classifyProduct('Leche en polvo Klim', 'lacteos')).toBe('leche')
  })

  it('el arroz con leche es un postre, no arroz', () => {
    expect(classifyProduct('Arroz con leche listo', 'viveres')).toBe('cereales')
  })

  it('la harina de arroz es harina', () => {
    expect(classifyProduct('Harina de arroz', 'viveres')).toBe('harinas')
  })

  it('el agua de panela no es agua', () => {
    expect(classifyProduct('Agua de panela con limón', 'bebidas')).toBe('azucar-panela')
  })
})

describe('classifyProduct — lo que caia en "otros"', () => {
  it('las especias son condimentos', () => {
    expect(classifyProduct('Pimienta molida', 'viveres')).toBe('sal-condimentos')
    expect(classifyProduct('Canela en astilla', 'viveres')).toBe('sal-condimentos')
    expect(classifyProduct('Orégano puro', 'viveres')).toBe('sal-condimentos')
    expect(classifyProduct('Cúrcuma pura', 'viveres')).toBe('sal-condimentos')
    expect(classifyProduct('Finas hierbas mezcla de especias', 'viveres')).toBe('sal-condimentos')
  })

  it('las aromáticas y el té tienen su propia categoría', () => {
    expect(classifyProduct('Aromática yerbabuena', 'bebidas')).toBe('te-aromaticas')
    expect(classifyProduct('Aromática manzanilla', 'bebidas')).toBe('te-aromaticas')
    expect(classifyProduct('Té negro original', 'bebidas')).toBe('te-aromaticas')
  })

  it('el chocolate de mesa va con el café', () => {
    expect(classifyProduct('Chocolate de mesa tradicional', 'viveres')).toBe('cafe-chocolate')
    expect(classifyProduct('Bebida achocolatada en polvo', 'bebidas')).toBe('cafe-chocolate')
  })

  it('distingue los tipos de maíz', () => {
    expect(classifyProduct('Maíz pira', 'viveres')).toBe('snacks')
    expect(classifyProduct('Maíz trillado amarillo', 'viveres')).toBe('granos')
    expect(classifyProduct('Fécula de maíz', 'viveres')).toBe('harinas')
  })
})

describe('classifyProduct — la forma manda sobre el ingrediente', () => {
  // Casos reales vistos en la app: el clasificador miraba el ingrediente y
  // metia bebidas en Frutas y sopas en Verduras.

  it('"sabor a X" no convierte el producto en X', () => {
    expect(classifyProduct('Bebida refrescante sin calorías sabor a fresa', 'bebidas')).toBe(
      'jugos',
    )
    expect(classifyProduct('Bebida refrescante sin calorías sabor a mandarina', 'bebidas')).toBe(
      'jugos',
    )
    expect(classifyProduct('Sopa instantánea sabor a pollo', 'viveres')).toBe('sopas')
    expect(classifyProduct('Gelatina sabor a mora', 'viveres')).toBe('yogures')
  })

  it('las mermeladas son untables, no fruta', () => {
    expect(classifyProduct('Mermelada de fresa', 'viveres')).toBe('mermeladas')
    expect(classifyProduct('Mermelada de mora', 'viveres')).toBe('mermeladas')
  })

  it('las cremas en sobre son sopa, no el vegetal', () => {
    expect(classifyProduct('Crema de tomate en sobre', 'viveres')).toBe('sopas')
    expect(classifyProduct('Crema de pollo y champiñones', 'viveres')).toBe('sopas')
    expect(classifyProduct('Caldo de gallina en cubos', 'viveres')).toBe('sopas')
  })

  it('lo deshidratado o molido es condimento, no verdura fresca', () => {
    expect(classifyProduct('Cebolla en polvo', 'viveres')).toBe('sal-condimentos')
    expect(classifyProduct('Paprika pimentón molido', 'viveres')).toBe('sal-condimentos')
    expect(classifyProduct('Cilantro deshidratado', 'viveres')).toBe('sal-condimentos')
  })

  it('lo enlatado es conserva, no producto fresco', () => {
    expect(classifyProduct('Tomate en lata', 'viveres')).toBe('enlatados')
    expect(classifyProduct('Duraznos en conserva', 'viveres')).toBe('enlatados')
  })

  it('las premezclas son harinas', () => {
    expect(classifyProduct('Premezcla pandeyuca', 'viveres')).toBe('harinas')
  })

  it('pero las excepciones ganan a la regla de forma', () => {
    // "en polvo" normalmente es condimento; la leche en polvo sigue siendo leche.
    expect(classifyProduct('Leche en polvo Klim', 'lacteos')).toBe('leche')
    expect(classifyProduct('Chocolate en polvo', 'viveres')).toBe('cafe-chocolate')
    expect(classifyProduct('Café molido Sello Rojo', 'viveres')).toBe('cafe-chocolate')
    expect(classifyProduct('Panela pulverizada', 'viveres')).toBe('azucar-panela')
  })

  it('la fruta de verdad sigue siendo fruta', () => {
    expect(classifyProduct('Fresa fresca', 'frutas-verduras')).toBe('frutas')
    expect(classifyProduct('Mora de castilla', 'frutas-verduras')).toBe('frutas')
    expect(classifyProduct('Cebolla cabezona blanca', 'frutas-verduras')).toBe('verduras')
    expect(classifyProduct('Tomate chonto', 'frutas-verduras')).toBe('verduras')
  })
})

describe('classifyProduct — la fruta solo cuenta donde se vende fruta', () => {
  // Nombres reales de la corrida del 2026-09-23. Todos caian en Frutas o
  // Verduras por mencionar una fruta que no es el producto.

  it('un postre con nombre de fruta no es fruta', () => {
    expect(classifyProduct('Barquillo Deleite Pie De Limón', 'viveres')).toBe('galletas')
    expect(classifyProduct('HELADO FRESA SOBRE 82 gr', 'congelados')).toBe('congelados')
    expect(classifyProduct('Alimento lácteo fresa y melocotón x6und', 'lacteos')).toBe('yogures')
  })

  it('ni un aderezo, ni un snack, ni una aromatica', () => {
    expect(classifyProduct('Reduccion Balsamico Manzana 180 ml', 'viveres')).toBe('aceites')
    expect(classifyProduct('Chile Con Limón', 'viveres')).toBe('sal-condimentos')
    expect(classifyProduct('Té limón', 'bebidas')).toBe('te-aromaticas')
    expect(classifyProduct('Barra nutritiva maracuyá uchuva', 'viveres')).toBe('cereales')
  })

  it('el tomate de la despensa es conserva o salsa, no verdura', () => {
    expect(classifyProduct('Tomates Enteros Pelados 240 gr', 'viveres')).toBe('enlatados')
    expect(classifyProduct('Puré de tomates natural', 'viveres')).toBe('enlatados')
    expect(classifyProduct('Aceitunas rellenas con pimentón', 'viveres')).toBe('enlatados')
    expect(classifyProduct('Snacks Tomate', 'viveres')).toBe('snacks')
    expect(classifyProduct('Adobo cebolla y ajo', 'viveres')).toBe('sal-condimentos')
  })

  it('las papas fritas son pasabocas, no papa', () => {
    expect(classifyProduct('Papas fritas naturales', 'viveres')).toBe('snacks')
  })

  it('pero en el pasillo de frutas y verduras la regla vuelve a aplicar', () => {
    expect(classifyProduct('Tomate chonto', 'frutas-verduras')).toBe('verduras')
    expect(classifyProduct('Papa criolla lavada', 'frutas-verduras')).toBe('verduras')
    expect(classifyProduct('Limón Tahití', 'frutas-verduras')).toBe('frutas')
    expect(classifyProduct('Piña gold', 'frutas-verduras')).toBe('frutas')
  })
})

describe('classifyProduct — la charcuteria manda sobre el animal', () => {
  // Pollo tenia 17 productos y ninguno era pollo: era todo jamon y salchicha.

  it('el embutido de pollo es embutido', () => {
    expect(classifyProduct('Jamón de pollo', 'carnes')).toBe('embutidos')
    expect(classifyProduct('Salchicha de pollo x30und', 'carnes')).toBe('embutidos')
    expect(classifyProduct('Salchichón de pollo en barra', 'carnes')).toBe('embutidos')
    expect(classifyProduct('Mortadela de pollo porcionada', 'carnes')).toBe('embutidos')
    expect(classifyProduct('Chorizo mixto pollo y cerdo', 'carnes')).toBe('embutidos')
  })

  it('el pollo de verdad sigue siendo pollo', () => {
    expect(classifyProduct('Pechuga de pollo fresca', 'carnes')).toBe('pollo')
    expect(classifyProduct('Muslo de pollo bandeja', 'carnes')).toBe('pollo')
  })

  it('"sabor pollo" sin conector tambien se descarta', () => {
    expect(classifyProduct('Ramen sabor pollo picante', 'viveres')).toBe('sopas')
    expect(classifyProduct('Pastas sabor pollo picante vaso', 'viveres')).toBe('pastas')
    expect(classifyProduct('Base para pollo pollo champiñones', 'viveres')).toBe('sopas')
  })

  it('el relleno tampoco define el producto', () => {
    expect(classifyProduct('Pastas ravioli rellenos de pollo', 'viveres')).toBe('pastas')
  })
})

describe('classifyProduct — la fruta se nombra en palabras enteras', () => {
  // Nombres reales: la subcadena colaba tres verduras en Frutas.

  it('una palabra que CONTIENE una fruta no es esa fruta', () => {
    expect(classifyProduct('Lechuga Morada Crespa Pet 130 gr', 'frutas-verduras')).toBe('verduras')
    expect(classifyProduct('ESPINACA BOGOTANA ORGAN 130 gr', 'frutas-verduras')).toBe('verduras')
    expect(classifyProduct('LIMONARIA BOLSA 50 gr', 'frutas-verduras')).toBe('te-aromaticas')
  })

  it('la papaya no es papa', () => {
    expect(classifyProduct('Papaya hawaiana', 'frutas-verduras')).toBe('frutas')
    expect(classifyProduct('Papa criolla lavada', 'frutas-verduras')).toBe('verduras')
  })

  it('pero el plural si cuenta', () => {
    expect(classifyProduct('3 x Peras', 'frutas-verduras')).toBe('frutas')
    expect(classifyProduct('6 x Limon Tahiti', 'frutas-verduras')).toBe('frutas')
    expect(classifyProduct('Tomates chonto', 'frutas-verduras')).toBe('verduras')
  })
})

describe('classifyProduct — Pollo no es todo lo que suene a pollo', () => {
  it('el repollo es una verdura', () => {
    expect(classifyProduct('Repollo Blanco 1 und', 'frutas-verduras')).toBe('verduras')
  })

  it('el pavo no es pollo', () => {
    expect(classifyProduct('Pechuga De Pavo', 'carnes')).toBe('carnes')
    expect(classifyProduct('Pavo En Pechuga Natural', 'carnes')).toBe('carnes')
  })

  it('la comida de mascota gana al animal del sabor', () => {
    expect(classifyProduct('Alimento gatos Casserole Pavo Pollo', 'mascotas')).toBe('mascotas')
    expect(classifyProduct('Alimento para perros sabor a pollo', 'mascotas')).toBe('mascotas')
  })
})

describe('classifyProduct — el pasillo de mascotas manda', () => {
  // Real names from the Éxito pet aisle that were landing in human aisles.
  it('la comida de perro y gato no es pollo, aunque no diga "sabor"', () => {
    expect(classifyProduct('Comida para perros adultos carne cerdo y pollo', 'mascotas')).toBe(
      'mascotas',
    )
    expect(classifyProduct('Comida Húmeda Para Gato Adulto Bon Appetita Pollo', 'mascotas')).toBe(
      'mascotas',
    )
    expect(classifyProduct('Snack cremoso pollo x4und', 'mascotas')).toBe('mascotas')
  })

  it('tampoco es carne, pescado, condimento ni pañal de bebé', () => {
    expect(classifyProduct('Pulmón De Cerdo X Kilo', 'mascotas')).toBe('mascotas')
    expect(classifyProduct('Comida para gatos pate salmón', 'mascotas')).toBe('mascotas')
    expect(
      classifyProduct('Alitas De Pollo Naturales Y Deshidratadas Para Perros', 'mascotas'),
    ).toBe('mascotas')
    expect(classifyProduct('Pañal Macho Talla M Paquete Por 24 Und', 'mascotas')).toBe('mascotas')
    expect(classifyProduct('Arena 25 Kg Aroma Cafe', 'mascotas')).toBe('mascotas')
  })

  it('sin pasillo, el nombre basta si dice para quién es', () => {
    expect(classifyProduct('Comida para perro sabor pollo', null)).toBe('mascotas')
    expect(classifyProduct('Comida para perros adultos y cachorros carne pollo', null)).toBe(
      'mascotas',
    )
    expect(classifyProduct('Galletas para perros bocaditos con verduras', null)).toBe('mascotas')
  })

  it('el perro caliente sigue siendo comida de personas', () => {
    expect(classifyProduct('Salchicha súper perro x8und', 'lacteos')).toBe('embutidos')
    expect(classifyProduct('Pan perro x6und', 'panaderia')).toBe('pan')
  })
})

describe('classifyProduct — respaldo', () => {
  it('cae a la categoría de origen cuando el nombre no dice nada', () => {
    expect(classifyProduct('Producto raro XYZ', 'mascotas')).toBe('mascotas')
    expect(classifyProduct('Producto raro XYZ', 'congelados')).toBe('congelados')
    expect(classifyProduct('Producto raro XYZ', 'lacteos')).toBe('leche')
  })

  it('nunca devuelve vacío: sin nada reconocible va a "otros"', () => {
    expect(classifyProduct('Producto raro XYZ', null)).toBe('otros')
    expect(classifyProduct('', null)).toBe('otros')
    expect(classifyProduct('Producto raro XYZ', 'categoria-inventada')).toBe('otros')
  })

  it('ignora tildes y mayúsculas', () => {
    expect(classifyProduct('PLÁTANO maduro', null)).toBe('frutas')
    expect(classifyProduct('platano maduro', null)).toBe('frutas')
    expect(classifyProduct('Café MOLIDO', null)).toBe('cafe-chocolate')
  })
})
