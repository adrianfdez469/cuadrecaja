# ADR 0111: El orden del historial de ventas lo pone el servidor en memoria, con un comparador puro

**Estado:** aceptado
**Fecha:** 2026-09-10
**Feature:** F-032

## Contexto

Tras F-031, `/ventas` **pinta** la hora reportada de cada venta —`saleReportedAt(sale)`, es decir
`frontendCreatedAt ?? createdAt`— pero se **ordena** por otra cosa: el `GET` de
`src/app/api/venta/[tiendaId]/[cierreId]/route.ts` hace `orderBy: { createdAt: "desc" }` y la
pantalla no ordena en el cliente. Una venta de ayer a las 22:00 sincronizada hoy a las 07:00 queda
por encima de una de hoy a las 06:30: la lista pinta una hora y se ordena por otra.

Las restricciones que había que respetar:

- **Ordenar por la hora pintada es ordenar por `COALESCE(frontendCreatedAt, createdAt)`**, y Prisma
  no lo expresa con un `orderBy` normal.
- **El `where` de ese `findMany` es
  `withTenantScope("venta", { cierrePeriodoId, tiendaId }, scope.negocioId)`**, que con
  `TENANT_RELATION_PATH.venta = ["tienda"]` (`src/constants/tenantScope.ts:23`) resuelve a
  `{ cierrePeriodoId, tiendaId, tienda: { negocioId } }`. Ese helper existe precisamente para que
  la cláusula de tenant **no se vuelva a teclear a mano** en cada consulta.
- **El `include` de ese mismo `findMany` construye cuatro relaciones**: `usuario`, `productos`
  —y dentro de cada línea, `producto.proveedor` y `producto.producto`—, `appliedDiscounts` con su
  `discountRule`, y `transferDestination`.
- **`getSells` trae todas las ventas del período.** La lista se virtualiza (`useVirtualRows`) pero
  **no se pagina**: el cliente recibe el conjunto completo, no una página.
- **Tres consumidores del mismo `GET`**, verificado con grep: `/ventas` (que no ordena),
  `SalesCutoffDialog.tsx` (que ya ordena por su cuenta, ascendente, por `saleEffectiveAt`) y
  `SalesDrawer.tsx` (que ordena sobre un objeto local del POS). Solo el primero depende del orden
  que llega del servidor.
- **Los criterios 2 y 3 exigen determinismo**, no solo corrección: la misma secuencia entre
  recargas y entre anchos, y un par con la hora reportada exactamente igual que no se intercambia.

## Decisión

**El `GET` sigue siendo el dueño del orden, y lo aplica en memoria dentro del handler con una
función pura.** Cuatro partes:

1. Se **elimina** `orderBy: { createdAt: "desc" }` del `findMany`.
2. Se ordena `ventasPrisma` con `compareSalesByReportedAtDesc`
   (`src/lib/venta/saleOrder.ts`) **antes** del `.map` que construye los `IVenta`.
3. El comparador tiene **dos claves**: `saleReportedAt` descendente, y a igualdad, `id` **ascendente
   comparado con `<` y `>` sobre unidades de código**.
4. `/ventas` **no añade ningún `.sort()`**: `Array.prototype.filter` conserva el orden, que es todo
   lo que el buscador necesita.

`where`, `include` y `withTenantScope` **no se tocan en absoluto**.

### Por qué la clave primaria se **llama** y no se reescribe

`compareSalesByReportedAtDesc` invoca `saleReportedAt`. No reimplementa `?? `, y **no tiene ninguna
rama para el `frontendCreatedAt` ausente**, porque para él ese caso no existe: la función ya lo
resuelve a `createdAt`. Ese es justamente el mecanismo por el que esas ventas quedan
**intercaladas** y no agrupadas — el criterio 9 —. Cualquier `if (!a.frontendCreatedAt)` dentro del
comparador sería una segunda definición de la misma regla, que es la forma de E-014 y de E-039.

