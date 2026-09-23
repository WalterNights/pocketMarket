---
name: rn-security
description: Use this skill whenever the user asks to "revisa seguridad", "auditoría de seguridad", "security audit", "revisa vulnerabilidades", "hay filtración de datos", "data leak", "revisa los secretos", "revisa RLS", "revisa las políticas", "es seguro", "revisa las dependencias", "audit packages", or any request to validate that this React Native app leaks nothing and that its supply chain is clean. Covers the mobile threat model (public bundle, RLS as the only boundary, device storage, logs, deep links) AND the pnpm supply-chain defences of this repo. Trigger proactively before a release, after adding a dependency, after touching RLS policies, and whenever the user mentions "seguro", "filtrar", "secreto" or "permisos".
---

# RN Security — el modelo de amenaza de esta app

Referencia: [08-security.md](../../../docs/architecture/08-security.md) ·
[supabase.md](../../rules/supabase.md) · [dependencies.md](../../rules/dependencies.md)

> ⚠️ **No uses el skill global `security-audit` en este repo.** Está escrito para un proyecto
> Next.js/NestJS: ejecuta `npm audit` — que aquí **viola la regla 18** y rompe las defensas de
> `pnpm-workspace.yaml` — y audita SQLi y hardening de transporte, que no es donde está el
> riesgo de una app móvil.

## El axioma

> **El bundle de la app es público. La clave `anon` es pública. La única frontera de seguridad
> son las políticas RLS.**

Todo lo demás se deriva de ahí. Un atacante no necesita descompilar nada: puede leer el bundle,
sacar la URL y la clave anon, y hablar con Supabase directamente con `curl`. La pregunta
correcta nunca es "¿puede el usuario llegar a esta pantalla?" sino **"¿qué devuelve la base si
alguien pregunta sin pasar por la app?"**

---

## Parte A — Lo que sale en el bundle

- [ ] Ninguna `EXPO_PUBLIC_*` contiene algo que no pueda publicarse en un tuit. **Toda**
      `EXPO_PUBLIC_*` acaba dentro del bundle.
- [ ] `SUPABASE_SERVICE_ROLE_KEY` **ausente** de `src/`, `app/` y `app.config.ts`. Vive en
      secretos de GitHub Actions y en el entorno de la Edge Function.
- [ ] Sin claves de API de terceros embebidas. Si una llamada necesita un secreto, va a una
      Edge Function, no al dispositivo.
- [ ] `app.config.ts` no filtra endpoints internos ni identificadores de entorno.
- [ ] Sourcemaps de producción no publicados junto al bundle.

**Cómo comprobarlo de verdad**, no leyendo el código:

```bash
pnpm exec expo export --platform android
grep -rl "service_role\|SERVICE_ROLE" dist/ || echo "limpio"
grep -ao -- 'eyJ[A-Za-z0-9_-]\{20,\}' dist/_expo/static/js/**/*.hbc | sort -u | head
```

Todo JWT que aparezca debe ser la clave **anon** y ninguna otra. Decodifica el `role` del
payload antes de darlo por bueno.

## Parte B — RLS, que es la frontera real

- [ ] **Toda** tabla tiene `enable row level security`. Una tabla sin RLS accesible con la
      clave anon es una tabla pública de internet.
- [ ] Política **por operación** (`select` / `insert` / `update` / `delete`). `FOR ALL` concede
      de más casi siempre.
- [ ] `WITH CHECK` en `insert` **y** en `update`. Sin él, un usuario crea filas a nombre de otro.
- [ ] El sujeto es `auth.uid()`, nunca un `user_id` que venga del payload del cliente.
- [ ] **Catálogo: la ausencia de política de escritura es la protección.** Si alguien añade un
      `insert` ahí, cualquiera puede envenenar los precios de todos los usuarios. 🔴
- [ ] Toda política nueva tiene su **test de acceso denegado** en `supabase/tests/`.
- [ ] `pnpm run db:test` en verde.

### Vistas — el fallo más silencioso de Supabase

- [ ] Toda vista que toque datos de usuario lleva `with (security_invoker = true)`. Sin eso
      corre como su dueño y **salta RLS**: la vista "funciona" perfectamente mientras filtra
      las filas de todos. 🔴
- [ ] `security_invoker` propaga los permisos del invocador a **todas** las tablas de la vista,
      incluidas las de subconsultas. Encapsular el acceso restringido en una función
      `security definer` sin parámetros (ver `public.current_region()`).
- [ ] Las **materialized views no honran RLS**, solo los GRANT. Válido para catálogo público;
      nunca para datos de usuario. 🔴

### Lo que el cliente nunca decide

- [ ] Precios, totales, roles, `captured_at` / `created_at`. Si el cliente puede enviarlo,
      puede mentir. Los totales salen de una vista; los timestamps, de `default now()`.

## Parte C — Filtración de datos en el dispositivo

Esto es lo que un audit de web no mira y donde más se filtra en móvil.

- [ ] **Tokens y datos sensibles en `expo-secure-store`**, nunca en AsyncStorage ni MMKV sin
      cifrar. El storage de auth del cliente de Supabase debe estar apuntado ahí.
