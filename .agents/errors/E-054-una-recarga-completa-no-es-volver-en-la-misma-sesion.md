# E-054: una recarga completa no es «volver en la misma sesión», y el caché parece no funcionar

**Área:** tests
**Apariciones:** 2 — F-025 · F-032 (adenda: `setOffline`)

## Síntoma

Verificando el criterio de caché de F-025 —que al volver a la pantalla las teselas ya vistas se
sirvan del caché y no se vuelvan a pedir— el navegador reportaba `fromDiskCache: false` en **las
dos** visitas. Parecía un incumplimiento de la política del proveedor, y estuvo a punto de ser un
rechazo.

## Causa raíz

La verificación usaba `page.goto()` / `page.reload()`, es decir **una recarga completa de
documento**. Esa pantalla no se navega así: la app cambia de pestaña con `router.replace`, o sea
**navegación de cliente, sin recarga**.

Son dos cosas distintas, y solo una es la que vive el usuario:

- Una recarga de documento reinicia el árbol y **puede revalidar** las subpeticiones.
- Una navegación de cliente desmonta y remonta el componente **dentro de la misma sesión**, y ahí
  es donde el caché HTTP se nota.

Lo que hace este error caro es que **el falso negativo es plausible**: «el caché no funciona» es una
conclusión razonable, y el número que la respalda (`fromDiskCache: false`) es real. Costó tres
intentos descartarlo — CDP directo (`Network.responseReceived`), un repro aislado con un `<img>`
suelto que **sí** cacheaba a la segunda, y por fin un clic real de pestaña.

## Solución

Repetir la comprobación con **una navegación de cliente de verdad**: clic en otra pestaña y vuelta,
sin ningún `page.goto`. Con eso, **cero** peticiones nuevas al host de teselas la segunda vez.

## Cómo evitarlo

**Antes de medir «volver a una pantalla», averigua cómo se vuelve a esa pantalla de verdad.** En
esta app las pestañas de configuración son `router.replace`; un `goto` no reproduce ese camino y
mide otra cosa.

Y la regla general, que aplica a cualquier verificación de caché, de estado en memoria o de
remontaje: **`page.goto` prueba el arranque en frío, no la vuelta.** Si el criterio habla de
«volver», el gesto tiene que ser el que el usuario hace.

Primo de **E-008**: el dato era correcto y la conclusión falsa, porque el escenario no distinguía lo
que se creía distinguir.


---

## Adenda F-032 — `context.setOffline(true)` de Playwright bloquea también `localhost`

El mismo error de fondo —**el arnés no reproduce el gesto real del usuario**— con otro mecanismo,
y este cuesta media hora de desconcierto porque el fallo aparece **lejos** de la causa.

Para verificar los criterios «sin conexión» de F-032 hacía falta modo avión. El gesto intuitivo es
cortar la red y **entonces** navegar a la pantalla:

```
await context.setOffline(true);
await page.goto("http://localhost:3000/pos");   // ERR_INTERNET_DISCONNECTED
```

`setOffline` no distingue el origen: corta **todo**, incluido el propio servidor de desarrollo. Lo
que se obtiene no es una app sin conexión, es una **pestaña muerta** — el bundle nunca se carga, así
que no hay React, no hay caché en `localStorage` que consultar y no hay nada que verificar.

La secuencia correcta, y es la única:

1. Cargar la página **online** y dejar que asiente (el caché que el criterio necesita se puebla
   aquí).
2. **Solo entonces** `setOffline(true)`.
3. **No** recargar ni navegar mientras dure el corte: la SPA sigue viva y esa es exactamente la
   situación que el criterio describe.

Corolario que aplica a cualquier criterio offline de este repositorio: si el escenario dice «el
cajero pierde la red **en mitad de** una venta», el arnés tiene que reproducir ese «en mitad de». Un
arranque en frío sin red no es el mismo caso, y en Playwright ni siquiera es un caso: es un error de
navegación.
