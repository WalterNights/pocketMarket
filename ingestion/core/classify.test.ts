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
