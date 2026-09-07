# ADR 0095: El SQL espejo se copia verbatim, el hash se calcula en JavaScript sobre filas ya leídas, y tres chequeos lo atan a su origen

**Estado:** aceptado
**Fecha:** 2026-09-06
**Feature:** F-008

## Contexto

El § ⑤ del contrato de QAB (v11, verificado contra la v12.1) publica el **SQL espejo**: la
sentencia exacta, «lista para copiar contra el schema de cuadrecaja», que calcula
`{ products, hash }` sobre el catálogo publicado de una tienda. Lleva cinco decisiones que no se
deducen del pseudocódigo, el orden de bytes `COLLATE "C"`, una serialización del precio con dos
`trim(trailing ...)` anidados, y —desde la v11, al cerrarse S-002— las dos condiciones
`p."deletedAt" IS NULL` y `pt."deletedAt" IS NULL`.

El contrato es explícito sobre lo que está en juego y lo escribe él mismo:

> La exclusión la hace el lado que tiene la columna […] y queda escrita aquí, y no deducida por
> cada lado, porque **un espejo que cada uno ajusta por su cuenta para que le cuadre deja de
> detectar lo que existe para detectar**.

Dos restricciones tiran en direcciones opuestas:

- **El criterio 6 es inamovible** y exige un test unitario en `src/__tests__/` que alimente el
  vector del § ⑤ —cuatro filas literales— a «la función de hash de cuadrecaja» y obtenga
  `products = 4` y `hash = 62e399684e3a8eafadaae58391537955`. Vitest corre con `environment: "node"`
  y **sin base de datos**.
- **Parafrasear el espejo es peor que copiarlo.** Es la forma exacta de
  [E-039](../../.agents/errors/E-039-el-contrato-parafrasea-una-definicion-que-ya-existe.md): una
  descripción «con nuestras palabras» de un mecanismo ajeno no hereda sus casos borde, y quien la
  lee después programa contra la paráfrasis. Y el bloque de código de un contrato **se lee como
  plantilla**, no como prosa ([E-010](../../.agents/errors/E-010-comentarios-de-ejemplo-en-espanol-en-un-contrato.md)):
  va a acabar en `src/` tal cual.

## Decisión

**Tres piezas, y ninguna de las tres es una paráfrasis.**

### 1. El espejo se copia verbatim en tres constantes

En `src/constants/qab.ts`:

- `QAB_RECONCILIATION_MIRROR_SQL` — el § ⑤ **carácter por carácter** (sin el `;` final).
  **No se ejecuta**: es el origen al que se atan las otras piezas, y la referencia que un humano
  diffea contra el documento. Junto a ella,
  `QAB_RECONCILIATION_MIRROR_CONTRACT_VERSION = "v11"` dice de qué versión se copió.
- `QAB_RECONCILIATION_MIRROR_FROM_JOIN_SQL` y `QAB_RECONCILIATION_MIRROR_WHERE_TAIL_SQL` — la mitad
  que **sí** se ejecuta, partida **exactamente donde el contrato escribe su `$1`**: la primera
  llega hasta `WHERE pt."tiendaId" = ` y la segunda empieza en el primer `AND`.

El lector las ejecuta en **una** plantilla etiquetada de `qabPrisma.$queryRaw`, con `Prisma.raw`
sobre los dos fragmentos —y sobre nada más— y el `tiendaId` y el límite como parámetros ligados de
la plantilla:

```ts
const fromJoin  = Prisma.raw(QAB_RECONCILIATION_MIRROR_FROM_JOIN_SQL);
const whereTail = Prisma.raw(QAB_RECONCILIATION_MIRROR_WHERE_TAIL_SQL);
const rows = await qabPrisma.$queryRaw<unknown[]>`
  SELECT pt."id", pt."precio", pt."monedaPrecioCode", pt."dispPublicada"
  ${fromJoin} ${tiendaId} ${whereTail}
  LIMIT ${maxRows + 1}
`;
```

