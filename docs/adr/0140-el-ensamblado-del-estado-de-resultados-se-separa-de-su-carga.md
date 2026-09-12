# ADR 0140: El ensamblado del estado de resultados se separa de su carga, para que «la ganancia es devengada» sea comprobable sin base de datos

**Estado:** aceptado
**Fecha:** 2026-09-10
**Feature:** F-039 (el crédito en los reportes de operación y rentabilidad)
**Se apoya en:** [ADR 0111](0111-el-credito-es-una-columna-no-una-linea-de-pago.md) ·
[ADR 0128](0128-la-reversion-de-un-abono-se-descuenta-de-la-caja-como-un-espejo-en-negativo.md) ·
[ADR 0130](0130-las-dos-cifras-de-flujo-entran-en-los-totales-almacenados.md) ·
[E-015](../../.agents/errors/E-015-un-simbolo-en-un-tsx-no-es-importable-desde-un-test.md) ·
[E-008](../../.agents/errors/E-008-datos-de-prueba-que-no-discriminan.md)

## Contexto

La decisión de producto 2 del epic dice que **la ganancia es devengada**: el margen de una venta a
crédito se reconoce al entregar la mercancía, y `totalVentas` y `totalGanancia` conservan
exactamente su significado actual. F-039 añade al estado de resultados dos líneas informativas —lo
entregado a crédito y lo cobrado de deudas— que **no participan en ningún subtotal**.

Los criterios 5 y 6 existen para impedir que alguien «arregle» esa aritmética restando el crédito de
la ganancia. Son el corazón del feature: el error natural de quien no leyó el dosier.

Y sin embargo, tal como está el código, **no hay forma de comprobarlos con una máquina**.
`buildIncomeStatement` vive en `src/lib/reports/income-statement.ts`, que importa `@/lib/prisma`, y
`src/lib/prisma.ts` **instancia un `PrismaClient` al evaluar el módulo**. Cualquier test que lo
importe construye un cliente y necesita una base. Es la misma regla que
`src/__tests__/deliveryFeeReadVsDeduced.test.ts` ya dejó escrita para `normalizeSale`: «Prisma-backed
and NOT importable as a value from a test».

Así que la garantía más importante del feature quedaría verificada solo por la mirada de una persona
en un navegador, comparando dos escenarios sembrados a mano. Eso es necesario —el criterio 5 lo pide
así— pero no es suficiente: es exactamente el tipo de invariante que hay que poder volver a
comprobar dentro de seis meses, cuando nadie recuerde por qué importaba.

Mirado de cerca, `buildIncomeStatement` hace dos cosas que no tienen nada que ver: **cargar** los
gastos y las tasas (Prisma, asíncrono, `if (closingIds.length > 0)`) y **ensamblar** el objeto
(aritmética pura, líneas 130-167).

## Decisión

**La parte pura se extrae a `src/lib/reports/income-statement-assembly.ts`, con
`assembleIncomeStatement(input): IncomeStatement`. `buildIncomeStatement` conserva su firma y delega
en ella.**

- Los tipos `ExpenseLine` e `IncomeStatement` se mudan al módulo nuevo;
  `income-statement.ts` los re-exporta, así que su superficie pública no cambia. Hoy nadie fuera de
  ese archivo los importa, así que el re-export es higiene y no compatibilidad.
- El módulo nuevo importa **valores** solo de `@/lib/gastos` (`calcularGananciaFinal`, que a su vez
  solo importa `./currency`). Todo lo demás entra con `import type`, incluido `ClosingDeductions`,
  que vive en un módulo con Prisma: un import de valor volvería el módulo nuevo tan poco importable
  como el que se está separando. Es el patrón que `payment-mix.ts` ya usa con `NormalizedSale`.
- `IncomeStatement` gana `creditoOtorgado` y `creditoCobrado`, declarados **después de
  `gananciaFinal`**, para que quien lea la cascada los vea fuera de ella.
- `ClosingDeductions` gana un campo **anidado**, `credito: { otorgado, cobrado }`, en vez de dos
  campos sueltos junto a `totalGastos`, `totalMerma` y `totalDevoluciones`. El tipo se llama
  «Deductions» y estas dos cifras no lo son: anidarlas hace estructuralmente imposible pasarlas por
  error a `calcularGananciaFinal`, que recibe los otros tres por nombre.
- Las dos cifras se **leen** de `CierrePeriodo.totalCreditoOtorgado` y `totalCobrosCredito`
  (ADR 0130, ya calculadas y persistidas por F-032), sumadas con **dos `_sum` más en el agregado que
  `loadClosingDeductions` ya ejecuta**: sigue siendo una sola consulta, con el mismo `where`. No se
  recalculan y no se recorre ningún cierre.
