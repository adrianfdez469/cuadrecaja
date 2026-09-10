# ADR 0116: F-033 estrena la única puerta de escritura del libro de cuentas por cobrar

**Estado:** aceptado
**Fecha:** 2026-09-09
**Feature:** F-033 (panel de cuentas por cobrar y registro de cobros)

> Concede a F-033 la propiedad de **dos archivos nuevos** dentro de `src/lib/cuentasPorCobrar/`, una
> carpeta cuyo mapa de propiedad enumeraba cuatro archivos y no la cerraba entera. Es la misma
> figura del **ADR 0111** (delegación escrita entre features del epic) y del **ADR 0114** (un
> defecto sin dueño lo arregla el feature al que bloquea), aplicada esta vez a un archivo que **aún
> no existe**.

## Contexto

El dosier del epic (`.agents/cuentas-por-cobrar.md`, § 5) dice que
`applyMovimientoCuentaPorCobrar(tx, cuentaId, movimiento)` **debe ser la única forma de insertar** en
`MovimientoCuentaPorCobrar`, porque `CuentaPorCobrar.saldoPendiente` está denormalizado y deriva en
cuanto alguien escribe el libro por fuera. El comentario de la columna en `prisma/schema.prisma` lo
repite, y el de `revierteId` va más lejos: dice que la comprobación de que un `REVERSION_ABONO`
apunta a un `ABONO` **de la misma cuenta** «vive en `applyMovimientoCuentaPorCobrar`, que es la
única puerta que escribe aquí».

Esa firma existe, pero solo como firma. El contrato de **F-029** la fijó en su § 9 —nombre de
archivo incluido, `src/lib/cuentasPorCobrar/applyMovimiento.ts`— y declinó implementarla, con un
argumento correcto: ninguno de sus doce criterios de aceptación la ejercita y el `qa` no puede
firmar código que no puede ejecutar. **F-032** declinó por lo mismo: crea la `CuentaPorCobrar` al
vender, pero no escribe ni un movimiento, «ese libro lo estrena el primer abono, que es de F-033».

El mapa de propiedad del dosier (§ 9) enumera para F-029 exactamente
`src/lib/cuentasPorCobrar/{saldo,aging,refundSplit,creditInvariant}.ts` y **no dice nada de la
carpeta**. Para F-033 enumera `src/app/cuentas-por-cobrar/**`, `api/cuentas-por-cobrar/**`,
`src/components/MultiCurrencyPayment/**` y `src/constants/cuentasPorCobrar.ts`. Así que el archivo
que hace falta no está prohibido a nadie: no tiene dueño.

Hay un segundo archivo en la misma situación, y aparece al escribir el contrato. El listado del
panel agrega por cliente: suma saldos, cuenta cuentas abiertas, escoge la antigüedad mayor y el
último abono. Eso es **lógica pura** y por **E-015** no puede vivir en un `.tsx`, porque ningún
símbolo de un `.tsx` es importable desde un test en este proyecto. Colocarla en
`src/app/cuentas-por-cobrar/utils/` —territorio propio de F-033— obligaría a la ruta de la API a
importar desde `@/app/**`, y **ninguna de las ~152 route handlers del repositorio lo hace**:
`grep -rn 'from "@/app/' src/app/api src/lib` no devuelve una sola línea. La convención de la casa
es inequívoca: lo que comparten una ruta y una pantalla vive en `src/lib/`.

## Decisión

**F-033 es dueño de dos archivos nuevos dentro de `src/lib/cuentasPorCobrar/`:**

1. **`src/lib/cuentasPorCobrar/applyMovimiento.ts`** — la puerta única de escritura del libro. El
   nombre **no se inventa aquí**: es el que el contrato de F-029 § 9 ya reservó, y se adopta
   verbatim para que no existan dos nombres del mismo archivo (**E-014**). Contiene el vocabulario
   cerrado de rechazos, el núcleo **puro** que decide, y el envoltorio `async` que bloquea la fila,
   inserta y recalcula `saldoPendiente`/`settledAt` dentro de la transacción del llamador. La firma
   pública de F-029 § 9 **no cambia**.
2. **`src/lib/cuentasPorCobrar/panel.ts`** — la agregación pura del listado de deudores y del corte
   por antigüedad, importada por la route handler del listado y por la pantalla.

Nada más de esa carpeta se toca: `saldo.ts`, `aging.ts`, `refundSplit.ts`, `creditInvariant.ts` y
`creditCustomer.ts` son de F-029 y se **consumen** sin cambiarles una firma.

Por la misma razón y con el mismo alcance, F-033 crea `src/schemas/cuentasPorCobrarPanel.ts` (los
schemas Zod de sus propios endpoints) y `src/services/cuentasPorCobrarService.ts`. Ninguno de los
dos existe, ninguno tiene dueño, y `AGENTS.md` fija dónde van: los tipos compartidos en
`src/schemas/`, las llamadas Axios en `src/services/`. El precedente está a la vista dentro de este
mismo epic: **F-031 creó `src/schemas/clienteSaldo.ts` y `src/lib/clientes/clienteSaldo.ts`** sin que
ninguno de los dos figure en su fila del mapa de propiedad.

