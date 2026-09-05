# ADR 0042: `isValidCronAuth` se extrae a `src/lib/cronAuth.ts`, tocando un archivo de F-002 ya cerrado

**Estado:** aceptado
**Fecha:** 2026-09-04
**Feature:** F-019
**Relacionado:** [ADR 0014](0014-qab-api-base-url-ausente.md)

## Contexto

El repositorio tiene tres crons y **dos** patrones de autenticación distintos:

```ts
// src/app/api/crons/purge-expired-idempotency-keys/route.ts
// src/app/api/crons/purge-expired-freemium-landing-business/route.ts
if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) { … 401 … }
```

```ts
// src/app/api/crons/sync-tienda/route.ts  (F-002)
function isValidCronAuth(authHeader: string | null, secret: string | undefined): boolean {
  if (!secret) return false;
  const expected = Buffer.from(`Bearer ${secret}`);
  const actual = Buffer.from(authHeader ?? "");
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}
```

La diferencia es observable y no es de estilo. Con `CRON_SECRET` sin definir, la plantilla de los dos
primeros produce el string `"Bearer undefined"`; una petición con la cabecera literal
`Authorization: Bearer undefined` hace que la comparación `!==` sea falsa y **la petición pasa**. Son
fail-open frente a una variable sin configurar. El de F-002 devuelve `false` antes de comparar nada,
sin importar qué traiga la cabecera.

El criterio 1 de F-019 exige el segundo patrón. Y hay un detalle que decide este ADR: la función de
F-002 **no está exportada**. Vive dentro de un `route.ts`, así que ningún test puede importarla, y de
hecho `src/__tests__/` no tiene ni un caso sobre ella. La propiedad fail-closed —la que distingue las
dos familias de crons y la que el criterio 1 mide— hoy solo está verificada por un `curl` que alguien
ejecutó una vez, en el cierre de F-002. No hay nada que la defienda de una regresión.

Así que la pregunta no es solo «¿duplico nueve líneas?», es «¿el cuarto cron es el momento de hacer
comprobable la puerta?».

## Decisión

**La función se extrae, sin cambiar una coma de su cuerpo, a `src/lib/cronAuth.ts`, se exporta, y
los dos crons la importan de ahí.**

```ts
// src/lib/cronAuth.ts
export function isValidCronAuth(authHeader: string | null, secret: string | undefined): boolean;
```

`src/app/api/crons/sync-tienda/route.ts` pierde su copia local y su `import { timingSafeEqual }`, y
añade `import { isValidCronAuth } from "@/lib/cronAuth";`. El resto del archivo no se toca.

**Esto toca un archivo de F-002, que está en `passes: true`.** Se dice con todas las letras porque es
lo que hay que valorar, no un detalle de implementación:

- **Qué cambia en el comportamiento de F-002: nada.** Es un movimiento de una función pura sin
  dependencias del módulo que la aloja. El cuerpo se copia literal; el punto de llamada
  (`if (!isValidCronAuth(authHeader, process.env.CRON_SECRET))`) queda igual.
- **Qué se gana:** la propiedad fail-closed pasa a ser un módulo de `src/lib/` con tests unitarios
  —los cinco casos que el `dev-tester` escribe en esta misma corrida—, en vez de nueve líneas
  privadas que nadie puede ejercitar. El criterio 1 de F-019 se verifica ejecutando `curl`, como pide;
  la diferencia es que a partir de aquí **también** hay una regresión que salta si alguien reintroduce
  el patrón fail-open.
- **El precio, y es obligatorio pagarlo:** el `qa` de F-019 tiene que **volver a verificar el criterio
  1 de F-002** sobre `/api/crons/sync-tienda`, en sus tres combinaciones (sin cabecera; con
  `Bearer ${CRON_SECRET}` correcto; con `CRON_SECRET` sin definir y la cabecera literal
  `Bearer undefined`). Un feature cerrado cuyo código se mueve no sigue verificado por el informe de
  su propio cierre. Sin esa re-verificación, este ADR no está cumplido.

**Lo que este ADR deliberadamente NO hace:** arreglar los dos crons fail-open. El alcance de F-019
no los incluye, y meterlos aquí convertiría un feature de purga en un feature de seguridad de otros
dos endpoints, con sus propios criterios de aceptación que nadie ha escrito. La deuda sigue abierta
—ahora con el helper ya disponible y con un ADR que la nombra—, y su arreglo es un feature de dos
líneas por cron el día que se abra.

## Alternativas consideradas