**Por qué partido en dos y no de una pieza:** una plantilla etiquetada numera sus propios
marcadores, así que un `$1` literal dentro de un `Prisma.raw` chocaría con el que Prisma emite. Al
cortar justo ahí se conserva el texto del contrato byte a byte **y** el parámetro queda ligado.
Reensamblarlos como `FROM_JOIN + "$1" + WHERE_TAIL` reproduce el § ⑤, y eso es exactamente lo que
comprueba el chequeo 1 de abajo — verificado ejecutándolo contra el documento antes de prescribirlo.

Es el patrón de [ADR 0048](0048-la-consulta-de-divergencia-se-ejecuta-en-sql-crudo-con-la-expresion-en-una-sola-constante.md),
el mismo que `readDivergentAvailabilityRows` usa con `QAB_AVAILABILITY_CASE_SQL`. **`$queryRawUnsafe`
no se usa**: una versión anterior de esta decisión lo prescribía para conservar el `$1`, y
`security-guardian` lo objetó con razón en el paso 4 (C3 de `.agents/F-008-seguridad.md`); el corte
en dos fragmentos consigue lo mismo sin salirse del patrón establecido.

El `SELECT` proyecta esas cuatro columnas y ninguna más, ni para depurar: `existencia`, `umbralBajo`,
`costo` y el proveedor se quedan en la base, la misma disciplina que
`readDivergentAvailabilityRows` documenta para su propia proyección.

### 2. El hash se calcula en JavaScript, sobre filas ya leídas

```ts
export function computeQabCatalogHash(rows: IQabMirrorRow[]): IQabCatalogHash;
```

**Recibe las filas, nunca un cliente de base de datos y nunca un `tiendaId`.** Eso es lo que hace
ejecutable el criterio 6, y es exactamente para lo que el propio contrato publica el vector:
«para autoverificarse sin nuestra base». Su lado también es una traducción verificada contra ese
vector, no el SQL.

Las tres reglas del agregado se traducen así, y cada una **cita** en vez de describir:

- **Orden.** `ORDER BY pt."id" COLLATE "C"` → `Buffer.compare` sobre las codificaciones UTF-8 de
  los dos ids. **No** `a < b`, que compara unidades de código UTF-16 y da otro orden por encima del
  BMP, y **no** `localeCompare`, que es una colación, que es justo lo que el contrato prohíbe.
- **Precio.** `trim(trailing '.' from trim(trailing '0' from round(pt."precio"::numeric, 2)::text))`
  → `String(toQabPrice(precio))`, donde `toQabPrice` (`src/schemas/qabDecimals.ts`,
  [ADR 0047](0047-dos-escalas-decimales-y-dos-helpers.md)) es **la** definición de la regla de
  precio del contrato en este repositorio. La forma decimal de un número de JavaScript nunca lleva
  ceros a la derecha, así que aterriza donde aterrizan los dos `trim`. Comprobado ejecutándolo
  sobre los cuatro valores del vector: `1990`, `1990.5`, `1990.1`, `0`.
- **Disponibilidad.** `coalesce(pt."dispPublicada", 'AVAILABLE')` →
  `row.dispPublicada ?? QAB_RECONCILIATION_DEFAULT_AVAILABILITY`, declarada con `satisfies` desde
  `QAB_AVAILABILITY`.

### 2b. El veredicto compara `products` además del hash

`compareQabCatalogHashes` da `"match"` solo cuando **los dos** campos coinciden. Es
deliberadamente más ancho que el § ⑤, que solo habla del hash: dos hashes iguales con cuentas
distintas significa que uno de los dos lados está roto, y la lectura segura de «roto» aquí es
«reenviar todo», que es lo que hace una divergencia. Es una rama que el contrato ajeno no tiene, y
por eso es la que nadie recordaría probar
([E-032](../../.agents/errors/E-032-una-guarda-mas-ancha-que-la-del-contrato.md)); tiene su caso
propio en la lista de testabilidad del contrato de interfaces.