> **La regla:** un archivo que **no existe** y que **ningún feature posee** lo crea el feature que
> lo necesita, en la carpeta que las convenciones del proyecto le asignan, y con el nombre que un
> contrato anterior haya reservado si lo hay.

## Alternativas consideradas

| Opción | Por qué no |
|--------|-----------|
| **Que F-029 lo hubiera implementado** | Ya se decidió que no, y el argumento sigue en pie: ninguno de sus criterios lo ejercita, así que su `qa` habría tenido que firmar código sin ejecutarlo. La decisión no se revisa; solo se completa nombrando al sucesor |
| **Que la lógica viva dentro de la route handler del abono, sin archivo propio** | Rompe la propiedad central del epic. `saldoPendiente` es denormalizado, y en cuanto haya dos rutas que escriban el libro —el abono, el perdón, la reversión, y mañana el `AJUSTE_DEVOLUCION` de F-035— hay cuatro sitios donde recalcularlo mal. El helper existe precisamente para que sean cero |
| **Poner la agregación del panel en `src/app/cuentas-por-cobrar/utils/` y que la ruta importe de ahí** | Sería territorio propio de F-033 y no necesitaría esta concesión, pero estrenaría un import `@/app/**` desde una route handler que **ningún** archivo del repositorio hace hoy. Inventar una dirección de dependencia nueva para ahorrar un párrafo de ADR es mal negocio |
| **Duplicar la agregación: una copia en la ruta y otra en la pantalla** | Es la prohibición explícita de `AGENTS.md` («si una lógica se repite en dos o más lugares, extraerla»), y la forma exacta de **E-014**: dos definiciones de «cuál es la antigüedad de este deudor» que se corrigen una vez y se olvidan la otra |
| **Abrir un feature aparte solo para el helper** | Mete una dependencia entre features en el cierre de un epic de nueve, para un archivo que solo F-033 va a ejercitar. Y deja la pregunta de fondo —quién lo posee— igual de abierta que estaba |

## Consecuencias

**A favor:**

- El libro tiene **una** puerta de escritura, y la comprobación de `revierteId` que el
  `schema.prisma` promete tiene por fin un sitio donde vivir.
- La firma queda **exactamente** donde F-029 dijo que iba a estar, con el nombre que reservó: quien
  siga la pista desde el contrato de F-029 encuentra el archivo.
- La lógica pura del panel es importable desde un test (**E-015**), y la ruta y la pantalla leen la
  **misma** definición de «cuánto debe este cliente y desde cuándo».
- F-035, cuando escriba su `AJUSTE_DEVOLUCION`, hereda una puerta ya construida y verificada en vez
  de inventar la segunda.

**En contra / coste asumido:**

- **F-033 escribe en una carpeta que el mapa de propiedad asociaba a F-029.** El riesgo de colisión
  es real aunque los archivos sean nuevos: si F-029 tuviera que reabrirse por otra razón, dos
  features tendrían cambios en el mismo directorio. Se acota a **dos archivos nuevos, ninguno
  existente modificado**, y queda escrito aquí.
- **La concesión del coordinador hablaba de UN archivo nuevo; este ADR otorga dos.** No es una
  reapertura de aquella resolución sino su extensión en la misma dirección —la carpeta no tenía
  dueño y F-033 es el primero que la necesita—, pero **es una decisión que el coordinador tiene que
  aceptar explícitamente**. Si la rechaza, la salida es meter la agregación del panel dentro de
  `applyMovimiento.ts`, y entonces el nombre del archivo deja de describir su contenido.
- **La regla se puede leer de más.** «Lo crea quien lo necesita» vale para un archivo que **no
  existe**. Modificar uno que sí existe y tiene dueño sigue exigiendo una delegación escrita
  (ADR 0111) o un defecto verificado que bloquee un criterio (ADR 0114).

**Impacto en seguridad y escalabilidad:**

- **Seguridad:** es la consecuencia principal. La guarda de `revierteId` —que el `ABONO` revertido
  pertenezca a **esta** cuenta y por tanto a **este** tenant— es la única defensa contra una
  reversión que mueva el saldo de otro negocio: la FK autorreferenciada solo comprueba que la fila
  destino **existe**. Sin este archivo, esa guarda no está en ninguna parte.
- **Escalabilidad:** el helper hace una lectura con bloqueo, una inserción y un `update` por
  movimiento. No recorre el libro: el saldo se calcula como incremento sobre la columna
  denormalizada, no recomputando la historia. Un libro de miles de movimientos no lo cambia.
- **Reversión:** son dos archivos nuevos y ningún dato. Borrarlos deja el repositorio como estaba.