| Opción | Por qué no |
|--------|-----------|
| **Duplicar las nueve líneas en el cron nuevo** | Es la opción de cero riesgo sobre F-002, y tiene tres problemas. Uno: `AGENTS.md` § Prohibiciones dice literalmente que una lógica repetida en dos o más lugares se extrae. Dos: **habrá una tercera copia**, porque los dos crons viejos son fail-open y eso es deuda ya registrada; duplicar ahora garantiza cuatro copias de una puerta de autenticación, que es la clase de cosa que se arregla en tres sitios y se olvida en el cuarto. Tres: la copia nueva tampoco sería exportable ni testeable, así que el criterio 1 de F-019 se quedaría, como el de F-002, defendido solo por un `curl` de una tarde. |
| **Exportar la función desde el propio `route.ts` de F-002 e importarla desde el cron nuevo** | Toca el mismo archivo cerrado (un `export`), así que no ahorra el riesgo que se quería ahorrar, y crea una dependencia de un módulo de ruta a otro: importar un `route.ts` arrastra su grafo de módulos —`runQabSyncTiendaCron`, `qabEnv`, el cliente Prisma dedicado— a cualquier test que quiera probar nueve líneas de comparación de buffers. `src/app/` no es una capa desde la que se importe; `src/lib/` sí. |
| **Extraerla y arreglar de paso los dos crons fail-open** | El arreglo correcto y fuera de alcance. Los dos crons cambiarían de comportamiento observable (una petición con `Bearer undefined` que hoy pasa dejaría de pasar), y eso necesita su propio criterio verificado, no un «de paso». El «No incluye» de F-019 no los menciona porque no son de este feature. |
| **Un middleware o un wrapper `withCronAuth(handler)`** | Más elegante y más superficie: cambia la forma de escribir los cuatro crons, no solo su comparación. Y un wrapper esconde el 401 detrás de una capa, cuando lo que este repositorio quiere es que la puerta se vea en la primera línea del handler. La función devuelve un booleano y el handler decide: es lo que hace legible que sea fail-closed. |
| **Meterla en `src/utils/` en vez de `src/lib/`** | `src/utils/` es para helpers de formato y de permisos de usuario; esto es una comprobación de un secreto de servidor, que es lógica de servidor. `src/lib/` es su sitio, junto a `src/lib/idempotency.ts`, que es el otro helper transversal que consumen las rutas. |

## Consecuencias

**A favor:**
- Una sola definición de la puerta de los crons, en una capa desde la que se puede importar y probar.
- La propiedad fail-closed adquiere tests unitarios por primera vez: cabecera ausente, cabecera
  correcta, cabecera incorrecta de la misma longitud, cabecera de longitud distinta (que es la que
  haría lanzar a `timingSafeEqual` si no se comprobara la longitud antes), y `secret` indefinido con
  la cabecera literal `Bearer undefined`.
- El día que se arreglen los dos crons fail-open, el arreglo es un import.

**En contra / coste asumido:**
- **Se modifica un archivo de un feature cerrado y verificado** (`sync-tienda/route.ts`, F-002), y
  eso obliga a re-verificar el criterio 1 de F-002 dentro de la corrida de F-019. Es trabajo real de
  `qa` que no existiría duplicando.
- Un archivo más en `src/lib/`, con un solo export de nueve líneas.
- Los dos crons fail-open **siguen fail-open** al terminar F-019. Este ADR no los arregla; los deja
  nombrados.

**Impacto en seguridad y escalabilidad:**
- **La única puerta de este endpoint es el secreto compartido**, y no hay sesión de usuario ni
  `negocioId` en juego: por eso `permisos_back.ts` no interviene, igual que en los otros tres crons.
  Un cron de Vercel no es un usuario, así que no hay permiso de usuario que validar — lo que hay que
  garantizar es que sin secreto configurado nadie entre, y eso es precisamente lo que la guarda
  `if (!secret) return false;` hace.
- La comparación sigue siendo en tiempo constante (`timingSafeEqual`) con la comprobación de longitud
  delante, que es lo que evita que la propia función lance en vez de devolver `false`. El movimiento
  no cambia ninguna de las dos cosas.
- Concentrar la puerta en un módulo reduce el riesgo de que la próxima ruta de máquina se escriba con
  el patrón equivocado; no lo elimina, porque nada obliga a importarla. La verificación sigue siendo
  un `grep` de `CRON_SECRET` sobre `src/`, que después de F-019 debe encontrar exactamente cuatro
  apariciones: dos en los crons viejos y dos como argumento de `isValidCronAuth`.
- **Reversión trivial:** volver a pegar la función en cada ruta y borrar el archivo.
