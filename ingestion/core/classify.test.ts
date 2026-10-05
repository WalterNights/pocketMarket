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
    expect(classifyProduct('Gelatina sabor a mora', 'viveres')).toBe('dulces')
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

describe('classifyProduct — lo que no se come va primero', () => {
  // Nombres reales de D1, Olímpica y Supermú: el aroma o el ingrediente activo
  // del producto de aseo caía en una regla de comida.
  it('el blanqueador "ropa color" no es el condimento Color', () => {
    expect(classifyProduct('Blanqueador Clorox ropa color', 'aseo-hogar')).toBe('aseo-hogar')
    expect(classifyProduct('Blancox R/COLOR', null)).toBe('aseo-hogar')
  })

  it('el aroma, el vinagre o la avena no convierten el aseo en comida', () => {
    expect(classifyProduct('Ambient Glade aero manz/canela', null)).toBe('aseo-hogar')
    expect(classifyProduct('Limpiador Blancox vinagre', null)).toBe('aseo-hogar')
    expect(classifyProduct('Lavaloza crema avena', null)).toBe('aseo-hogar')
  })

  it('"en polvo" no hace condimento al detergente', () => {
    expect(classifyProduct('Detergente en Polvo', 'viveres')).toBe('aseo-hogar')
  })
})

