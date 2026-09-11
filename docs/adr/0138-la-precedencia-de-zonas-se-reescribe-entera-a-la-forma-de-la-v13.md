# ADR 0138: `zoneTariffPrecedence` se reescribe entero a la forma de la v13, y el nivel se lee del campo declarado — no del `provinceCode`

**Estado:** aceptado
**Fecha:** 2026-09-11
**Feature:** F-039 (catálogo geográfico y función de precedencia)
**Reemplaza la implementación de:** F-026 (deprecated), commit `a9df077`
**Se apoya en:** [ADR 0136](0136-el-catalogo-de-zonas-vive-en-constants-y-su-hash-sale-del-disco.md) ·
[E-032](../../.agents/errors/E-032-una-guarda-mas-ancha-que-la-del-contrato.md) ·
[E-033](../../.agents/errors/E-033-es-es-no-agrupa-los-millares-de-cuatro-digitos.md)

## Contexto

Este repositorio **ya tiene** una función de precedencia de tarifario por zona:
`src/lib/tiendaOnline/zoneTariffPrecedence.ts`, con su test de 259 líneas, escritos en el commit
`a9df077` dentro de F-026 — un feature que hoy está `deprecated` y cuyo `contrato_version` es
`10.1`. Se escribió **antes** de que el contrato publicara la v13, contra la forma que entonces se
anticipaba. No la importa nadie: tiene cero consumidores en todo `src/`.

Y la forma que anticipó no coincide con la que el contrato publicó. Punto por punto:

| Pieza | Lo que hay hoy (F-026, pre-v13) | Lo que publica la v13 |
|-------|---------------------------------|-----------------------|
| Código de zona | 4 dígitos sin punto: `0301` | Forma DPA verbatim con punto: `03.01` |
| Nivel | `level: 1 \| 2` | `level: "FIRST_LEVEL" \| "MUNICIPALITY"` |
| Padre | `parentCode`, opcional, con **fallback por prefijo** de los 2 primeros dígitos | `provinceCode`, declarado por el catálogo; **no existe `parentCode`** en el contrato |
| Catálogo | parámetro opcional `ReadonlyMap` | no participa: la zona llega declarada en la llamada |
| Importe de salida | `deliveryFee?: number`, ausente cuando no hay tarifa | `deliveryFee: string` de dos decimales, o `null`; siempre presente |
| Un escalón del camino | `{ zoneCode, rule: ZoneTariffRule \| null }` | `{ code, level, verdict, decides }` con seis veredictos |
| Firma | `resolveZoneTariff(rows, zoneCode, catalog?)` | recibe la zona declarada y las filas |

No hay ni un campo en común. Y lo más grave está en la línea del padre: la función actual, cuando no
recibe catálogo, **deduce la provincia cortando los dos primeros dígitos del código**. Eso es
exactamente la deducción por forma que el criterio 2 de F-039 existe para prohibir, y que el caso
`V10` del vector caza: una zona `03.40` declarada `FIRST_LEVEL` a la que una implementación así le
aplicaría un segundo escalón que no existe, cobrando al comprador un precio que nadie configuró.

Queda una pregunta más, y es la que decide una rama del código nuevo. En el vector, la zona de `V10`
llega con `level: "FIRST_LEVEL"` **y** `provinceCode: "03"` — un `provinceCode` no nulo en una zona
que no debe tener segundo escalón. O sea: el discriminante **no puede ser** «tiene `provinceCode`».

## Decisión

**Se reescribe el módulo entero contra la forma de la v13, en su misma ruta, y se retira lo que no
entra en F-039.**

1. **La misma ruta, contenido nuevo.** `src/lib/tiendaOnline/zoneTariffPrecedence.ts` y
   `src/__tests__/zoneTariffPrecedence.test.ts` se **sustituyen íntegros**, no se amplían. No queda
   ninguna firma de la versión vieja, ni por compatibilidad: no hay a quién mantenérsela.
2. **El segundo escalón se decide por `level === "MUNICIPALITY"`, nunca por tener `provinceCode`.**
   Es la guarda literal del contrato, y `V10` la prueba. Ampliarla a «tiene provincia» es
   precisamente la clase de ensanchamiento de E-032: pasaría todas sus propias pruebas menos la que
   el vector trae para cazarla.
3. **No hay deducción por forma en ningún sitio.** Ni longitud del código, ni corte de prefijo, ni
   presencia del punto. El módulo nuevo no contiene ninguna constante de longitud de código.
