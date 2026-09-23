---
paths:
  - "package.json"
  - "pnpm-workspace.yaml"
  - "pnpm-lock.yaml"
  - ".npmrc"
---

# Reglas — Dependencias y cadena de suministro

**Gestor: pnpm, exclusivamente.** Nada de `npm install` ni `yarn` en este repo: mezclar gestores
produce árboles divergentes y anula las defensas configuradas abajo.

## Por qué pnpm y no npm

El ataque de cadena de suministro más común en npm no necesita que uses el paquete: basta con
**instalarlo**. Un `preinstall` o `postinstall` se ejecuta con tus permisos, lee tu `.env`, tus
credenciales de git y tus tokens de EAS/Supabase, y los exfiltra antes de que escribas una línea.

pnpm 11+ trae defensas contra esto **activadas por defecto**; npm no.

## Las cuatro defensas

### 1. `allowBuilds` — ningún script se ejecuta sin permiso explícito

Es la defensa principal. Por defecto **nada** ejecuta `preinstall` / `install` / `postinstall`.

```yaml
# pnpm-workspace.yaml
allowBuilds:
  '*': false            # denegar por defecto
  playwright: true      # descarga los navegadores headless para la ingesta
```

> Muchos paquetes que "parece" que necesitan build no lo necesitan. El CLI de Supabase, por
> ejemplo, **no tiene ningún script de instalación**: distribuye el binario como
> `optionalDependencies` por plataforma. Comprobar antes de asumir.

Reglas duras:

- **Toda entrada en `allowBuilds` lleva un comentario que justifica por qué ese paquete necesita
  ejecutar un script.** Sin justificación, no entra.
- Antes de permitir un build, **leer qué hace el script**:
  ```bash
  cat node_modules/<pkg>/package.json | grep -A2 '"scripts"'
  ```
  Código ofuscado, `base64`, `curl`/`wget`, o cualquier llamada de red que no sea la descarga
  documentada de un binario → 🔴 no se permite, se busca alternativa.
- **Nunca** `dangerouslyAllowAllBuilds`. El nombre no es decorativo.
- `onlyBuiltDependencies`, `neverBuiltDependencies`, `ignoredBuiltDependencies` e
  `ignoreDepScripts` **ya no existen** (eliminados en pnpm 11). Si aparecen en un ejemplo de
  internet, está desactualizado.

### 2. `minimumReleaseAge` — cuarentena de versiones nuevas

El malware en npm se detecta y se retira normalmente en horas. Esperar antes de instalar evita
la ventana de exposición casi entera.

```yaml
minimumReleaseAge: 10080    # 7 días (el default de pnpm es 1440 = 1 día)
```

Subimos a una semana: este proyecto no necesita la versión publicada esta mañana. Si alguna vez
hace falta un parche urgente de seguridad, se usa `minimumReleaseAgeExclude` **para ese paquete
concreto**, nunca bajando el valor global.

### 3. `blockExoticSubdeps` — sin fuentes raras en transitivas

```yaml
blockExoticSubdeps: true    # default en pnpm 11+, se declara explícito
```

Impide que una dependencia transitiva se resuelva desde un repo git o una URL de tarball. Una
dependencia directa desde git es una decisión consciente; una **transitiva** desde git es cómo
se cuela código que nadie revisó.

### 4. `trustPolicy: no-downgrade` — detectar pérdida de confianza

```yaml
trustPolicy: no-downgrade
```

Falla la instalación si el nivel de confianza de un paquete bajó respecto a versiones previas
(p. ej. perdió la procedencia firmada que antes tenía). Un mantenedor comprometido suele
publicar sin la firma del pipeline original.

## Lockfile

- `pnpm-lock.yaml` **se commitea siempre**. Es el registro de qué versión exacta y con qué hash
  entró cada cosa.
- CI usa `pnpm install --frozen-lockfile`. Si el lockfile no cuadra con `package.json`, falla —
  no se "arregla" solo.
- Un cambio en el lockfile que nadie pidió, en un PR que no tocaba dependencias, es un hallazgo
  de review 🔴.
- Al revisar un diff de lockfile, mirar que `resolution.integrity` exista y que la URL sea del
  registro configurado.

## Versiones del toolchain

```json
// package.json
"packageManager": "pnpm@12.5.1",
"engines": { "node": ">=20.19.0", "pnpm": ">=11.0.0" }
```

`packageManager` hace que Corepack use **esa** versión de pnpm, no la que cada máquina tenga
instalada. Instalaciones reproducibles entre tu portátil y CI.

## Antes de añadir cualquier dependencia

1. **¿Se puede evitar?** En móvil una librería no solo pesa: puede arrastrar código nativo,
   exigir build nueva (no OTA) y bloquear un upgrade de Expo SDK. La dependencia más segura es
   la que no se instala.
2. **Ejecutar el skill `vet-dependency`.** El hook `pre-install-guard` lo exige antes de que
   cualquier `pnpm add` toque el árbol.
3. **Comprobar compatibilidad con la New Architecture** si tiene código nativo
   (React Native Directory).
4. **Preferir lo que ya trae Expo.** `expo-*` está versionado junto al SDK y probado con él.

### Comandos de vetting con pnpm

El skill global usa sintaxis npm. Los equivalentes aquí:

```bash
pnpm view <pkg> name version repository.url dist.tarball time.modified
pnpm audit --prod
pnpm why <pkg>                    # quién lo trae al árbol
pnpm licenses list                # revisión de licencias
```

Para inspeccionar sin instalar:

```bash
pnpm pack <pkg>@<version>         # descarga el tarball sin ejecutar nada
tar -tzf <pkg>-<version>.tgz      # ver contenido
```

## Qué NO hacer

- ❌ `npm install` o `yarn` en este repo.
- ❌ `dangerouslyAllowAllBuilds`, ni "temporalmente para probar".
- ❌ Bajar `minimumReleaseAge` global para desbloquear un paquete. Usar el exclude puntual.
- ❌ Añadir a `allowBuilds` sin leer el script y sin justificar en un comentario.
- ❌ Instalar una dependencia sin pasar por `vet-dependency`.
- ❌ Borrar y regenerar `pnpm-lock.yaml` para "arreglar" un conflicto: se resuelve el conflicto.
- ❌ `pnpm audit fix` automático — se revisa qué cambia y se aplica a conciencia.
- ❌ Dependencias desde git o tarball URL sin una razón registrada en un ADR.