### Por qué el desempate por `id`, y por qué eso sí es determinista

Sin `ORDER BY`, el orden en que Postgres devuelve dos filas con la misma hora no está especificado,
y `Array.prototype.sort` —estable desde ES2019— **conserva el orden que recibe**, no lo inventa.
Apoyar el criterio 3 solo en la estabilidad del `sort` sería apoyarlo en una entrada que nadie fija.

`Venta.id` es `String @id @default(uuid())`: único por definición del esquema e inmutable. Un
desempate por él convierte la comparación en un **orden total**, así que el resultado no depende del
orden de entrada y es idéntico en cada petición. Es lo que hace ciertos los criterios 2 y 3 a la
vez.

**No `localeCompare`**: su resultado depende de la colación ICU disponible en tiempo de ejecución,
que no es la misma garantía.

**No se añade `createdAt` como clave intermedia.** Sería una tercera regla que solo dispara en un
subconjunto de los empates y que **seguiría necesitando el `id` detrás** —dos ventas pueden
compartir los dos instantes, que es exactamente el par que el criterio 3 siembra—, así que no
compra determinismo: solo añade algo que mantener alineado.

## Alternativas consideradas

| Opción | Por qué no |
|--------|-----------|
| `$queryRaw` con `ORDER BY COALESCE("frontendCreatedAt", "createdAt") DESC` | Obliga a reconstruir **a mano** el `JOIN "Tienda" … AND "Tienda"."negocioId" = $1` que hoy pone `withTenantScope`, y además el grafo de cuatro relaciones del `include`. Reteclear la cláusula de tenant es justo donde este proyecto se ha hecho daño antes, y el aislamiento es la propiedad más crítica del sistema |
| `$queryRaw` solo para los `id` ordenados + `findMany` con `where: { id: { in: ids } }` | `findMany` no respeta el orden de la lista `in`, así que hay que reordenar en memoria **igualmente** — con una ida y vuelta más a la base y la cláusula de tenant partida en dos sitios |
| `orderBy: [{ frontendCreatedAt: "desc" }, { createdAt: "desc" }]` | **Agrupa las nulas**: en `DESC` Postgres las pone primero, y `nulls: "last"` las agrupa al otro extremo. Es el criterio 9 en forma de SQL, exactamente la trampa que ese criterio existe para cerrar |
| Ordenar **solo en el cliente**, en `/ventas` | El `GET` **hoy promete un orden**; esta opción no lo sustituye, lo **retira**. Los otros dos consumidores no se romperían —ya reordenan por su cuenta—, pero ese hecho no distingue esta opción de la elegida: la distingue que aquí cualquier consumidor futuro heredaría un array sin orden y sin aviso |
| Ordenar **después** del `.map` | Ahí `frontendCreatedAt` ya es `Date \| undefined` por el `?? undefined` de la propia línea, y no encaja con `SaleTimestamps`, que lo declara `Date \| null` a propósito para que un consumidor que olvide la columna no compile |
| Conservar el `orderBy` de Prisma «como preorden» junto al `sort` | Dos formulaciones del mismo orden, y la débil parece la verdadera: el siguiente lector borra el `sort` de JavaScript creyendo que la base ya ordena. Es el motivo por el que el ADR 0108 **borró** `deferredSalesCreatedAtFilter` en vez de dejarlo como envoltorio |
| Apoyar el criterio 3 en la estabilidad de `Array.prototype.sort` | Un orden estable conserva el orden que recibe; sin `ORDER BY` ese orden no lo fija nadie |
| `localeCompare` para el desempate | Depende de la colación ICU del entorno |
| Persistir la hora reportada en una columna propia con su índice | Migración más backfill de datos históricos, que el alcance de F-032 excluye explícitamente; y congelaría en la escritura algo que hoy se deriva |
| Un índice sobre `frontendCreatedAt` | No sirve al orden que se necesita: es `COALESCE` de dos columnas, y ningún índice de este esquema lo cubre |