4. **No hay parámetro de catálogo.** La zona llega declarada con `code`, `level` y `provinceCode`.
   Lo confirma el propio vector: en `V9` la provincia consultada es `06`, que **no está** entre las
   zonas del fixture, y aun así el camino la incluye con `level: "FIRST_LEVEL"`. El escalón de
   provincia se construye a partir del `provinceCode` de la zona consultada, no se busca en ningún
   catálogo — y por eso la función sigue siendo pura y sin dependencias.
5. **`resolveCoverage` no se reescribe: se retira.** No tiene consumidores, no lo pide ningún
   criterio de F-039, y especificarlo obligaría a probarlo. Cuando F-041 o F-042 necesiten resolver
   una lista de zonas, se añade entonces, con la forma que esas pantallas pidan.
6. **El importe se formatea con dos decimales y punto decimal, sin formateador de locale.** El
   importe de salida es un dato de cable y no de pantalla: `toFixed(2)` da punto, y el formateador
   de locale español daría coma y rompería la comparación con `"300.00"` del vector (E-033).

## Alternativas consideradas

| Opción | Por qué no |
|--------|-----------|
| Dejar el módulo viejo y escribir el nuevo al lado | Dos implementaciones de la misma regla en el mismo repositorio, una de ellas con deducción por prefijo. La siguiente pantalla importaría la que saliera primero en el autocompletado, y la divergencia sería invisible: el comerciante creería que cobra 300 y cobraría otra cosa. Es el fallo que el contrato dice, con letra, que el vector existe para impedir |
| Adaptar el módulo viejo campo a campo | No queda ni un campo en común: los siete puntos de la tabla cambian. «Adaptar» sería reescribirlo con el riesgo añadido de que sobreviva una rama vieja —el `fallbackParentOf`, sobre todo— por descuido |
| Mover el módulo a una ruta nueva y borrar la vieja | El resultado es el mismo con un rastro peor: `git log --follow` sobre la ruta actual deja de contar la historia. La ruta actual es además la correcta (`src/lib/tiendaOnline/`, donde vive el resto de la integración) |
| Conservar `resolveCoverage` adaptándolo | Un símbolo exportado que ningún criterio pide y que, si se declara, el `dev-tester` tiene que probar (E-035). Su forma útil depende de la pantalla de F-041, que aún no existe: congelarla ahora es adivinar |
| Discriminar el segundo escalón por `provinceCode != null` | Falla `V10` — y falla justo en el caso que el contrato construyó a mano para cazar esta lectura. E-032 literal |

## Consecuencias

**A favor:**
- Queda **una** implementación de la precedencia en el repositorio, y es la que el vector de 13
  casos verifica contra la de QAB caso por caso y camino completo.
- Desaparece del código la deducción del padre por prefijo, que era una trampa latente esperando a
  la Isla de la Juventud.
- La función no depende del catálogo, así que se puede probar y usar con zonas sintéticas —que es lo
  que el vector hace en `V9` y `V10`.

**En contra / coste asumido:**
- Se borran 259 líneas de test que pasaban. Eran correctas para su forma y su forma ya no existe;
  los 13 casos del vector, más los añadidos que el contrato de interfaces enumera, cubren todo lo
  que aquellas cubrían y además el camino completo, que aquellas comparaban solo a medias.
- El borrado cruza la frontera de escritura del paso 5: el `implementer` retira el módulo de
  `src/lib/` y el `dev-tester` retira el test. Va escrito en el contrato de interfaces para que
  ninguno de los dos se lo encuentre por sorpresa.
- Si mañana hiciera falta un tercer escalón (consejo popular / reparto, decisión 1 del humano del
  2026-09-06), esta forma **no** lo admite de forma aditiva: lo dice el spec y lo repite aquí. Sería
  un feature de migración, no una extensión.

**Impacto en seguridad y escalabilidad:**
- **Multi-tenant:** la función es pura y no consulta nada; el aislamiento por `negocioId` no entra en
  ella. Entra en F-041, que es quien persistirá las filas de tarifario por tienda y quien tendrá que
  filtrarlas antes de pasárselas. Escrito aquí porque es fácil leer «tarifario» y suponer que este
  módulo ve datos de varios negocios: no ve datos de ninguno, recibe las filas ya elegidas por su
  llamante.
- **Escalabilidad:** el coste es lineal en el número de filas recibidas y el camino tiene como mucho
  dos escalones. F-041, cuando resuelva la cobertura de 168 municipios de una tienda, hará 168
  llamadas sobre las mismas filas; si eso pesa, la respuesta es indexar las filas una vez fuera del
  bucle, no cambiar esta función.