- [ ] **Logout limpia todo:** `queryClient.clear()` **y** el persister **y** los stores de
      Zustand. Sin las tres cosas, el siguiente usuario del dispositivo ve datos del anterior. 🔴
- [ ] **Sin `console.log` de payloads, tokens, emails ni filas completas.** En release los logs
      siguen siendo legibles con el dispositivo conectado.
- [ ] **Mensajes de error sin detalle interno.** `duplicate key value violates unique
      constraint "profile_email_key"` le dice a un atacante el esquema y confirma un email.
- [ ] **Deep links:** parámetros validados con Zod, y **ninguna acción con efecto** disparada
      por un link. Un deep link es entrada no confiable: cualquier app del teléfono lo dispara.
- [ ] **Portapapeles:** nada sensible copiado sin que el usuario lo pida.
- [ ] **Capturas y multitarea:** si alguna pantalla llega a mostrar datos sensibles, ocultarla
      al pasar a segundo plano.
- [ ] **Caché persistida:** lo que se guarde en disco para offline es legible en un dispositivo
      rooteado. Decidir explícitamente qué se persiste.
- [ ] **Permisos con ruta degradada.** Pedir en el momento de uso, con explicación previa. En
      iOS la negativa es prácticamente definitiva.

## Parte D — Cadena de suministro (pnpm, no npm)

**Nunca ejecutar `npm audit` ni `npm install` aquí.** Anulan `allowBuilds`,
`minimumReleaseAge`, `blockExoticSubdeps` y `trustPolicy`.

```bash
pnpm audit --prod                 # vulnerabilidades conocidas
pnpm ignored-builds               # confirma que allowBuilds sigue activo
pnpm licenses list                # licencias
git diff -- pnpm-lock.yaml        # ¿qué entró de verdad?
```

- [ ] `allowBuilds` no tiene entradas nuevas sin justificación escrita al lado.
- [ ] **Nunca `dangerouslyAllowAllBuilds`.** 🔴
- [ ] `minimumReleaseAge` intacto; las exclusiones siguen acotadas al ecosistema del SDK.
- [ ] `trustPolicyExclude` no ha crecido sin verificar el caso (repo oficial, mantenedores,
      ausencia de scripts, advisories).
- [ ] Toda dependencia nueva pasó por `vet-dependency` **antes** de instalarse.
- [ ] Ningún paquete nuevo ejecuta `preinstall` / `install` / `postinstall` sin entrada
      explícita. (`build`, `test` y `prepare` **no** se ejecutan desde el tarball del registro.)

⚠️ Un advisory de GitHub **no** significa que la versión instalada sea vulnerable: comparar
siempre contra `vulnerable_version_range` antes de reportarlo.

## Parte E — Ingesta

- [ ] `service_role` solo en `ingestion/` y en Edge Functions. Jamás en `src/`.
- [ ] `src/` e `ingestion/` no se importan entre sí.
- [ ] La app no scrapea nada, nunca, por ninguna razón.
- [ ] El User-Agent de la ingesta identifica al proyecto y da un contacto.
- [ ] Una corrida al día por tienda, concurrencia 1, con pausa. Ni bucles ni ráfagas.

---

## Formato de salida

```markdown
## Auditoría de seguridad — <alcance>

### Veredicto
<una frase: seguro para publicar | corregir antes de publicar | brecha activa>

### Hallazgos
| # | Severidad | Hallazgo | Ubicación | Impacto real |
|---|---|---|---|---|
| 1 | 🔴 | ... | [`archivo:línea`](archivo#L42) | <qué obtiene un atacante> |

### Comprobado y limpio
- <lo que se verificó y está bien — importa tanto como lo que falla>

### Sin verificar
- <lo que no se pudo comprobar y qué haría falta>
```

**Severidad**

- 🔴 **Crítico** — un atacante obtiene datos de otro usuario, escribe donde no debe, o hay un
  secreto expuesto. Bloquea el release.
- 🟡 **Importante** — filtración de información útil para un ataque, o una defensa debilitada.
- 🟢 **Endurecimiento** — mejora sin explotación conocida.

Cada hallazgo 🔴 o 🟡 dice **qué obtiene el atacante**, no solo qué regla se incumple. "Falta
`WITH CHECK`" es una observación; "cualquier usuario puede crear listas a nombre de otro" es un
hallazgo.

## What NOT to do

- ❌ **No ejecutes `npm audit` ni `npm install`.** Usa pnpm.
- ❌ No reportes una `EXPO_PUBLIC_*` como filtración: son públicas **por diseño**. El hallazgo
  es que contenga algo que no debería.
- ❌ No des por segura una tabla porque la app no la consulte. La clave anon habla directo.
- ❌ No marques un advisory sin comparar contra el rango de versiones afectadas.
- ❌ No propongas ofuscar el bundle como medida de seguridad: no lo es.
- ❌ No modifiques código. Esta skill reporta; el arreglo va después, con `rn-implement`.
