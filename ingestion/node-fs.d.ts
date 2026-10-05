/**
 * The `node:fs/promises` functions the geocoding cache uses (core/geocode.ts).
 * Declared here for the same reason as node-tls.d.ts: @types/node redefines
 * globals that clash with React Native's in the app code sharing this tsconfig.
 */
declare module 'node:fs/promises' {
  export function readFile(path: string, encoding: 'utf8'): Promise<string>
  export function writeFile(path: string, data: string): Promise<void>
  export function mkdir(path: string, options: { recursive: true }): Promise<string | undefined>
}