`products` es `rows.length`, y el lector **jamás devuelve un conjunto truncado**: por encima de
`QAB_RECONCILIATION_MAX_ROWS_PER_STORE` devuelve `tooLarge: true` y `rows: []`, y la tienda se
reporta `too_large` sin escribir nada. La guarda está en el lector y no en la disciplina de quien
lo llama, porque hashear un conjunto truncado produce una divergencia falsa, y una divergencia
falsa borra el `dispPublicada` de una tienda entera.

### 3. Tres chequeos atan las piezas a su origen

| # | Qué ata | Cómo | Corre en un `npx vitest run` limpio |
|---|---------|------|--------------------------------------|
| 1 | Nuestras copias entre sí | `FROM_JOIN + "$1" + WHERE_TAIL` es substring, insensible a espacios, de `QAB_RECONCILIATION_MIRROR_SQL` | **Sí** |
| 2 | Nuestro hash contra el contrato | El vector del § ⑤ y el hash de la tienda vacía sobre `computeQabCatalogHash` | **Sí** |
| 3 | Nuestra copia contra el documento | `QAB_RECONCILIATION_MIRROR_SQL` es substring, insensible a espacios, del `sync-contract.md` de `$QAB_DOCS_PATH` | **No**: se salta sin la variable |

El chequeo 1 es lo que hace que el `WHERE` que se ejecuta **no pueda** divergir del del contrato sin
poner un test en rojo — incluidas las dos condiciones de `deletedAt`, que son el cambio de la v11 y
la razón por la que este feature estuvo bloqueado.

`normalizeSqlWhitespace` ya existe (`src/lib/qab/qabAvailabilityPlan.ts:182`) y es la misma que usa
el chequeo de deriva de F-007 entre `QAB_AVAILABILITY_CASE_SQL` y su migración
([ADR 0048](0048-la-consulta-de-divergencia-se-ejecuta-en-sql-crudo-con-la-expresion-en-una-sola-constante.md)).
Se reutiliza; no se escribe otra.

El chequeo 3 se salta porque `vitest.config.ts` no carga `.env`, así que **es un paso del gate y no
una comprobación de fondo**:

```bash
QAB_DOCS_PATH="$QAB_DOCS_PATH" npx vitest run src/__tests__/qabReconciliationMirrorSql.test.ts
```

Se escribe con `it.skipIf` y con el motivo en el nombre del caso, para que un `npx vitest run`
limpio no parezca haberlo verificado. **No se guarda ninguna copia del contrato en este
repositorio**: una copia vieja de un contrato es peor que no tenerla.

### 4. La regla de arbitraje, escrita

> **Si el hash local y el de QAB divergen sobre datos que están bien, no se ajusta el nuestro.**
> Se averigua cuál de las dos lecturas es la del § ⑤ y se corrige la que no lo sea, o se abre una
> solicitud en `.agents/solicitudes-qab.md`.

Y su corolario, que es una prohibición: **al `WHERE` del espejo no se le añade ni se le quita
ninguna condición**. Ni un filtro por `negocioId`, ni un filtro de precios con más de dos
decimales, ni un `t."publicarEnTienda"`.

### 5. La desviación de tenant que esto obliga a aceptar

`readQabMirrorRows` ejecuta el `WHERE` del § ⑤ **sin** añadirle `t."negocioId" = $2`, aunque la
regla del proyecto sea que toda consulta filtre por `negocioId`. Es una desviación deliberada, y la
razón es que **la condición crearía un modo de fallo peor que el que evita**: con el join de tenant,
un `tiendaId` ajeno y una tienda vacía dan **el mismo resultado** —cero filas—, es decir el hash
`d41d8cd98f00b204e9800998ecf8427e`, que es un hash *legítimo* que el propio contrato publica. Una
fuga de tenant se convertiría en una divergencia silenciosa que borra el `dispPublicada` de una
tienda entera.

