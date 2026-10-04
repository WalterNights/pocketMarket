/**
 * Native stack header shared by the pushed screens: flat, on the cream canvas.
 * Separation comes from surface and border, never shadow
 * (docs/design/00-visual-direction.md).
 *
 * Literal colours because the native header does not read NativeWind classes;
 * they mirror `--background` and `--foreground` in global.css (light theme).
 */
export const flatHeaderOptions = {
  headerShown: true,
  headerBackTitle: 'Atrás',
  headerStyle: { backgroundColor: '#FAF8F3' },
  headerTintColor: '#1F1D1B',
  headerShadowVisible: false,
} as const
