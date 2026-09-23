# ADR-0002: Estilos con NativeWind v4 y componentes de React Native Reusables

- **Fecha:** 2026-09-22
- **Estado:** Aceptada

## Contexto

Hay que elegir cómo se escriben los estilos antes de construir el design system
([06-design-system.md](../architecture/06-design-system.md)), porque la elección permea todos
los componentes.

Datos relevantes:
- En `dashboard-front` y el resto de proyectos web ya se usa **Tailwind CSS v4 con shadcn/ui**.
- La app necesita **dark mode desde el día uno** y **variantes por plataforma**.
- El cambio de tema no debe provocar un re-render global.
- Pregunta explícita del desarrollador: *¿se puede usar shadcn/ui aquí?*

### Respuesta: shadcn/ui literal, no

shadcn/ui está construido sobre **Radix UI**, que son primitivos del DOM (`div`, `button`,
portales del navegador) estilizados con CSS real. React Native no tiene DOM ni CSS. No existe
capa de compatibilidad: los componentes de shadcn/ui no se pueden usar en esta app.

Lo que sí existe es un port con la misma filosofía.

## Opciones consideradas

### Motor de estilos

| Opción | A favor | En contra |
|---|---|---|
| **NativeWind v4** | Misma sintaxis Tailwind que los proyectos web; requisito de React Native Reusables; ecosistema maduro (v4.2.7, sept 2026) | Coste en tiempo de build; subconjunto de utilidades respecto a web |
| Uniwind v1 | "Las bindings de Tailwind más rápidas para RN"; activo (sept 2026) | Muy joven; exige Tailwind v4; menos ejemplos y menos rodaje |
| Unistyles v3 | Resuelve en C++, sin re-render al cambiar tema | Ecosistema menor; incompatible con el modelo de RNR |
| StyleSheet + tokens | Cero dependencias | Verboso; theming y variantes a mano; sin biblioteca de componentes |

### Biblioteca de componentes

| Opción | A favor | En contra |
|---|---|---|
| **React Native Reusables** | El port reconocido de shadcn/ui a RN; modelo copy-paste (el código es tuyo); sobre `@rn-primitives/*` (Radix portado, accesible); 8.7k ★ | CLI con menos ritmo de publicación que los primitivos; cobertura parcial de shadcn |
| gluestack-ui v2 | También copy-paste sobre NativeWind; catálogo amplio | Convenciones propias, más lejos de lo que ya escribes en web |
| Construir todo a mano | Control absoluto | Semanas de trabajo en accesibilidad y comportamiento nativo ya resuelto |

## Decisión

**NativeWind v4 como motor de estilos + React Native Reusables como punto de partida de los
componentes de `shared/ui/`.**

El factor decisivo es la continuidad: escribir `className="flex-1 px-4 bg-background"` y usar
`<Button variant="outline">` en móvil y en web elimina el cambio de contexto entre repos. Para
un desarrollador único trabajando en varios proyectos, eso pesa más que la ventaja de
rendimiento de Unistyles, que solo se nota en cambios de tema frecuentes — algo que esta app no
hace.

**Adoptamos la convención de tokens de shadcn** (`--background`, `--foreground`, `--primary`,
`--muted-foreground`, `--destructive`…) en lugar de inventar nombres propios. Es la que ya usas
en `dashboard-front` y la que RNR trae preconfigurada, incluido el dark mode.

**Los componentes copiados son código del repo, no una dependencia.** Viven en `shared/ui/` y
se someten a las reglas del proyecto igual que cualquier otro archivo: área táctil ≥ 44 pt,
`accessibilityLabel`, funcionamiento en claro y oscuro.

Descartamos Uniwind por juventud, no por calidad: se reevalúa cuando tenga más rodaje.

## Consecuencias

**Positivas**
- Curva de aprendizaje cercana a cero viniendo de shadcn/ui en web.
- Un solo vocabulario de diseño y de tokens entre móvil y web.
- Dark mode y variantes sin infraestructura propia.
- Los primitivos de `@rn-primitives/*` ya resuelven accesibilidad y comportamiento nativo.
- Modelo copy-paste: no hay una dependencia de UI que pueda bloquear un upgrade de SDK.

**Negativas (aceptadas)**
- NativeWind añade una capa en la cadena de build de Metro, que puede retrasar upgrades de SDK.
- No todas las utilidades de Tailwind existen en RN.
- **No todo shadcn/ui tiene equivalente.** Lo muy propio de web (tablas de datos, menús de
  escritorio) no está, y a menudo no debería estarlo.
- `@react-native-reusables/cli` publica a menor ritmo que los primitivos. Mitigación: los
  componentes se copian, no se instalan — el CLI es una comodidad, no una dependencia.

**Qué invalidaría esta decisión**
- Que NativeWind bloquee un upgrade de Expo SDK.
- Que el cambio de tema o las listas largas muestren coste medible atribuible a NativeWind
  → migrar a Uniwind, que comparte sintaxis.
- Que `@rn-primitives/*` quede sin mantenimiento → los componentes ya copiados siguen
  funcionando; se sustituyen los primitivos uno a uno.

## La trampa: no traer la web al teléfono

Un sistema de diseño nacido en web arrastra patrones que en móvil se sienten mal. Cada
componente adoptado se revisa contra el comportamiento nativo esperado:

| Patrón de shadcn/ui | Qué espera el usuario en móvil |
|---|---|
| `Dialog` centrado | **Bottom sheet** con gesto de cierre |
| `Select` desplegable | Action sheet o picker nativo |
| `Tooltip` en hover | No existe el hover. Long-press o texto visible |
| `DropdownMenu` | Action sheet |
| `Toast` en esquina | Banner respetando safe area, o háptica |
| Tabla de datos | Lista virtualizada con filas táctiles |

Adoptar un componente de RNR **no** exime de preguntarse si ese patrón es el correcto para una
pantalla de cinco pulgadas que se usa con el pulgar.