describe('classifyProduct — el primer sustantivo dice qué es', () => {
  // "Galleta leche" es una galleta que sabe a leche. Cada ingrediente que venía
  // detrás ganaba por estar más arriba en la tabla.
  it('la panadería no es el ingrediente que la acompaña', () => {
    expect(classifyProduct('Galleta saltinas mantequilla', 'viveres')).toBe('galletas')
    expect(classifyProduct('Galleta Leche', 'viveres')).toBe('galletas')
    expect(classifyProduct('Galleta Miel', 'viveres')).toBe('galletas')
    expect(classifyProduct('Pan Tajado Mantequilla', 'panaderia')).toBe('pan')
    expect(classifyProduct('Panecillo Mantequilla', 'panaderia')).toBe('pan')
    expect(classifyProduct('Pan Francés con Ajo y Queso', 'panaderia')).toBe('pan')
    expect(classifyProduct('Tostada arroz integral', 'viveres')).toBe('pan')
    expect(classifyProduct('Arepa de Queso', 'viveres')).toBe('arepas')
    expect(classifyProduct('Arepa Maíz Margarina', 'viveres')).toBe('arepas')
  })

  it('los cereales con sabor siguen siendo cereal', () => {
    expect(classifyProduct('Hojuelas Azucaradas', 'viveres')).toBe('cereales')
    expect(classifyProduct('Aros Frutales', 'viveres')).toBe('cereales')
    expect(classifyProduct('Cereal Chocolate', 'viveres')).toBe('cereales')
    expect(classifyProduct('Cereal Infantil Trigo Miel', 'viveres')).toBe('cereales')
  })

  it('los pasabocas no son su sabor', () => {
    expect(classifyProduct('Palito de queso', 'viveres')).toBe('snacks')
    expect(classifyProduct('Maní Sal', 'viveres')).toBe('snacks')
    expect(classifyProduct('Pasabocas Papas Pollo', 'viveres')).toBe('snacks')
    expect(classifyProduct('Doritos Mega Queso', 'viveres')).toBe('snacks')
    expect(classifyProduct('Rosquitas Queso', 'viveres')).toBe('snacks')
    expect(classifyProduct('Almendra', 'viveres')).toBe('snacks')
    expect(classifyProduct('Marañón', 'viveres')).toBe('snacks')
    expect(classifyProduct('Uvas pasas', 'frutas-verduras')).toBe('snacks')
    expect(classifyProduct('Nachos', 'viveres')).toBe('snacks')
  })

  it('las salsas son salsa, sea de carne o de soya', () => {
    expect(classifyProduct('Salsa carne Fruco', 'viveres')).toBe('sal-condimentos')
    expect(classifyProduct('Salsa Aderezos carnes', 'viveres')).toBe('sal-condimentos')
    expect(classifyProduct('Salsa para Carnes', 'viveres')).toBe('sal-condimentos')
    expect(classifyProduct('Salsa soya', 'viveres')).toBe('sal-condimentos')
    expect(classifyProduct('Salsa de Soya', 'viveres')).toBe('sal-condimentos')
  })

  it('el aceite y el vinagre no son la semilla ni el grano', () => {
    expect(classifyProduct('Aceite de Soya', 'viveres')).toBe('aceites')
    expect(classifyProduct('Vinagre de arroz', 'viveres')).toBe('aceites')
  })

  it('el atún y las conservas no son el aceite, el lomo ni el pescado fresco', () => {
    expect(classifyProduct('Atún en Aceite', 'viveres')).toBe('enlatados')
    expect(classifyProduct('ATÚN ACEITE DE OLIVA', 'viveres')).toBe('enlatados')
    expect(classifyProduct('Atún lomitos aceite', 'viveres')).toBe('enlatados')
    expect(classifyProduct('ATUN LOMO E/AGUA', 'viveres')).toBe('enlatados')
    expect(classifyProduct('CONSERVA DE PESCADO', 'viveres')).toBe('enlatados')
    expect(classifyProduct('Lomitos de atún en aceite', 'viveres')).toBe('enlatados')
  })

  it('la pasta se reconoce por su forma, también mal escrita', () => {
    expect(classifyProduct('Fettuccine', 'viveres')).toBe('pastas')
    expect(classifyProduct('Penne rigate', 'viveres')).toBe('pastas')
    expect(classifyProduct('FUSILLI', 'viveres')).toBe('pastas')
    expect(classifyProduct('Conchas', 'viveres')).toBe('pastas')
    expect(classifyProduct('Cabello de Ángel', 'viveres')).toBe('pastas')
    expect(classifyProduct('Spaguetti', 'viveres')).toBe('pastas')
    expect(classifyProduct('Macarron con Salsa de Queso', 'viveres')).toBe('pastas')
  })

  it('pero la pasta de tomate es salsa, no pasta', () => {
    expect(classifyProduct('Pasta de Tomate', 'viveres')).toBe('sal-condimentos')
  })

  it('el yogurt con t, la gaseosa sin azúcar y el jugo de limón', () => {
    expect(classifyProduct('Yogurt Griego', 'lacteos')).toBe('yogures')
    expect(classifyProduct('Bonyurt', 'lacteos')).toBe('yogures')
    expect(classifyProduct('Gaseosa sin Azúcar', 'bebidas')).toBe('gaseosas')
    expect(classifyProduct('Soda', 'bebidas')).toBe('gaseosas')
    expect(classifyProduct('Jugo de Limón Tahití', 'bebidas')).toBe('jugos')
  })

  it('el café tostado y molido es café, no condimento', () => {
    expect(classifyProduct('Café Tostado/Molido', 'viveres')).toBe('cafe-chocolate')
  })

  it('los dulces no son el lácteo del que están hechos', () => {
    expect(classifyProduct('Bocadillo con leche', 'viveres')).toBe('dulces')
    expect(classifyProduct('Dulce arequipe', 'viveres')).toBe('dulces')
    expect(classifyProduct('Salsa arequipe', 'viveres')).toBe('dulces')
    expect(classifyProduct('Cocada', 'viveres')).toBe('dulces')
    expect(classifyProduct('Halls tubo', 'viveres')).toBe('dulces')
    expect(classifyProduct('Gelatina fresa', 'viveres')).toBe('dulces')
  })
})