La frontera está **antes y es explícita**: el `tiendaId` sale exclusivamente de
`readQabReconciliationCandidates`, que filtra `Tienda.negocioId = ANY(negocioIds)` sobre los
negocios elegibles, y el `negocioId` que acompaña a cada objetivo sale de **la misma fila** de
`Tienda`, no de ninguna entrada externa. Las dos escrituras que derivan de esa lectura —
`clearDispPublicadaForStore` y `markQabReconciliationAttempt` — sí llevan `tienda: { negocioId }`
en el `where`, siguiendo [ADR 0050](0050-confirmed-decide-la-escritura-y-el-valor-lo-pone-el-lote-enviado.md)
y [ADR 0085](0085-el-where-de-f-022-reutiliza-withtenantscope-y-la-unica-escritura-pasa-por-updatemany.md).

Queda anotado aquí y en el § 7 del contrato de interfaces para que un barrido de seguridad no lo
cuente como ruta desprotegida por no encontrar la palabra, ni lo exima en bloque «porque otra cosa
lo cubre» ([E-042](../../.agents/errors/E-042-un-barrido-cuenta-una-mencion-como-si-fuera-un-filtro.md)).

## Alternativas consideradas

| Opción | Por qué no |
|--------|-----------|
| Ejecutar el § ⑤ entero en Postgres y que ese sea el hash local | Es la opción más fiel al contrato, y **hace inverificable el criterio 6**: Vitest no tiene base de datos. Dejar además una función de hash en JavaScript solo para el test la vuelve decorativa —probaría algo que producción no usa—, que es justo lo que el `qa` busca y rechaza |
| Ejecutar el § ⑤ en Postgres **y** el hash en JavaScript en cada corrida, comparándolos | Detectaría la deriva de forma continua y es defendible, pero duplica las consultas, y sobre todo **añade un tercer veredicto** («nuestras dos lecturas locales no coinciden») que ningún criterio de aceptación menciona. Una guarda más ancha que el contrato es la forma de [E-032](../../.agents/errors/E-032-una-guarda-mas-ancha-que-la-del-contrato.md) |
| Reconstruir el `WHERE` con el constructor de consultas de Prisma | Legible y tipado, y es **exactamente** la paráfrasis que E-039 prohíbe: el espejo dejaría de ser copiable y comparable con su origen, y las dos condiciones de `deletedAt` volverían a ser algo que cada lado deduce |
| `$queryRawUnsafe` con el `WHERE` de una pieza, `$1` incluido | Era la prescripción inicial de este ADR y la retiró la objeción C3 de `security-guardian`: sale del patrón de ADR 0048 sin necesidad, porque partir el fragmento en el `$1` conserva igualmente la copia verbatim |
| Una plantilla etiquetada con el `WHERE` de una pieza, `$1` incluido dentro del `Prisma.raw` | El `$1` literal choca con el que numera la plantilla. Es lo que obliga a partirlo en dos, no a abandonar la plantilla |
| Añadir `t."negocioId" = $2` al espejo, por la regla del proyecto | Convierte una fuga de tenant en el hash de la tienda vacía —un valor legítimo— y por tanto en una divergencia silenciosa que borra una tienda entera. Y rompe la copiabilidad verbatim. Ver el § 5 |
| Filtrar en el espejo los precios con más de dos decimales | Es una condición que el contrato no tiene, y el propio contrato dice que ese caso diverge de forma permanente y que «el arreglo no está de este lado». Añadirla es ajustar el espejo para que cuadre |
| Guardar una copia de `sync-contract.md` en este repositorio para que el chequeo 3 corra siempre | `AGENTS.md` lo prohíbe explícitamente, y con razón: una copia versionada se queda vieja en silencio, y una copia vieja de un contrato es peor que no tenerla |

## Consecuencias

**A favor:**

- El criterio 6 es ejecutable con `npx vitest run`, y el test prueba **la función que producción
  usa**, no una réplica.
