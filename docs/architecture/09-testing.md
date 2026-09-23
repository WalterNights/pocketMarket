# 09 — Testing

## La pirámide, ajustada a móvil

```
        ╱╲        E2E (Maestro)           ~5 flujos críticos
       ╱  ╲       lento, frágil, caro — solo lo que rompe el negocio
      ╱────╲
     ╱      ╲     Componentes (RNTL)      ~30% del esfuerzo
    ╱        ╲    render + interacción, sin red real
   ╱──────────╲
  ╱            ╲  Unidad (Jest)           ~60% del esfuerzo
 ╱______________╲ model/ puro: rápido, determinista, sin mocks
```

El sesgo hacia la base es deliberado: en RN los tests de integración son lentos y los E2E son
frágiles. **La arquitectura de [01](01-overview.md) existe en parte para que esto sea posible:**
si la lógica de negocio está en `model/` como funciones puras, se prueba sin renderizar nada.

## Nivel 1 — Unidad (`model/`, `utils/`)

Qué se prueba aquí: reglas de negocio, cálculos, transformaciones, validaciones Zod,
máquinas de estado.

```ts
// features/cart/model/cart.test.ts
describe('addItemLocally', () => {
  it('suma cantidad cuando el producto ya está en el carrito', () => {
    const result = addItemLocally([{ id: 'a', qty: 1 }], { id: 'a', qty: 2 })
    expect(result).toEqual([{ id: 'a', qty: 3 }])
  })

  it('rechaza superar el máximo por línea', () => {
    expect(() => addItemLocally([{ id: 'a', qty: 99 }], { id: 'a', qty: 1 }))
      .toThrow(CartLimitError)
  })
})
```

Sin mocks, sin `jest.mock`, sin async. Si un test de esta capa necesita un mock, la función no
es pura y pertenece a otra capa.

## Nivel 2 — Componentes (React Native Testing Library)

Qué se prueba: que el usuario puede hacer lo que debe hacer, y que los cuatro estados se pintan.

```tsx
it('muestra reintento cuando la carga falla', async () => {
  server.use(http.get('*/rest/v1/products', () => HttpResponse.error()))

  render(<ProductListScreen />, { wrapper: TestProviders })

  expect(await screen.findByText('No se pudieron cargar los productos')).toBeVisible()
  expect(screen.getByRole('button', { name: 'Reintentar' })).toBeVisible()
})
```

**Reglas:**
- Consultar por **rol y texto accesible**, no por `testID` salvo que no haya alternativa. Un
  test que pasa con `getByRole('button', { name: ... })` está probando la accesibilidad de paso.
- **MSW** para interceptar HTTP a Supabase. No mockear el módulo `@supabase/supabase-js`: eso
  prueba tus mocks, no tu código.
- `TestProviders` con un `QueryClient` nuevo por test (`retry: false`, `gcTime: 0`) para que no
  haya fugas de caché entre tests.
- Cubrir siempre los cuatro estados de [03 §4](03-patterns.md): loading, error, empty, data.

## Nivel 3 — E2E (Maestro)

Solo los flujos cuya rotura es inaceptable. Preferimos **Maestro** sobre Detox: los flows son
YAML declarativo, tolera esperas por sí mismo y se integra con EAS sin configuración nativa.

```yaml
# e2e/sign-in.yaml
appId: com.pocketmarket.app
---
- launchApp:
    clearState: true
- tapOn: "Correo"
- inputText: "test@example.com"
- tapOn: "Contraseña"
- inputText: "${MAESTRO_TEST_PASSWORD}"
- tapOn: "Entrar"
- assertVisible: "Inicio"
```

Candidatos a E2E (máximo ~5): alta de usuario, inicio de sesión, el flujo central del producto,
el pago si lo hay, y el arranque en frío con sesión existente.

## Lo que en móvil hay que probar y en web no

| Escenario | Cómo |
|---|---|
| **Sin red** | Test de componente con MSW devolviendo error de red + caché precargado |
| **Reanudación tras background** | Simular `AppState` `background → active` y verificar refetch |
| **Proceso matado con estado a medias** | Test del `migrate`/rehidratación de los stores persistidos |
| **Permiso denegado** | Mockear el adapter (`shared/lib/media.ts`) devolviendo denegado; verificar ruta degradada |
| **Deep link con parámetros basura** | Test unitario del parser de params: debe rechazar, no crashear |
| **Migración de store persistido** | Dar estado de la versión N-1 y verificar que arranca sin crash |
| **Escalado de fuente al 200%** | Snapshot o revisión manual de las pantallas densas |
| **Ambos esquemas de color** | Render con `light` y `dark` |

Ese bloque es el que separa una app que funciona en tu escritorio de una que funciona en el
metro con un móvil de tres años.

## Lo que NO probamos

- ❌ Snapshots de árboles enteros. Se rompen ante cualquier cambio de estilo y nadie los lee;
  se aprueban a ciegas. Snapshots solo para salidas pequeñas y deterministas.
- ❌ Implementación interna (estado de un hook privado, llamadas a funciones internas).
- ❌ Librerías de terceros. Ya tienen sus tests.
- ❌ Cobertura como objetivo numérico. Un 90% de cobertura de getters no prueba nada.

## Gate de calidad

Lo que corre antes de un commit y en CI:

```bash
pnpm run type-check     # tsc --noEmit
pnpm run lint           # ESLint, 0 warnings
pnpm run format:check   # Prettier
pnpm test               # Jest
```

E2E corre en CI sobre los builds de `preview`, no en cada commit: es demasiado lento para el
bucle de desarrollo.
