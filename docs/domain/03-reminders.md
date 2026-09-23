# Recordatorios periódicos

El usuario quiere que la app le avise de hacer el mercado: **semanal, quincenal o mensual**.

Parece trivial y no lo es. Este documento existe porque las tres frecuencias no se implementan
igual, y una de ellas no tiene soporte nativo.

## Arquitectura: definición en servidor, ejecución en dispositivo

```
list_reminder (Supabase)          ←  la DEFINICIÓN
  frequency, weekday, day_of_month, time_local, anchor_date
        │
        │  al abrir la app / al cambiar el recordatorio
        ▼
Notificaciones locales (expo-notifications)   ←  la EJECUCIÓN
```

**Notificaciones locales, no push.** Razones:

- Funcionan **sin red**, que es la mitad del valor de esta app.
- No requieren servidor de push, ni tokens que rotan, ni credenciales de APNs/FCM.
- No dependen de que el dispositivo esté online a la hora del recordatorio.

La definición vive en Supabase para que sobreviva a una reinstalación y se sincronice entre
dispositivos. La programación real es local y se **reconcilia** cada vez que la app arranca.

## Las tres frecuencias

| Frecuencia | Soporte nativo | Cómo se implementa |
|---|---|---|
| **Semanal** | ✅ Sí | Trigger de calendario con `weekday` + `repeats: true`. Una sola notificación programada, se repite sola |
| **Mensual** | ✅ Sí | Trigger de calendario con `day` + `repeats: true` |
| **Quincenal** | ❌ **No existe** | Programar N ocurrencias futuras como triggers de fecha únicos, y reponerlas al abrir la app |

### Por qué la quincenal es el caso difícil

Ni iOS ni Android tienen un trigger de calendario "cada 14 días". Las opciones son:

1. **Lote de ocurrencias + reposición** (elegida) — programar las próximas N fechas concretas y,
   cada vez que la app se abre, reponer las consumidas. Sin servidor, funciona offline.
2. Push desde servidor con `pg_cron` — exige red a la hora exacta y montar push. Contradice el
   principio offline-first.

**Coste de la opción 1:** el usuario debe abrir la app de vez en cuando. Con un lote de ~12
ocurrencias (≈6 meses) eso no es una exigencia real — alguien que no abre la app en medio año
no necesita el recordatorio.

## El límite que obliga a presupuestar

> **iOS permite un máximo de 64 notificaciones locales pendientes por app.**
> Al superarlo, las nuevas se descartan en silencio.

Android no impone ese tope, pero aplicamos el mismo presupuesto en ambas plataformas para tener
un solo comportamiento que razonar.

Reparto:

| Concepto | Presupuesto |
|---|---|
| Recordatorios semanales y mensuales | 1 notificación cada uno (se repiten solos) |
| Cada recordatorio quincenal | Hasta 12 ocurrencias programadas |
| Reserva para notificaciones puntuales | 8 |
| **Tope duro de recordatorios quincenales simultáneos** | **4** |

Si el usuario intenta crear un quinto recordatorio quincenal, la app lo dice explícitamente en
vez de fallar en silencio. Un recordatorio que no suena es peor que uno que no se pudo crear.

## Reconciliación al arrancar

En cada arranque (y al volver de background tras un tiempo largo):

```
1. Leer list_reminder de Supabase (o de caché si no hay red)
2. Leer las notificaciones ya programadas en el dispositivo
3. Cancelar las que ya no corresponden a ningún recordatorio activo
4. Programar las que faltan
5. Reponer ocurrencias consumidas de los quincenales
6. Verificar el presupuesto de 64 antes de programar
```

La reconciliación es **idempotente**: ejecutarla dos veces deja el mismo estado. Sin esa
propiedad, cada arranque duplicaría notificaciones.

Cada recordatorio guarda localmente (MMKV) los identificadores de notificación que programó,
para poder cancelarlos con precisión en vez de borrar todo y reprogramar.

## Casos borde del calendario

| Caso | Decisión |
|---|---|
| Mensual el día 31 en un mes de 30 | Se dispara el **último día del mes**. Nunca se salta |
| Mensual el 29 en febrero no bisiesto | Último día del mes |
| Cambio de zona horaria | `time_local` es hora local: el recordatorio suena a las 8:00 donde esté el usuario |
| Horario de verano | Colombia no lo aplica, pero la lógica usa hora local para no asumirlo |
| Ancla de la quincena | `anchor_date` define desde qué fecha se cuentan los 14 días |
| Recordatorio en el pasado al crearlo | La primera ocurrencia es la siguiente futura, nunca inmediata |

## Permisos

Pedir permiso de notificaciones **al crear el primer recordatorio**, no al abrir la app. Pedirlo
sin contexto es rechazo casi seguro, y en iOS la negativa es prácticamente definitiva: el
usuario tendría que ir a Ajustes.

- **iOS** — `expo-notifications` solicita autorización; si se deniega, no hay segunda
  oportunidad desde la app.
- **Android 13+** — requiere `POST_NOTIFICATIONS` en tiempo de ejecución.
- **Android 12+** — las alarmas exactas tienen restricciones adicionales. Estos recordatorios
  **no necesitan precisión al minuto**: un aviso de "haz mercado" tolera perfectamente la
  imprecisión del modo Doze. No pedir permisos de alarma exacta para esto.

### Si se deniega el permiso

El recordatorio **se guarda igual** en Supabase y la app muestra, en la lista, cuándo tocaría
hacer el mercado. La función se degrada, no desaparece. Y se ofrece un enlace a los ajustes del
sistema.

## Contenido de la notificación

Útil sin abrir la app:

```
🛒 Hora del mercado
"Mercado quincenal" · 23 productos · ~$182.400
```

El total se calcula **al programar**, no al dispararse (una notificación local no puede
consultar la red). Al abrir la lista, la app muestra el precio actualizado y la variación. Por
eso el texto dice `~` y la pantalla destino aclara si cambió.

`data` incluye el `listId` para hacer deep link directo a la lista — y, según
[05-navigation.md](../architecture/05-navigation.md), ese link **solo navega**, nunca ejecuta
una acción.

## Qué probar

- [ ] Crear recordatorio de cada frecuencia y verificar las ocurrencias programadas
- [ ] Reconciliación idempotente: dos arranques seguidos no duplican
- [ ] Presupuesto de 64: crear el quinto quincenal muestra el aviso, no falla mudo
- [ ] Permiso denegado: el recordatorio se guarda y la UI se degrada correctamente
- [ ] Mensual día 31 en febrero
- [ ] Borrar una lista cancela sus notificaciones
- [ ] Reinstalar la app reprograma desde Supabase
