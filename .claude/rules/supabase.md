---
paths:
  - "supabase/**"
  - "src/features/**/api/**"
  - "src/shared/lib/supabase.ts"
---

# Reglas — Supabase

Referencia completa: [docs/architecture/08-security.md](../../docs/architecture/08-security.md)

## Axioma

> El bundle de la app es público. La clave `anon` es pública. **La única frontera de seguridad
> son las políticas RLS.**

## Catálogo vs datos de usuario

Las tablas se dividen en dos mundos con reglas distintas
([modelo completo](../../docs/domain/01-data-model.md)):

| Mundo | Tablas | Lectura | Escritura |
|---|---|---|---|
| **Catálogo** | `store`, `category`, `region`, `store_product`, `price_snapshot`, `equivalence_*` | `anon` **y** `authenticated` | **Solo `service_role`** (el pipeline) |
| **Usuario** | `profile`, `shopping_list`, `list_item`, `list_reminder` | dueño | dueño |

El catálogo es **público**: son precios que las tiendas ya publican, y exigir cuenta para
consultarlos es fricción sin beneficio (la clave anon es pública de todos modos). Buscar y ver
precios no necesita cuenta; **guardar listas sí**.

> ⚠️ **`security_invoker` propaga los permisos del invocador a TODAS las tablas de la vista**,
> incluidas las de subconsultas. Una vista pública que consulte `profile` falla para `anon` con
> *permission denied*. Encapsular ese acceso en una función `security definer` sin parámetros
> que solo lea la fila de `auth.uid()` — ver `public.current_region()`.

En las tablas de catálogo, la **ausencia de política de escritura es deliberada y es la
protección**. Nunca añadir una política de insert/update/delete ahí: si un cliente pudiera
escribir precios, cualquiera podría envenenar los datos de todos los usuarios.

## Row Level Security — obligatorio, sin excepciones

1. `alter table <t> enable row level security;` en **toda** tabla. Una tabla sin RLS accesible
   con la clave anon es una tabla pública de internet.
2. Política **por operación** (`select`, `insert`, `update`, `delete`). `FOR ALL` casi siempre
   concede de más.
3. Sujeto = `auth.uid()`. **Nunca** confiar en un `user_id` del payload del cliente.
4. `WITH CHECK` en `insert` y `update`, no solo `USING`. Sin él, un usuario crea filas a nombre
   de otro.
5. Toda política nueva lleva un **test de acceso denegado** que verifica que el acceso indebido
   falla. Una política que nadie intentó romper no está verificada.
6. Columnas sensibles: no exponerlas. Vistas o `security definer functions`, y `REVOKE` sobre
   lo que el cliente no debe ver.

```sql
alter table products enable row level security;

create policy "owner reads own products"
  on products for select
  using (auth.uid() = owner_id);

create policy "owner inserts own products"
  on products for insert
  with check (auth.uid() = owner_id);
```

## Lo que el cliente nunca decide

- **`price_cop`** → lo escribe el pipeline. El cliente ni siquiera tiene política para tocarlo.
- **`price_cop_at_add`** → lo pone un trigger leyendo `current_price`, no el payload. Si lo
  enviara el cliente, podría falsear la variación de precio.
- **Totales de una lista** → vista SQL. No se guardan ni se suman en el cliente: un total
  almacenado queda obsoleto en cuanto cambia un precio, que es justo lo contrario del propósito
  de la app.
- Roles y permisos → tabla de servidor, nunca un campo del perfil editable por el usuario.
- `captured_at` / `created_at` / `updated_at` → `default now()` y triggers. El reloj del
  dispositivo no es confiable ni honesto.

## Dinero

`integer` COP. **Nunca** `numeric` con decimales, nunca float. El peso colombiano no usa
centavos en retail, y los flotantes en dinero son un error de diseño en cualquier moneda.

## Borrado

**Nunca borrar un `store_product`**: hay `list_item` de usuarios apuntando a él. Si desaparece
de la fuente, `is_available = false` y la app lo muestra atenuado con su último precio conocido.

## Claves

| Clave | Dónde |
|---|---|
| `SUPABASE_URL` | `EXPO_PUBLIC_SUPABASE_URL` — pública por diseño |
| `anon` | `EXPO_PUBLIC_SUPABASE_ANON_KEY` — pública por diseño |
| `service_role` | **Jamás en la app.** Solo Edge Functions / servidor |

Toda `EXPO_PUBLIC_*` acaba dentro del bundle. Si dudas si puede ser pública, no puede.

## Cliente

- Instancia **única** en `src/shared/lib/supabase.ts`.
- Storage de auth = `expo-secure-store`, no el AsyncStorage por defecto.
- Refresh automático pausado en background.
- Nadie fuera de `features/**/api/` importa este módulo.

## Consultas

- `select()` con columnas explícitas. **Nunca `select('*')`** — cada columna extra son datos
  móviles y batería del usuario.
- Paginar con `.range()`. Nunca traer la colección completa.
- `in()` para lotes en vez de N consultas en bucle (el N+1 aquí cuesta latencia de radio).
- Validar la respuesta con Zod antes de devolverla: que TypeScript compile no prueba que la fila
  tenga esa forma en runtime.
- Errores → `RepositoryError` tipado, con contexto. Nunca propagar `{ data, error }`.

## Migraciones

- Todo cambio de schema es una migración versionada en `supabase/migrations/`. Nada de cambios
  desde el dashboard sin migración correspondiente.
- Nombres descriptivos: `20260922_add_products_owner_index.sql`.
- Revisar el SQL generado antes de aplicarlo.
- Tras cada migración: regenerar tipos.
  ```bash
  pnpm supabase gen types typescript --project-id <id> > src/shared/types/database.types.ts
  ```
- Índices para toda columna usada en filtro, orden o join. Sin índice, RLS con subconsulta se
  vuelve lenta rápido.
- Enums en Postgres: añadir valores requiere `ALTER TYPE ... ADD VALUE`, que no puede ir dentro
  de una transacción.

## Entornos

El free tier permite **2 proyectos activos**, así que "uno por entorno" no cabe. Reparto real:

| Entorno | Dónde | Perfil EAS |
|---|---|---|
| **dev** | Supabase **local** (Docker). Gratis, ilimitado, sin cuenta | `development` |
| **staging/prod** | Proyecto remoto | `preview` / `production` |

**Nunca desarrollar contra producción.** El desarrollo diario va contra local: `pnpm run db:start`.

Los proyectos free **se pausan tras una semana sin actividad** y dejan de responder hasta
restaurarlos desde el dashboard. El cron diario de ingesta lo evita como efecto secundario.

## Realtime

- Solo si hay caso de uso multidispositivo real: un canal abierto es un WebSocket vivo con su
  coste de batería.
- Cerrar en background, reabrir en foreground **seguido de refetch**.
- Realtime respeta RLS: verificar que la política cubre también los eventos.

## Storage

- Buckets con políticas de acceso explícitas, igual que las tablas.
- URLs firmadas con expiración para contenido privado. Nada de buckets públicos "temporalmente".
- Transformaciones de imagen en la URL, dimensionadas para la pantalla.
