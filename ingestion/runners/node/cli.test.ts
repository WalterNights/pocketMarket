import { z } from 'zod'

import { arg, flag, parseArgs, positiveIntArg } from './cli'

const schema = z.object({
  store: z.enum(['exito']).default('exito'),
  max: positiveIntArg,
  'dry-run': z.boolean(),
})

describe('argumentos de los runners', () => {
  const argv = ['node', 'ingest.ts', '--max', '100', '--dry-run']

  it('lee opciones y banderas', () => {
    expect(arg('max', argv)).toBe('100')
    expect(arg('store', argv)).toBeUndefined()
    expect(flag('dry-run', argv)).toBe(true)
  })

  it('valida y convierte', () => {
    expect(parseArgs(schema, { store: undefined, max: '100', 'dry-run': true })).toEqual({
      store: 'exito',
      max: 100,
      'dry-run': true,
    })
    expect(parseArgs(schema, { max: undefined, 'dry-run': false }).max).toBeUndefined()
  })

  // Antes `Number('cien')` daba NaN, y NaN como límite significaba "sin límite".
  it('un --max que no es un entero positivo detiene la corrida', () => {
    expect(() => parseArgs(schema, { max: 'cien', 'dry-run': false })).toThrow(/--max/)
    expect(() => parseArgs(schema, { max: '0', 'dry-run': false })).toThrow(/--max/)
  })

  it('una tienda desconocida detiene la corrida, sin cast', () => {
    expect(() => parseArgs(schema, { store: 'olimpica', 'dry-run': false })).toThrow(/--store/)
  })
})