- El `WHERE` que se ejecuta no puede divergir del del contrato sin un test en rojo, y eso incluye
  las dos condiciones de `deletedAt` que costaron el bloqueo de este feature.
- La regla del precio no se reescribe: se aplica `toQabPrice`, la definición única del repositorio.
- La regla de arbitraje está escrita, así que la próxima divergencia se resuelve averiguando cuál
  de las dos lecturas es la del contrato, y no retocando la nuestra hasta que cuadre.
- La verificación del contrato ajeno queda ligada a su versión (`v11`, y la comprobación de que la
  v12 y la v12.1 no tocaron el § ⑤), no a un «lo copié en su día».

**En contra / coste asumido:**

- **La traducción del agregado existe**, y por tanto puede divergir del SQL del § ⑤ en algún caso
  que ni el vector ni los tests del § 9 del contrato cubran. Se acota con tres cosas y hay que
  decirlas juntas: el vector, los tests explícitos de orden de bytes y de serialización, y **una
  verificación que solo el `qa` puede hacer** —ejecutar `QAB_RECONCILIATION_MIRROR_SQL` tal cual
  contra la base y comparar con `computeQabCatalogHash`—. El propio contrato ajeno dice que los
  nombres de columna, el `JOIN` con `Producto` y el `coalesce` de `dispPublicada` solo los puede
  verificar este lado ejecutando ese SQL contra su propia base.
- **Con precios de más de dos decimales, la traducción difiere del SQL** igual que `toQabPrice` ya
  difiere de Postgres (`2.675` → `"2.67"` aquí, `2.68` allí). No es una divergencia nueva: es la
  que el contrato documenta como precondición del § ①, con el arreglo fuera de los dos lados. Este
  feature **no** la corrige y **no** filtra esas filas.
- Un precio con parte entera absurda (a partir de 10²¹, muy por encima del `Decimal(14,2)` que el
  contrato declara) se serializaría en notación exponencial. Está fuera del rango del contrato y no
  se le añade un filtro, por la misma prohibición del § 4.
- **El chequeo 3 no corre solo.** Depende de que quien ejecute el gate tenga `QAB_DOCS_PATH`
  exportada. Se mitiga con `it.skipIf` y el motivo en el nombre del caso, y con el comando escrito
  en el contrato; no se mitiga del todo.
- **El `WHERE` del espejo vive partido en dos constantes.** Leerlo de corrido exige juntarlas
  mentalmente, y el `$1` que las separa no está en ninguna de las dos. El coste se paga una vez y lo
  cubre el chequeo 1, que es lo que garantiza que el reensamblado sigue siendo el del contrato;
  `QAB_RECONCILIATION_MIRROR_SQL` sigue ahí, de una pieza, para leerlo entero.

**Impacto en seguridad y escalabilidad:**

- **Inyección:** la sentencia se compone de constantes de compilación y de nada más, y
  `tiendaId` y el límite viajan como parámetros ligados. No hay ninguna posición de la cadena que
  provenga de una entrada, y esa es la propiedad concreta que hay que revisar si alguien añade un
  parámetro más.
- **Aislamiento:** una desviación declarada y acotada (§ 5), con la frontera desplazada a la
  lectura que produce el `tiendaId` y repetida en las dos escrituras. Es material para
  `security-guardian`, no algo que se dé por resuelto aquí.
- **Escalabilidad:** el espejo se apoya en `@@index([tiendaId, deletedAt])`, que ya existe en
  `ProductoTienda`. La lectura corre sobre `qabPrisma` ([ADR 0015](0015-pool-de-conexiones-dedicado-para-el-drenaje.md)),
  así que un escaneo de catálogo no retiene una conexión del pool por el que el POS vende. El tope
  por tienda impide materializar un catálogo arbitrariamente grande en una función serverless.
- **Fuga de datos por el informe:** el informe publica `hashMatch` y los dos `products`, no los dos
  hashes, siguiendo la regla de «ids, cuentas y códigos» de las demás fases. Del cuerpo de QAB no
  se loguea nada.
