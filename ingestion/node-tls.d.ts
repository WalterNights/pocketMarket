/**
 * The two `node:tls` functions the ingestion runner uses. Declared here instead
 * of installing @types/node project-wide: those types redefine globals such as
 * setTimeout and clash with React Native's in the app code that shares this
 * tsconfig.
 */
declare module 'node:tls' {
  const tls: {
    getCACertificates(type?: 'default' | 'system' | 'bundled' | 'extra'): string[]
    setDefaultCACertificates(certs: string[]): void
  }
  export default tls
}
