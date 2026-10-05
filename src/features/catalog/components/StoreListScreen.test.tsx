import { fireEvent, render, screen } from '@testing-library/react-native'

import { useStores } from '../hooks/useStores'
import type { Store } from '../model/store'
import { StoreListScreen } from './StoreListScreen'

// A factory, not an automock: automocking loads the real module, which pulls in
// the Supabase client and its environment check.
jest.mock('../hooks/useStores', () => ({ useStores: jest.fn() }))
jest.mock('expo-router', () => ({ useRouter: () => ({ push: jest.fn() }) }))
jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}))

const mockUseStores = jest.mocked(useStores)

const store = (overrides: Partial<Store>): Store => ({
  id: '11111111-1111-4111-8111-111111111111',
  slug: 'exito',
  name: 'Éxito',
  sourceType: 'api',
  isActive: true,
  productCount: 120,
  lastUpdatedAt: null,
  nearestM: null,
  ...overrides,
})

function stores(state: { data?: Store[]; isPending?: boolean; isError?: boolean }) {
  mockUseStores.mockReturnValue({
    data: state.data,
    isPending: state.isPending ?? false,
    isError: state.isError ?? false,
    refetch: jest.fn(),
  } as unknown as ReturnType<typeof useStores>)
}

const BOGOTA = { coords: { latitude: 4.71, longitude: -74.07 }, label: 'Cerca de Bogotá' }

describe('StoreListScreen', () => {
  it('sin origen muestra todas las tiendas e invita a ver las de cerca', async () => {
    stores({ data: [store({})] })
    const onChangeOrigin = jest.fn()

    await render(<StoreListScreen onChangeOrigin={onChangeOrigin} />)

    expect(screen.getByText('Todas las tiendas')).toBeOnTheScreen()
    expect(screen.queryByText(/^a .* k?m$/)).toBeNull()
    await fireEvent.press(screen.getByRole('button', { name: 'Ver solo las tiendas cerca' }))
    expect(onChangeOrigin).toHaveBeenCalledTimes(1)
  })

  it('con origen dice desde dónde busca y muestra la distancia de cada tienda', async () => {
    stores({ data: [store({ nearestM: 1200 })] })

    await render(<StoreListScreen origin={BOGOTA} onChangeOrigin={jest.fn()} />)

    expect(screen.getByText('Cerca de Bogotá')).toBeOnTheScreen()
    expect(screen.getByText('Cambiar')).toBeOnTheScreen()
    expect(screen.getByText(/1,2 km/)).toBeOnTheScreen()
    expect(mockUseStores).toHaveBeenLastCalledWith(BOGOTA.coords)
  })

  it('la distancia va en pasos de 100 m y muy cerca no da cifra', async () => {
    stores({
      data: [
        store({ nearestM: 60 }),
        store({
          id: '22222222-2222-4222-8222-222222222222',
          slug: 'd1',
          name: 'D1',
          nearestM: 120,
        }),
      ],
    })

    await render(<StoreListScreen origin={BOGOTA} />)

    expect(screen.getByText('a menos de 100 m')).toBeOnTheScreen()
    expect(screen.getByText('a 100 m')).toBeOnTheScreen()
  })

  it('una cadena sin precios se ve como "Próximamente" y no se puede abrir', async () => {
    stores({ data: [store({ slug: 'jumbo', name: 'Jumbo', isActive: false, productCount: 0 })] })

    await render(<StoreListScreen />)

    expect(screen.getByText('Próximamente')).toBeOnTheScreen()
    expect(screen.getByRole('button', { name: /Jumbo/ })).toBeDisabled()
  })

  it('con origen y ninguna tienda cerca, ofrece ver todas', async () => {
    stores({ data: [] })
    const onShowAll = jest.fn()

    await render(<StoreListScreen origin={BOGOTA} onShowAll={onShowAll} />)

    expect(screen.getByText('No conocemos tiendas cerca de aquí')).toBeOnTheScreen()
    await fireEvent.press(screen.getByText('Ver todas'))
    expect(onShowAll).toHaveBeenCalledTimes(1)
  })

  it('cargando muestra el esqueleto; con error, un reintento', async () => {
    stores({ isPending: true })
    const { rerender } = await render(<StoreListScreen />)
    expect(screen.getByLabelText('Cargando tiendas')).toBeOnTheScreen()

    stores({ isError: true })
    await rerender(<StoreListScreen />)
    expect(screen.getByText('No se pudieron cargar las tiendas')).toBeOnTheScreen()
    expect(screen.getByRole('button', { name: 'Reintentar' })).toBeOnTheScreen()
  })
})
