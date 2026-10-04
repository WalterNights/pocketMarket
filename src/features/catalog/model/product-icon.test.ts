import { productIconName } from './product-icon'

describe('productIconName', () => {
  it('reconoce el producto por su nombre antes que por la categoría', () => {
    // El caso que motivó esto: huevos son lácteos, pero un cartón de leche
    // como icono de unos huevos se ve absurdo.
    expect(productIconName('Huevos AA x 30', 'lacteos')).toBe('Egg')
  })

  it('agrupa granos y cereales bajo el mismo icono', () => {
    expect(productIconName('Arroz blanco', 'viveres')).toBe('Wheat')
    expect(productIconName('Avena en hojuelas', 'viveres')).toBe('Wheat')
    expect(productIconName('Harina de trigo', null)).toBe('Wheat')
  })

  it('distingue leguminosas de granos', () => {
    expect(productIconName('Lentejas', 'viveres')).toBe('Bean')
    expect(productIconName('Fríjol cargamanto', 'viveres')).toBe('Bean')
  })

  it('ignora tildes y mayúsculas', () => {
    expect(productIconName('PLÁTANO maduro', null)).toBe('Banana')
    expect(productIconName('platano maduro', null)).toBe('Banana')
    expect(productIconName('Café molido', null)).toBe('Coffee')
  })

  it('cubre los productos del seed', () => {
    expect(productIconName('Aceite de girasol', 'viveres')).toBe('Droplet')
    expect(productIconName('Leche entera', 'lacteos')).toBe('Milk')
    expect(productIconName('Queso campesino', 'lacteos')).toBe('Milk')
    expect(productIconName('Chocolate de mesa', 'bebidas')).toBe('Cookie')
    expect(productIconName('Panela pulverizada', 'viveres')).toBe('Candy')
  })

  it('cae a la categoría cuando el nombre no dice nada', () => {
    expect(productIconName('Producto raro XYZ', 'mascotas')).toBe('PawPrint')
    expect(productIconName('Producto raro XYZ', 'bebes')).toBe('Baby')
    expect(productIconName('Producto raro XYZ', 'congelados')).toBe('Snowflake')
  })

  it('cae a un icono neutro sin nombre ni categoría reconocibles', () => {
    expect(productIconName('Producto raro XYZ', null)).toBe('ShoppingBasket')
    expect(productIconName('Producto raro XYZ', 'categoria-inventada')).toBe('ShoppingBasket')
  })

  it('nunca devuelve vacío, para no dejar un hueco en la fila', () => {
    expect(productIconName('', null)).toBeTruthy()
  })

  describe('palabra entera, no subcadena (ING-006)', () => {
    it('un refresco no es carne de res', () => {
      expect(productIconName('Refresco de fresa', null)).toBe('CupSoda')
    })

    it('la carne de res sigue siendo carne', () => {
      expect(productIconName('Carne de res molida', null)).toBe('Beef')
    })

    it('un pañal no es pan', () => {
      expect(productIconName('Pañales etapa 3 x 30', 'bebes')).toBe('Baby')
    })

    it('el pan y los panes siguen siendo pan', () => {
      expect(productIconName('Pan tajado', null)).toBe('Croissant')
      expect(productIconName('Panes de bono', null)).toBe('Croissant')
    })

    it('la pasta dental no es pasta', () => {
      expect(productIconName('Pasta dental triple acción', 'cuidado-personal')).toBe('Bath')
    })

    it('el aguacate no es agua', () => {
      expect(productIconName('Aguacate hass', null)).toBe('Salad')
    })

    it('una raíz marcada con * coge todas sus formas', () => {
      expect(productIconName('Salchichón cervecero', null)).toBe('Ham')
      expect(productIconName('Yogurt griego', null)).toBe('Milk')
    })
  })
})