## Consecuencias

**A favor:**

- La lista se ordena por la **misma hora que pinta**: una venta de ayer 22:00 sincronizada hoy a
  las 07:00 queda por debajo de una de hoy a las 06:30 (criterio 1).
- El orden es **determinista**: no depende del orden en que Postgres devuelva las filas, ni del
  ancho de la pantalla, ni de nada del cliente. La misma petición produce el mismo array
  (criterios 2 y 3).
- **El orden sigue siendo una propiedad del endpoint.** Ningún consumidor tiene que repetirlo, y
  los dos que ya reordenan por su cuenta no cambian de comportamiento.
- **`where`, `include` y `withTenantScope` quedan intactos**, que es el beneficio concreto de
  rechazar el SQL crudo, no una consecuencia lateral.
- La regla vive en **una función pura**, sin base de datos y sin red, y por eso el criterio 9 se
  puede probar de verdad.
- El caso del `frontendCreatedAt` ausente **queda intercalado sin ninguna rama que lo trate**,
  porque la comparación se construye **sobre** `saleReportedAt` y no en paralelo a ella.

**En contra / coste asumido:**

- **El orden deja de hacerlo Postgres y lo hace JavaScript**, sobre las ventas de un período
  completo. El coste se mide **contra lo que este handler ya hace por cada una de esas filas** —un
  `include` de cuatro relaciones y un `.map` que construye un objeto anidado—, no contra cero. No
  se afirma que sea despreciable en absoluto: se afirma que es menor que lo que ya se paga.
- **Si algún día `/ventas` se pagina, esta decisión no vale**: un orden en memoria sobre una página
  no es un orden. Habría que llevarlo a SQL y el problema del `$queryRaw` reaparece entero. F-032
  excluye paginar, y esto queda escrito para el día en que deje de excluirse.
- **Quitar el `orderBy` hace que el orden dependa por completo del `sort` en JavaScript.** Si
  alguien lo borra, el resultado pasa a ser indeterminado **sin ningún error**. Lo contiene el test
  del comparador y los criterios 1, 2 y 3, no el compilador.
- **Una venta con `frontendCreatedAt` en el futuro sube al primer puesto de `/ventas`** y se queda
  ahí hasta que el reloj real la alcance. Es coherente con lo que la pantalla pinta —la hora
  reportada **sin acotar**, decidido en el ADR 0108— y **distinto** de lo que hace el diálogo del
  corte, que sí acota con `saleEffectiveAt`. Es deliberado, no una divergencia por descuido.
- **Este cambio no vuelve fiable la hora por la que se ordena.** Ordena por lo que la venta declara
  de sí misma; un reloj atrasado sigue sin detectarse, exactamente igual que antes.
- **Ninguna fila ya guardada se corrige.** El cambio es de lectura y de orden en pantalla.

**Impacto en seguridad y escalabilidad:**

- **Aislamiento: no hay superficie nueva, y la ausencia de superficie nueva es el argumento
  principal contra la alternativa rival.** El `where` no se reescribe, `negocioId` sigue saliendo
  de la sesión (`scope.negocioId`) y no de la ruta ni del cuerpo, y no se añade ninguna ruta,
  ningún parámetro de entrada ni ningún identificador que venga de la petición. El comparador
  recibe dos objetos ya autorizados y no consulta nada.
- **Escalabilidad: ninguna consulta nueva, ningún N+1, ningún índice nuevo.** Se quita una cláusula
  `ORDER BY` del plan —que operaba sobre las ventas de un período ya acotado por
  `cierrePeriodoId`— y se añade un `sort` sobre el mismo conjunto ya materializado.
- **Reversión barata:** no hay migración, ni columna, ni schema nuevo. Revertir el código restituye
  el `orderBy` anterior.