- `creditoCobrado` se declara `z.number()` sin `.nonnegative()`: una reversión de abono lo vuelve
  negativo (ADR 0128), y un schema que lo prohibiera rompería el reporte de un período legítimo.
- En la tabla, las dos líneas **no entran en el array `lines`**. Van en un bloque propio bajo el
  cascade, con el mismo molde que el bloque «Inversión» ya usa para los gastos que salen de caja sin
  reducir la ganancia. No son una fila más con un `type` que la excluya con lógica ad hoc.

### La garantía, escrita como propiedad y no como promesa

Con la extracción, los criterios 5 y 6 dejan de ser una afirmación del contrato y pasan a ser tres
aserciones ejecutables sobre una función pura:

- **P1.** Para dos entradas que difieran **solo** en `deductions.credito`, `assembleIncomeStatement`
  devuelve el mismo valor en todos sus campos salvo `creditoOtorgado` y `creditoCobrado`.
- **P2.** `creditoOtorgado === input.deductions.credito.otorgado` y
  `creditoCobrado === input.deductions.credito.cobrado`: se leen, no se derivan de nada.
- **P3.** `gananciaFinal === margenBruto − gastosOperativos − merma − devoluciones`, con `credito` en
  cualquier valor. Es la suma a mano que pide el criterio 6, hecha por la máquina.

P1 es la que importa, y es la que solo existe gracias a la extracción.

## Alternativas consideradas

| Opción | Por qué no |
|--------|-----------|
| Dejar `buildIncomeStatement` como está | La garantía central del feature quedaría verificada solo mirando una pantalla, con dos escenarios sembrados a mano y sin nada que la vuelva a comprobar mañana |
| Inyectar el cliente de Prisma como parámetro | Cambia la firma pública, obliga a tocar la route handler y convierte cada test en un montaje de dobles. La aritmética no necesita una base de datos falsa: necesita no depender de ninguna |
| Mockear `@/lib/prisma` con `vi.mock` | Un test contra un doble del cliente no prueba la aritmética, prueba el doble. Y el proyecto no tiene ese patrón en ninguna parte |
| Extraer solo un helper que copie las dos cifras de crédito | Un pasaporte trivial cuyo test no discrimina nada (E-008). Lo que hay que poder comprobar es que **el resto** del estado de resultados no se mueve, y eso exige la función que lo construye entero |
| Dos campos sueltos en `ClosingDeductions` | Quedan indistinguibles de las tres deducciones reales en el punto donde más importa distinguirlos: la llamada a `calcularGananciaFinal` |
| Meter las dos líneas en el array `lines` con un `type` nuevo que las excluya | Convierte «está fuera del subtotal» en una condición dentro de un `map`, en vez de en un hecho estructural. El bloque «Inversión» ya resolvió este problema bien en este mismo componente |
| Restar el crédito de la ganancia | Contradice la decisión de producto 2. El criterio 5 existe justamente para atrapar a quien lo intente |

## Consecuencias

**A favor:**

- «La ganancia es devengada» pasa de ser una frase del dosier a ser una propiedad que la suite
  reejecuta en segundos.
- `income-statement.ts` queda con una sola responsabilidad —cargar y convertir— y el módulo nuevo
  con la otra.
- Las dos cifras salen del mismo agregado que ya se ejecutaba: cero consultas nuevas, y la garantía
  de que reportes y cierre muestran el mismo número porque lo leen del mismo sitio.

**En contra / coste asumido:**

- Un archivo más en `src/lib/reports/`, y un `import` de ida y vuelta entre los dos módulos (uno
  importa la función, el otro re-exporta los tipos).
- La extracción mueve código que ningún criterio de F-039 cubría antes. El riesgo se acota en que
  `assembleIncomeStatement` recibe y devuelve exactamente lo que hoy se construye, y en que su
  primer test (P3) es precisamente la cascada que ya existía.
- El `qa` sigue teniendo que ejecutar el criterio 5 en el navegador con el escenario de control: la
  propiedad pura prueba la aritmética, no que las cifras que llegan sean las del período.

**Impacto en seguridad y escalabilidad:**

- **Una consulta, no dos.** Los dos `_sum` se añaden al `prisma.cierrePeriodo.aggregate` que ya
  corría, con su `where` filtrado por `tiendaId` y por el rango. Ni un `findMany` sobre cierres, ni
  un bucle: el coste no crece con el número de períodos del rango.
- El módulo puro no accede a nada: no hay base, ni reloj, ni tasas, ni sesión. No puede filtrar datos
  de otro negocio porque no lee ninguno.
- `totalPorCobrarAlCierre` **no se suma** en ningún sitio: es un stock y sumarlo entre períodos daría
  una cifra sin significado.