describe('classifyProduct — formas y palabras que faltaban', () => {
  it('lo congelado va al congelador, sea maíz, queso o empanada', () => {
    expect(classifyProduct('Maíz Dulce Congelado', 'viveres')).toBe('congelados')
    expect(classifyProduct('Palitos de queso congelados', 'viveres')).toBe('congelados')
    expect(classifyProduct('Deditos de Queso', 'viveres')).toBe('congelados')
    expect(classifyProduct('Empanadas de Queso', 'viveres')).toBe('congelados')
    expect(classifyProduct('Empanada con Carne', 'viveres')).toBe('congelados')
  })

  it('el maíz tierno, el chile con carne y la mezcla de verduras son conserva', () => {
    expect(classifyProduct('Maíz Tierno', 'viveres')).toBe('enlatados')
    expect(classifyProduct('Chile con Carne', 'viveres')).toBe('enlatados')
    expect(classifyProduct('Mix de Verduras', 'viveres')).toBe('enlatados')
  })

  it('las cremas de sobre son sopa aunque no digan "de"', () => {
    expect(classifyProduct('Crema sopera pollo', 'viveres')).toBe('sopas')
    expect(classifyProduct('Crema Pollo Champiñones', 'viveres')).toBe('sopas')
  })

  it('la bebida de almendras es leche; la almendra suelta, pasabocas', () => {
    expect(classifyProduct('Bebida almendrola sin azúcar', 'bebidas')).toBe('leche')
    expect(classifyProduct('Bebida de almendras', 'bebidas')).toBe('leche')
  })

  it('el esparcible es mantequilla y el pepperoni, embutido', () => {
    expect(classifyProduct('Esparcible', 'lacteos')).toBe('mantequilla')
    expect(classifyProduct('Barra Esparcible', 'lacteos')).toBe('mantequilla')
    expect(classifyProduct('Pepperoni tajado', 'carnes')).toBe('embutidos')
  })
})

describe('classifyProduct — en el pasillo de frescos manda el producto fresco', () => {
  it('el ají dulce es un ají y el tomate pera es un tomate', () => {
    expect(classifyProduct('Ají Dulce', 'frutas-verduras')).toBe('verduras')
    expect(classifyProduct('Tomate Pera', 'frutas-verduras')).toBe('verduras')
    expect(classifyProduct('Arándanos 125 g', 'frutas-verduras')).toBe('frutas')
    expect(classifyProduct('Mix de Verduras', 'frutas-verduras')).toBe('verduras')
  })

  it('fuera del pasillo, el mismo nombre no se lee como fresco', () => {
    expect(classifyProduct('Ají Dulce', 'viveres')).toBe('dulces')
  })
})

describe('classifyProduct — perros de verdad y perros calientes', () => {
  it('"ALIM PERRO" es alimento para perro aunque venga abreviado', () => {
    expect(classifyProduct('ALIM PERRO ADULT CARN&CEREAL 2KG', null)).toBe('mascotas')
    expect(classifyProduct('ALIM PERRO ADULT CARN&CEREAL 2KG', 'viveres')).toBe('mascotas')
  })

  it('el combo de perro caliente es comida de personas', () => {
    expect(classifyProduct('Combo Perro Caliente + Bebida', null)).toBe('otros')
    expect(classifyProduct('Pan perro caliente x6', 'panaderia')).toBe('pan')
  })

  it('el pasillo de mascotas sigue mandando, aunque cuele una galleta de personas', () => {
    // Decisión documentada en AUTHORITATIVE_SOURCES: el error caro es el inverso.
    expect(classifyProduct('GALLETA ROJO TAC X8 640G', 'mascotas')).toBe('mascotas')
    expect(classifyProduct('Galletas biscrok', 'mascotas')).toBe('mascotas')
    expect(classifyProduct('Comida para perros adultos carne cerdo y pollo', 'mascotas')).toBe(
      'mascotas',
    )
    // Fuera de ese pasillo, la misma galleta es galleta.
    expect(classifyProduct('GALLETA ROJO TAC X8 640G', 'viveres')).toBe('galletas')
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

describe('classifyProduct — raíces y sustantivos demasiado anchos', () => {
  it('la leche "ambiente" no es un ambientador', () => {
    expect(classifyProduct('Leche larga vida ambiente', 'lacteos')).toBe('leche')
    expect(classifyProduct('Ambientador Glade lavanda', null)).toBe('aseo-hogar')
    expect(classifyProduct('Ambientadores en aerosol', null)).toBe('aseo-hogar')
    expect(classifyProduct('Ambient Glade aero manz/canela', null)).toBe('aseo-hogar')
  })

  it('los aros de cebolla no son cereal', () => {
    expect(classifyProduct('Aros de cebolla', 'viveres')).toBe('snacks')
    expect(classifyProduct('Aros de cebolla congelados', 'viveres')).toBe('congelados')
    expect(classifyProduct('Aros Frutales', 'viveres')).toBe('cereales')
  })

  it('los palitos de pescado van al congelador', () => {
    expect(classifyProduct('Palitos de pescado apanados', 'viveres')).toBe('congelados')
    expect(classifyProduct('Palito de queso', 'viveres')).toBe('snacks')
  })

  it('la soda cáustica no se bebe', () => {
    expect(classifyProduct('Soda caustica', 'viveres')).toBe('aseo-hogar')
    expect(classifyProduct('Soda Cáustica en escamas', null)).toBe('aseo-hogar')
    expect(classifyProduct('Soda', 'bebidas')).toBe('gaseosas')
  })

  it('una "concha de" algo no es pasta', () => {
    expect(classifyProduct('Concha de coco', 'viveres')).not.toBe('pastas')
    expect(classifyProduct('Conchas', 'viveres')).toBe('pastas')
    expect(classifyProduct('Conchas Doria', 'viveres')).toBe('pastas')
  })

  it('la pasta de ajo es un condimento', () => {
    expect(classifyProduct('Pasta de ajo', 'viveres')).toBe('sal-condimentos')
    expect(classifyProduct('Pasta de Tomate', 'viveres')).toBe('sal-condimentos')
    expect(classifyProduct('Pasta spaghetti', 'viveres')).toBe('pastas')
  })
})

describe('classifyProduct — pasillos cerrados: el pasillo decide', () => {
  it('en el congelador, el sustantivo de pasabocas no gana', () => {
    expect(classifyProduct('Palito de queso', 'congelados')).toBe('congelados')
    expect(classifyProduct('Palito Queso Para Freir 345 gr', 'congelados')).toBe('congelados')
    expect(classifyProduct('Palitos Zenú Pollo Apanado 330 G', 'congelados')).toBe('congelados')
    expect(classifyProduct('Palitos Salchicha 540 gr', 'congelados')).toBe('congelados')
    expect(classifyProduct('Pasabocas integrales', 'congelados')).toBe('congelados')
  })

  it('lo congelado no se reparte por ingrediente', () => {
    expect(classifyProduct('RAVIOLIS DE POLLO 500 gr', 'congelados')).toBe('congelados')
    expect(classifyProduct('Nuggets De Pollo Zenú Apanado 320 G', 'congelados')).toBe('congelados')
    expect(classifyProduct('Lasaña con carne', 'congelados')).toBe('congelados')
    expect(classifyProduct('DEDITO DE QUESO X 22UND 420 gr', 'congelados')).toBe('congelados')
    expect(classifyProduct('Pandebono x12und', 'congelados')).toBe('congelados')
    expect(classifyProduct('Pasta De Hojaldre 390 gr', 'congelados')).toBe('congelados')
  })

  it('las arepas salen del congelador a su pasillo', () => {
    expect(classifyProduct('Arepa de maiz casera', 'congelados')).toBe('arepas')
    expect(classifyProduct('Arepitas de queso 20u 500g', 'congelados')).toBe('arepas')
    expect(classifyProduct('Tortilla de arroz integ', 'congelados')).toBe('arepas')
  })

  it('en aseo no hay comida, diga lo que diga el nombre', () => {
    expect(classifyProduct('Ropa Color 1000 Ml', 'aseo-hogar')).toBe('aseo-hogar')
    expect(classifyProduct('Velas colores surtidos', 'aseo-hogar')).toBe('aseo-hogar')
    expect(classifyProduct('Quitamanchas en polvo', 'aseo-hogar')).toBe('aseo-hogar')
    expect(classifyProduct('Balde Plegable Resistente Para Agua Ropa O Aseo', 'aseo-hogar')).toBe(
      'aseo-hogar',
    )
    expect(classifyProduct('Vinagre de Limpieza 1 L', 'aseo-hogar')).toBe('aseo-hogar')
    expect(classifyProduct('Betún en Pasta 30 G', 'aseo-hogar')).toBe('aseo-hogar')
    expect(classifyProduct('Copa de Vino Acme de Cristal X12 Unds', 'aseo-hogar')).toBe(
      'aseo-hogar',
    )
    expect(classifyProduct('Limpia baños concentrado', 'aseo-hogar')).toBe('aseo-hogar')
  })

  it('mascotas y cuidado personal siguen mandando sobre el pasillo cerrado', () => {
    expect(classifyProduct('Shampoo para perros', 'aseo-hogar')).toBe('mascotas')
    expect(classifyProduct('Shampoo anticaspa', 'aseo-hogar')).toBe('cuidado-personal')
    expect(classifyProduct('Ambientador paraiso azul', 'congelados')).toBe('aseo-hogar')
  })

  it('fuera de esos pasillos, las mismas palabras siguen siendo comida', () => {
    expect(classifyProduct('Vinagre blanco', 'viveres')).toBe('aceites')
    expect(classifyProduct('Color La Abuela', 'viveres')).toBe('sal-condimentos')
    expect(classifyProduct('Pechuga de pollo', 'carnes')).toBe('pollo')
  })
})

describe('classifyProduct — el helado es helado, sepa a lo que sepa', () => {
  it('el sabor no decide el pasillo', () => {
    expect(classifyProduct('Helado chocolate', 'otros')).toBe('congelados')
    expect(classifyProduct('Helado vainilla y caramelo', 'panaderia')).toBe('congelados')
    expect(classifyProduct('Helado Tradicional Ron Con Pasas x 600G', 'otros')).toBe('congelados')
    expect(classifyProduct('Helado 100% Vainilla Sin Azucar 300G', 'panaderia')).toBe('congelados')
    expect(classifyProduct('HELADO DE YOGURT CON SALSA DE MORA', 'lacteos')).toBe('congelados')
    expect(classifyProduct('Helado con salsa de arequipe y coco', null)).toBe('congelados')
  })

  it('tampoco cuando el helado no abre el nombre', () => {
    expect(classifyProduct('Torta de helado', 'panaderia')).toBe('congelados')
    expect(classifyProduct('Galleta Con Helado Crem Helado Arequipe 65G', 'otros')).toBe(
      'congelados',
    )
    expect(classifyProduct('HELAD CREM HEL CONO BOCATTO FRESA NG 93G', 'panaderia')).toBe(
      'congelados',
    )
    expect(classifyProduct('Cono de Vainilla Külfi 90 G', 'lacteos')).toBe('congelados')
  })

  it('el té helado se bebe', () => {
    expect(classifyProduct('Té Helado Limón 500 Ml', 'bebidas')).toBe('jugos')
    expect(classifyProduct('Te helado mandarina', 'viveres')).toBe('jugos')
    expect(classifyProduct('Té Helado Manzana Limonaria 400 Ml', 'bebidas')).toBe('jugos')
    expect(classifyProduct('Té Helado Fusión de Frutas en Polvo 20 G', 'bebidas')).toBe('jugos')
  })

  it('ni la mezcla para prepararlo ni la menta helada son helado', () => {
    expect(classifyProduct('Mezcla para Preparar Helado de Fresa 82 G', 'panaderia')).toBe(
      'harinas',
    )
    expect(classifyProduct('Caramelos menta helada', 'otros')).toBe('dulces')
  })

  it('la paleta es de hielo, salvo la de cerdo y la de caramelo', () => {
    expect(classifyProduct('PALETA PIÑA 75G', 'panaderia')).toBe('congelados')
    expect(classifyProduct('Paleta Mandarina Agua 110G', 'otros')).toBe('congelados')
    expect(classifyProduct('Paleta vainilla y chocolate', null)).toBe('congelados')
    expect(classifyProduct('Paleta de cerdo x kilo', 'carnes')).toBe('carnes')
    expect(classifyProduct('Paleta de res', null)).toBe('carnes')
    expect(classifyProduct('PALETA CARAM SANDIA 24G', 'otros')).toBe('dulces')
    expect(classifyProduct('Paletas caramelo cereza chile', 'otros')).toBe('dulces')
    expect(classifyProduct('PALETA CARAMELO CROCANTE 80G', 'panaderia')).toBe('congelados')
  })
})

describe('classifyProduct — sustantivos que el pasillo desempata', () => {
  it('la papa es verdura en frescos y paquete en pasabocas', () => {
    expect(classifyProduct('Papa Pastusa 2,5 Kg', 'frutas-verduras')).toBe('verduras')
    expect(classifyProduct('Papa criolla', null)).toBe('verduras')
    expect(classifyProduct('Papas pollo', 'otros')).toBe('snacks')
    expect(classifyProduct('Papas de pollo', 'otros')).toBe('snacks')
    expect(classifyProduct('Papas receta clásica sal marina', 'otros')).toBe('snacks')
    expect(classifyProduct('Papas onduladas mayonesa', 'otros')).toBe('snacks')
    expect(classifyProduct('Papas BBQ dulce', 'otros')).toBe('snacks')
    expect(classifyProduct('Papa crema cebolla', 'otros')).toBe('snacks')
    expect(classifyProduct('PAPA FRITA POLLO 105g', 'otros')).toBe('snacks')
  })

  it('la papa para freír es congelada en cualquier pasillo', () => {
    expect(classifyProduct('Papas A la Francesa 500 Grs', 'otros')).toBe('congelados')
    expect(classifyProduct('Papas en Casco 500 Gr', 'otros')).toBe('congelados')
    expect(classifyProduct('Papa Airfryer X 500 G', 'otros')).toBe('congelados')
    expect(classifyProduct('Papa McCain a la Francesa Papa Fácil 1 Kg', 'congelados')).toBe(
      'congelados',
    )
  })

  it('el pasaboca se reconoce abreviado y en mitad del nombre', () => {
    expect(classifyProduct('PBOCA PAPA POLLO 115 g', 'otros')).toBe('snacks')
    expect(classifyProduct('PBOCA CHICHARRON SUP 100 g', 'otros')).toBe('snacks')
    expect(classifyProduct('Paquete Pasabocas Papas Pollo x12 unds. 25 gr C/U', 'otros')).toBe(
      'snacks',
    )
  })

  it('las crispetas no son queso, mantequilla ni sal', () => {
    expect(classifyProduct('Crispetas caramelo queso', 'otros')).toBe('snacks')
    expect(classifyProduct('Crispetas mantequilla', 'otros')).toBe('snacks')
    expect(classifyProduct('Crispetas sal marina', 'otros')).toBe('snacks')
    expect(classifyProduct('Palomitas Extra Mantequilla 80 gr', 'otros')).toBe('snacks')
    expect(classifyProduct('Crispetas con panela y sal marina', null)).toBe('snacks')
  })

  it('la chocolatina es un dulce aunque lleve leche, maní o arroz', () => {
    expect(classifyProduct('Chocolatina chocolate con leche', 'otros')).toBe('dulces')
    expect(classifyProduct('Chocolatina con arroz crujiente', 'otros')).toBe('dulces')
    expect(classifyProduct('Chocolatina Jet Maní 35 G', 'viveres')).toBe('dulces')
    expect(classifyProduct('Chocolatina wafer vainilla', null)).toBe('dulces')
    expect(classifyProduct('Bombones de chocolate con leche', 'otros')).toBe('dulces')
  })

  it('el chocolate es golosina en dulcería y bebida en la despensa', () => {
    expect(classifyProduct('Chocolates con leche', 'otros')).toBe('dulces')
    expect(classifyProduct('Chocolate Con Leche Y Coco Chocolate Italiano', 'otros')).toBe('dulces')
    expect(classifyProduct('Chocolate tradicional sin azúcar', 'viveres')).toBe('cafe-chocolate')
    expect(classifyProduct('Chocolate de mesa azúcar vainilla', 'viveres')).toBe('cafe-chocolate')
    expect(classifyProduct('Chocolate de mesa tradicional', 'otros')).toBe('cafe-chocolate')
    expect(classifyProduct('Chocolate en polvo con leche', 'viveres')).toBe('cafe-chocolate')
  })

  it('el palito es pan en panadería y queso en lácteos', () => {
    expect(classifyProduct('Palitos tostados sab romero Aptos para veganos', 'panaderia')).toBe(
      'pan',
    )
    expect(classifyProduct('PALITOS QUESO MOZARELLA 250G', 'lacteos')).toBe('quesos')
    expect(classifyProduct('Palito Grissi Cocktail 135 G', 'viveres')).toBe('snacks')
  })
})

describe('classifyProduct — nombres que las raíces estrechas no leían', () => {
  it('la palabra inicial repetida se lee una sola vez', () => {
    expect(classifyProduct('Aros AROS DE CEBOLLA', 'carnes')).toBe('snacks')
    expect(classifyProduct('Papas fritas FRITAS SURTIDO', 'otros')).toBe('snacks')
    expect(classifyProduct('Platanitos platanito natural', 'otros')).toBe('snacks')
    expect(classifyProduct('Aros Frutales 230 Grs', 'viveres')).toBe('cereales')
  })

  it('la concha para tacos es una tortilla, no pasta', () => {
    expect(classifyProduct('Concha para tacos x10und', 'panaderia')).toBe('arepas')
    expect(classifyProduct('Concha Azteca para Taco 145 G', 'viveres')).toBe('arepas')
    expect(classifyProduct('Conchas X 275 G', 'viveres')).toBe('pastas')
  })

  it('"pasta de" algo que no es harina es una pasta para condimentar', () => {
    expect(classifyProduct('Pasta de Cebolla 230 G', 'viveres')).toBe('sal-condimentos')
    expect(classifyProduct('Pasta de cebolla larga mezcla para condimentar', 'viveres')).toBe(
      'sal-condimentos',
    )
    expect(classifyProduct('Pasta de pimentón mezcla para condimentar', 'viveres')).toBe(
      'sal-condimentos',
    )
    expect(classifyProduct('Pasta de Ajonjoli Tahini 240 gr', 'viveres')).toBe('sal-condimentos')
  })

  it('la pasta de arroz o de lentejas sí es pasta', () => {
    expect(classifyProduct('Pasta de arroz espaghetti', 'viveres')).toBe('pastas')
    expect(classifyProduct('Pastas de arroz fusilli', 'viveres')).toBe('pastas')
    expect(classifyProduct('Pasta de lentejas', 'viveres')).toBe('pastas')
    expect(classifyProduct('Pasta para Lasaña 500 G', 'viveres')).toBe('pastas')
  })

  it('el hojaldre no es pasta en ningún pasillo', () => {
    expect(classifyProduct('Pasta Hojaldre 500 G', 'viveres')).toBe('congelados')
    expect(classifyProduct('Masa de hojaldre zenú', 'carnes')).toBe('congelados')
  })
})
