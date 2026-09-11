# F-031 — Auditoría de seguridad del contrato (previa a implementación)

> Escrito por el agente `security-guardian`, paso 4 del pipeline, en paralelo con `arch-guardian`.
> No toca `.agents/specs/F-031.md`, `docs/adr/` ni código. **El código de F-031 todavía no existe:**
> esta auditoría es sobre el contrato de interfaces (`.agents/specs/F-031.md`, líneas 268-1486) y el
> ADR 0111, no sobre una implementación.

## Alcance auditado

- `.agents/specs/F-031.md` completo — spec (líneas 1-266) y contrato de interfaces (líneas 268-1486,
  §0-12).
- `.agents/cuentas-por-cobrar.md` — dosier del epic completo (§1-11).
- `docs/adr/0111-el-credito-es-una-columna-no-una-linea-de-pago.md` — completo.
- `src/constants/tenantScope.ts` (35 líneas) y `src/lib/tenantScope.ts` (`withTenantScope`,
  `mergeTenantClause`, `buildTenantClause`, `decideTenantScope`) — el aislamiento real, hoy.
- `src/__tests__/fixtures/threeTenants.ts` y `src/__tests__/tenantIsolation.test.ts` — el aparato de
  test que va a heredar `criterio 11`.
- `prisma/schema.prisma`: `Proveedor` (802-829), `ProductoProveedorLiquidacion` (848-869), `Tienda`
  (212-265), `Venta` (469-521), `IdempotencyKey` (726-744) — los precedentes que el contrato dice
  espejar.
- `src/schemas/pago.ts` completo — la forma `IPagoLinea` que `MovimientoCuentaPorCobrar.pagosDetalle`
  reutiliza.
- `src/schemas/proveedor.ts` y otros schemas recientes (`movimiento.ts`, `devolucionVenta.ts`,
  `ticketPlantilla.ts`, `plan.ts`, `referral.ts`) — para contrastar la convención de `.max()`.
- `.agents/COMMON_ERRORS.md` → E-042, E-043, E-049 (fichas completas), más E-008, E-023, E-031,
  E-032, E-036, E-038 por referencia cruzada del propio contrato.

Todo lo citado abajo se leyó, no se dedujo. F-031 no ejecuta ninguna consulta a la base de datos —
lo confirma el propio contrato en § 6.3 — así que esta auditoría es sobre **si el diseño del schema
y de las funciones puras deja abierta una puerta que un feature futuro (F-032 a F-039) heredaría sin
saberlo**, no sobre una fuga alcanzable hoy.

---

## 🔴 Hallazgos que bloquean el paso 5

Ninguno impide que el `implementer` empiece a escribir código de F-031 tal como está descrito — no
hay ningún modelo mal formado, ninguna entrada de `TENANT_RELATION_PATH` incorrecta ni ninguna
decisión de producto que reabrir. Pero dos puntos concretos del contrato necesitan una frase escrita
**antes** de fijarse, porque F-031 es la única vez que alguien va a estar mirando estos dos campos
con lupa de tenant — el siguiente feature que los toque (F-034) va a heredar el comentario tal cual
está, no a re-derivar la garantía.

### B1 — `CuentaPorCobrar.tiendaId` no lleva escrito el invariante que lo mantiene atado a `Venta.tiendaId`

**Dónde:** contrato § 2.2 (`.agents/specs/F-031.md:396-400`).

El comentario actual del campo es:

```prisma
/// Direct edge to Tienda. It exists so the tenant clause is ONE hop
/// (TENANT_RELATION_PATH.cuentaPorCobrar = ["tienda"]), not two through Venta.
tienda   Tienda @relation(fields: [tiendaId], references: [id])
tiendaId String
```

Esto explica **por qué** existe el salto directo, pero no dice **qué lo mantiene correcto**. Nada en
el schema obliga a que `CuentaPorCobrar.tiendaId === Venta.tiendaId` de la venta que la originó — no
hay clave foránea compuesta que lo ate (Prisma/Postgres no lo expresan de forma nativa contra una FK
simple), así que la garantía completa depende de que quien cree la fila (F-034, en la misma
`$transaction` que la venta, dosier § 6 "Rutas de venta") derive `tiendaId` **de la misma variable ya
persistida en `Venta.tiendaId`**, nunca de un valor releído por separado ni tomado de otra parte del
payload.

Esto es exactamente la disciplina de "una sola variable, leída una vez" que el propio repo ya exige
en otro sitio (`.agents/F-027-seguridad.md`, Hallazgo 2: "el `negocioId` que entra al emisor y el que
entra al payload deben salir de la MISMA variable"). Hoy esa disciplina no está escrita en ningún
sitio para `CuentaPorCobrar.tiendaId` — ni en el contrato de F-031, ni en el dosier § 6, que solo dice
"crear la `CuentaPorCobrar` en la misma `$transaction` que la venta" sin decir de dónde sale
`tiendaId`.

**Por qué importa de verdad:** si F-034 tomara `tiendaId` de, por ejemplo, un parámetro de ruta
distinto al que ya validó la pertenencia al negocio, o de un valor del body, una `CuentaPorCobrar`
podría nacer con un `tiendaId` que no es el de su propia venta. Como `TENANT_RELATION_PATH` confía
en `CuentaPorCobrar.tienda` como el único salto hacia `negocioId`, esa fila pasaría cualquier chequeo
de `withTenantScope("cuentaPorCobrar", …)` **con el negocio equivocado** — el patrón exacto de
E-042: el camino existe y es correcto en el schema, pero nada impide que la fila lo satisfaga desde
el negocio incorrecto si el escritor no respeta la disciplina.

**No es explotable hoy** — no hay escritor todavía — pero es la clase de garantía que hay que fijar
por escrito **en el contrato de F-031**, no dejarla implícita para que F-034 la invente sola.

**Cambio concreto pedido al `arch-guardian`, en § 2.2:** añadir, justo debajo del comentario actual
del campo `tiendaId`:

```
/// INVARIANT: must equal the tiendaId of the Venta that created this row. Nothing in the
/// schema enforces this — there is no composite FK for it — so the writer (F-034, which
/// creates this row inside the same $transaction as the Venta) MUST derive tiendaId from
/// the same variable already persisted as Venta.tiendaId, never re-read it from the
/// request or take it from a different part of the payload. Same discipline as
/// "single source, read once" already required for negocioId in outbox emitters.
```

### B2 — `MovimientoCuentaPorCobrar.revierteId` no lleva escrito que debe apuntar a un movimiento de la MISMA cuenta

**Dónde:** contrato § 2.3 (`.agents/specs/F-031.md:479-483`) y § 9 (firma reservada,
`.agents/specs/F-031.md:1330-1387`).

```prisma
/// A REVERSION_ABONO points at the ABONO it reverses. NULL for every other tipo.
/// F-031 creates this column and writes nothing into it; F-035 is its first writer.
revierte    MovimientoCuentaPorCobrar?  @relation("ReversionAbono", fields: [revierteId], references: [id])
revierteId  String?
```

`revierteId` es una FK autorreferenciada sin restricción de que el movimiento apuntado pertenezca a
la **misma** `cuentaPorCobrarId` — y por tanto a la misma `CuentaPorCobrar`, que es lo que ata la
fila a un negocio. Nada en el schema impide que una `REVERSION_ABONO` de la cuenta X apunte a un
`ABONO` de la cuenta Y de **otro negocio**: la FK solo exige que la fila de destino exista en
`MovimientoCuentaPorCobrar`, no que comparta `cuentaPorCobrarId`.

F-031 no implementa el escritor (§ 9 lo reserva explícitamente para F-034 o F-035), así que hoy esto
es una firma sin código, no una vulnerabilidad. Pero la firma reservada de
`applyMovimientoCuentaPorCobrar` (§ 9) es exactamente el sitio donde esta guarda tiene que vivir, y
el contrato actual no la menciona — solo dice qué hace la función con `saldoPendiente` y `settledAt`,
no qué valida de `revierteId`.

**Cambio concreto pedido al `arch-guardian`, en § 9**, añadir a la docstring de
`applyMovimientoCuentaPorCobrar`:

```
/// When movimiento.revierteId is present, the implementation MUST verify the referenced
/// row's cuentaPorCobrarId equals `cuentaId` (the same account, and therefore the same
/// tenant) before inserting. A REVERSION_ABONO pointing at another account's movement
/// would misattribute a balance change across accounts — across tenants, if the two
/// accounts belong to different negocios.
```

---

## 🟠 Alta severidad — no bloquean el paso 5 de F-031, pero hay que fijarlos por escrito antes de que F-033/F-035 empiecen

### A1 — Soft delete de `Cliente` con una `CuentaPorCobrar` viva: el contrato no dice qué pasa

**Pregunta del encargo, respondida:** no, el contrato no lo dice en ninguna parte. Revisé el spec
completo, el contrato completo (§0-12) y el dosier completo (§1-11) buscando "soft delete" + "deuda"
/ "CuentaPorCobrar" en la misma frase, y la única mención de soft delete de `Cliente` es sobre el
choque de `@@unique([nombre, negocioId])` al reactivar un nombre (§ 2.1, `.agents/specs/F-031.md:373-380`),
que es un problema distinto (una colisión de alta, no qué pasa con la deuda de un cliente ya
existente que se borra).

**El riesgo real, con nombre:** `Cliente.deletedAt` no nulo no borra ni toca ninguna
`CuentaPorCobrar` — no hay `onDelete` que se dispare (es un `UPDATE`, no un `DELETE`) y no hay
ninguna regla en el contrato que impida marcar `deletedAt` en un cliente con `settledAt IS NULL` en
alguna de sus cuentas. Si el panel de F-035 o el buscador de F-033 filtran clientes por
`deletedAt: null` — el patrón estándar de este mismo repo para `Producto`/`ProductoTienda`, citado
como precedente en el propio spec (`.agents/specs/F-031.md:148-151`) — un cliente con una deuda viva
se volvería invisible en cualquier listado que dependa de esa cláusula, mientras su
`CuentaPorCobrar.saldoPendiente` sigue existiendo en la base de datos. Es exactamente la frase del
encargo: **una deuda que desaparece de la vista al borrar al deudor es un agujero contable, no solo
de seguridad** — y aquí además tiene un componente de seguridad real: es dinero que un negocio cree
haber cobrado (porque ya no lo ve) y no ha cobrado.

**Por qué no bloquea F-031 específicamente:** ninguno de los doce criterios de aceptación de F-031
lo ejercita, F-031 no escribe `api/clientes/**` (es de F-033, dosier § 9) y no hay código de F-031
que dependa de la respuesta. El modelo `Cliente` tal como está definido en § 2.1 no necesita cambiar
para que F-031 pase sus doce criterios.

**Por qué sí hay que fijarlo ahora, no después:** es la única vez que alguien va a estar diseñando
el modelo `Cliente` con este contexto completo delante. Si se deja para que F-033 lo descubra al
escribir el DELETE, hay dos desenlaces malos: (a) F-033 decide una regla sin que el resto del epic
la conozca, o (b) F-033 no lo piensa y simplemente permite el soft delete sin guarda, y el agujero
contable queda abierto hasta que alguien lo note en producción.

**Recomendación concreta** (dos opciones, sin reabrir la decisión de producto — solo señalando el
vacío para que el humano o el `arch-guardian` la cierren):

- **Opción estricta:** el DELETE de `api/clientes/**` (F-033) devuelve 409 si el cliente tiene
  alguna `CuentaPorCobrar` con `settledAt IS NULL`. Mismo molde que el 409 que F-037 ya va a usar
  para "no se puede borrar una venta con abonos" (dosier § 6, tabla "Rutas de venta").
- **Opción pragmática:** permitir el soft delete igual, pero el panel de cuentas por cobrar (F-035)
  y cualquier reporte que muestre saldo pendiente **no filtran por `Cliente.deletedAt`** — muestran
  la deuda con una anotación ("cliente eliminado") en vez de ocultarla.

**Dónde escribirlo:** no es una sección de F-031 propiamente (F-031 no implementa ningún gate), pero
como el modelo `Cliente` es suyo, recomiendo añadir una nota en el contrato § 2.1, justo debajo del
párrafo de "Consecuencia asumida y escrita a propósito" que ya existe para el choque de nombre, con
la misma forma: qué pasa, y a quién le toca (F-033 o F-035, según cuál de las dos opciones elija el
humano). Alternativamente, en el dosier § 5 (Vocabulario), en la fila de `CuentaPorCobrar`.

---

## 🟡 Media severidad — el implementer de F-031 debe conocerlas; recomiendo fijarlas en el contrato porque es barato hacerlo ahora

### M1 — Los campos de texto libre de `Cliente` y `MovimientoCuentaPorCobrar.motivo` no llevan cota de longitud

**Pregunta del encargo (punto 7), respondida.** Comparé `src/schemas/cliente.ts` (§ 3.2 del
contrato) contra los schemas Zod más recientes del repo:

| Schema | Campo | Cota |
|---|---|---|
| `src/schemas/movimiento.ts:129` | `motivo` | `.max(300)` |
| `src/schemas/devolucionVenta.ts:36` | `motivo` | `.max(300, "Máximo 300 caracteres")` |
| `src/schemas/ticketPlantilla.ts:6-18` | `encabezado`/`pie`/`logoUrl` | `.max(500)` |
| `src/schemas/plan.ts:5` | `nombre` | `.max(50, "Máximo 50 caracteres")` |
| `src/schemas/referral.ts:87-88` | `paymentMethod`/`note` | `.max(120)` / `.max(2000)` |
| **Contrato F-031 § 3.2** `clienteSchema`/`createClienteSchema` | `nombre`, `descripcion`, `direccion`, `telefono` | **ninguna** |
| **Contrato F-031 § 3.3** `movimientoCuentaPorCobrarSchema` | `motivo` | **ninguna** |

El contrato justifica la ausencia de cota diciendo que `Cliente` es "molde exacto de `Proveedor`"
(`src/schemas/proveedor.ts:6-9`), que tampoco tiene `.max()` — y es cierto, pero `Proveedor` es deuda
heredada de antes de que esa convención existiera en el repo, no un precedente a copiar a propósito.
`motivo` en `movimientoCuentaPorCobrarSchema` en particular **no tiene ningún precedente que lo
justifique**: es un campo nuevo, del mismo dominio semántico exacto que `MovimientoStock.motivo`
(`src/schemas/movimiento.ts:129`, ya acotado a 300) y `DevolucionVenta.motivo` (ya acotado a 300), y
el contrato no da ninguna razón para que este `motivo` sea el único sin cota.

**Riesgo:** no es una fuga entre tenants ni una inyección — Prisma parametriza y React escapa por
defecto —, es disponibilidad/almacenamiento: un string sin cota en una columna `String` de Postgres
(sin `@db.VarChar`) admite un payload arbitrariamente grande por fila, y `MovimientoCuentaPorCobrar`
es un log **append-only sin purga** (dosier § 5, "el log crece sin cota por cuenta") — la combinación
de "sin cota de tamaño" + "sin cota de crecimiento" es exactamente el tipo de gap que una revisión de
seguridad existe para atrapar antes de que exista una sola fila.

**Cambio concreto pedido al `arch-guardian`:**

- § 3.2, `clienteSchema` y `createClienteSchema`: `nombre: z.string().min(1, "...").max(200, "Máximo 200 caracteres")` (o la cota que el `arch-guardian` prefiera — 200 es coherente con `plan.ts` escalado); mismo tratamiento para `descripcion`, `direccion`, `telefono`.
- § 3.3, `movimientoCuentaPorCobrarSchema.motivo`: `z.string().max(300).nullable().optional()` — igualando el precedente literal de `movimiento.ts` y `devolucionVenta.ts`.

No pido cota en `monedaDeudaCode` (ya es un código corto de tres letras por convención del dominio,
no texto libre) ni en ningún campo que no reciba texto libre de un formulario.

### M2 — `checkCreditInvariant` es más permisivo que la frontera Zod que lo va a alimentar, y hay que dejarlo escrito para que F-034 no se confíe

**Verificado leyendo el código real hoy:** `ventaSchema`/`multimonedaExtrasSchema` (§ 3.4, § 3.5)
declaran `creditoBase: z.number().nonnegative().optional()` — Zod **rechaza** un `creditoBase`
negativo en el borde de la red, antes de que llegue a ninguna función pura.

Pero el propio contrato (§ 5.4, `.agents/specs/F-031.md:1117-1118`) fija que
`checkCreditInvariant` lee sus números con `Number(x) || 0` — y esa coerción **no** normaliza
negativos a 0: `Number(-50) || 0` evalúa a `-50` (es *truthy*), a diferencia de `Number(NaN) || 0` o
`Number(undefined) || 0`, que sí dan `0`. Con `creditoBase = -50` ninguna de las cinco violaciones
del § 5.4 se dispara por esa vía sola (la condición 1 exige `creditoBase > 0`, la condición 4 exige
`creditoBase > total + tolerance`): un `creditoBase` negativo que además viniera acompañado de un
`pagosDetalle` fabricado para que la suma cuadre pasaría como `ok: true`.

**No es un hallazgo bloqueante porque el borde real de la red (Zod) ya lo cierra** — esta función
nunca recibe hoy, ni recibirá en F-031, un `creditoBase` que no haya pasado ya por
`multimonedaExtrasSchema.parse()`. Pero **es exactamente el tipo de suposición implícita que una
revisión futura no va a volver a comprobar**, porque "la función ya lo hace bien" se lee en el código
de `checkCreditInvariant` y no en el llamador. Si algún día `checkCreditInvariant` se llama desde un
sitio que no pasó por Zod primero —un script de recálculo, por ejemplo, el mismo
`scripts/recalculate-cuentas-por-cobrar.ts` que el § 9 reserva— el chequeo dejaría pasar un crédito
negativo silenciosamente.

**Recomendación, no bloqueante:** una frase en § 5.4, junto a la nota de "Number(x) || 0", diciendo
explícitamente que la función **no** normaliza valores negativos y que todo llamador debe garantizar
que sus entradas ya pasaron por la validación Zod correspondiente (`multimonedaExtrasSchema` /
`ventaSchema`) antes de invocarla. Es una línea de documentación, no un cambio de comportamiento —
cambiar `checkCreditInvariant` para clamear negativos sería además incorrecto: enmascararía un dato
corrupto en vez de dejarlo producir `TOTAL_MISMATCH`, que es la señal útil.

### M3 — `IdempotencyKey` es global por `key`, y el dosier no advierte del patrón exacto de E-043 para cuando F-035 la use

**Contexto:** el contrato (§ 2.3, `.agents/specs/F-031.md:500-502`) dirige correctamente a F-035
hacia la tabla genérica `IdempotencyKey` (`prisma/schema.prisma:726-744`) en vez de abrir una columna
`@unique` nueva — comportamiento correcto y alineado con E-043. Pero `IdempotencyKey.key` es
`@id` **global**, no compuesto con `scopeId`: la fila se localiza por `key` sola, y `scopeId` es una
columna adicional para filtrar, no parte de la clave primaria.

Esto es estructuralmente el mismo patrón que **E-043 ya documenta sobre `Venta.syncId`**: una
columna de idempotencia `@unique`/`@id` global es un eje de tenant más. Si el escritor futuro (F-035)
hiciera `prisma.idempotencyKey.findUnique({ where: { key } })` sin comparar también `scopeId` contra
el `negocioId` de la sesión, un cliente de un negocio podría, adivinando o reutilizando la `key` de
otro negocio, leer la `response` cacheada de una operación ajena — el mismo vector que E-043 cerró
para `Venta.syncId` (`findFirst` con `scopeId` en el `where`, nunca `findUnique` por `key` sola).

**No es un hallazgo de F-031**: la tabla `IdempotencyKey` ya existe, F-031 no la toca ni la crea, y
E-043 ya está en la lista de errores conocidos que el dosier cita para este epic (§ 11 del dosier).
Pero la ficha E-043 en sí solo narra el caso de `Venta.syncId`; no menciona `IdempotencyKey` como una
segunda instancia del mismo patrón. Como el propio contrato de F-031 (§ 2.3) es quien introduce a
F-035 a esta tabla por primera vez en el epic, es el sitio natural para dejar la advertencia escrita,
en vez de confiar en que F-035 relea E-043 y haga la conexión sola.

**Cambio concreto pedido al `arch-guardian`, en § 2.3 o § 9:** añadir, junto a la mención de
`IdempotencyKey`:

```
Igual que E-043 documenta para Venta.syncId: IdempotencyKey.key es @id global, no compuesto con
scopeId. Toda lectura debe ser `findFirst({ where: { key, scopeId: negocioId } })`, nunca
`findUnique({ where: { key } })` a secas — ni siquiera en el camino de recuperación de un P2002.
```

---

## 🟢 Baja severidad / informativo

### I1 — `MovimientoCuentaPorCobrar.motivo` es texto libre y puede acumular PII, igual que el resto de campos `motivo` del sistema

No es una clase de riesgo nueva que F-031 introduzca: `MovimientoStock.motivo` y
`DevolucionVenta.motivo` ya son texto libre escrito por el cajero y pueden llevar el nombre de un
cliente, un teléfono, etc. — el mismo perfil de riesgo que `MovimientoCuentaPorCobrar.motivo` hereda.
No pido ningún cambio de comportamiento más allá de la cota de M1; solo lo registro porque el
encargo pregunta explícitamente por él (punto 6).

### I2 — `pagosDetalle` reutilizado verbatim no añade ningún campo nuevo sensible

`pagoLineaSchema` (`src/schemas/pago.ts:4-10`) es `{ tipo, moneda, monto, equivalenteBase,
transferDestinationId? }` — ninguno de los cinco es un secreto ni un dato de cliente más allá de lo
que ya circula en `Venta.pagosDetalle` hoy. Reutilizar la forma exacta (en vez de una redefinición)
es correcto y es exactamente lo que E-039 pide.

### I3 — E-049 (deducir una clasificación de la forma de un identificador): no se encontró ninguna instancia en F-031

Revisé específicamente si algo en el contrato deduce un eje de tenant, un tipo de movimiento o
cualquier clasificación de negocio a partir de la *forma* de un valor (longitud, prefijo) en vez de
leerlo como dato explícito. `monedaDeudaCode` es un código de moneda de referencia, no clasificado
por forma; `TipoMovimientoCuentaPorCobrar` es un enum explícito, no derivado. Sin hallazgo.

---

## Confirmaciones — lo que el contrato ya hace bien y no requiere cambios

Enumeradas porque el encargo pide distinguir con claridad hallazgo real de recordatorio, y porque
tres de las siete preguntas concretas del encargo se responden "está bien, verificado" y merecen
quedar dichas explícitamente, no solo omitidas:

1. **Los caminos de tenant de § 6.1 son los correctos y son los más cortos que existen, verificado
   contra los modelos reales de § 2.2/2.3.** `CuentaPorCobrar.tienda` es una relación directa a
   `Tienda` (campo `tienda`, FK `tiendaId`) — el mismo nombre de campo que usa el segmento
   `["tienda"]` de `TENANT_RELATION_PATH.cuentaPorCobrar`. `MovimientoCuentaPorCobrar.cuentaPorCobrar`
   (campo, no `cuenta`) es la relación que usa el segmento `["cuentaPorCobrar", "tienda"]`. Los dos
   caminos están atados por FKs reales, no por una coincidencia de nombre o de formato (no es
   E-042: el `negocioId` no es una mención, es alcanzable siguiendo relaciones Prisma reales), y el
   propio contrato ya es consciente del riesgo de desalineación de nombres (§ 6.1, la nota sobre por
   qué el campo se llama `cuentaPorCobrar` y no `cuenta`).
2. **La validación "el `clienteId` es del negocio de la venta" está explícitamente asignada, no
   omitida.** El dosier § 2 la fija como la mitad no pura de la primera regla dura; el contrato § 5.4
   dice literalmente "esa mitad... la hace F-034, no esta función" y el ADR 0111 la repite en su
   sección de "Autorización". El contrato de F-031 no cierra la puerta a que F-034 la implemente —
   al contrario, `checkCreditInvariant` deja `CREDIT_WITHOUT_CUSTOMER` como el primer chequeo,
   dejando sitio para que F-034 la complete con la consulta a la base.
3. **`@@unique([nombre, negocioId])` de `Cliente` (§ 2.1) es correcto según E-043**: es un índice
   compuesto con `negocioId`, no una columna `@unique` global. `CuentaPorCobrar.ventaId @unique` no
   es una nueva instancia de E-043: no es una clave de idempotencia proporcionada por un cliente
   externo, es una restricción de cardinalidad (una cuenta por venta) sobre una FK que ya apunta a
   una fila con tenant propio — la garantía de unicidad no cruza tenants porque `Venta.id` ya es
   único globalmente por diseño de Prisma y cada `Venta` pertenece a un solo negocio.
4. **F-031 no añade ninguna ruta ni consulta a la base de datos** (§ 6.3, § 8) — confirmado: no hay
   entradas nuevas en `routeGuards.json` que auditar, y todo lo que este feature aporta al
   aislamiento multi-tenant es estructural (relación directa + entradas de `TENANT_RELATION_PATH`),
   exactamente como el contrato lo describe.
5. **El aparato de test que va a heredar el criterio 11** (`src/__tests__/fixtures/threeTenants.ts`,
   `src/__tests__/tenantIsolation.test.ts`) es sólido: usa homónimo + control (E-008/E-032) en vez de
   una comparación ingenua, y el criterio 11 tal como está escrito en § 11 del contrato ("los tres
   `withTenantScope` del § 6.1, con `toEqual`") es la forma correcta de probar la forma del `where`
   sin necesitar aún filas reales, ya que F-031 no tiene rutas que ejercitar contra la simulación
   completa de homónimo/control — eso les tocará a F-033/032/033 cuando añadan sus propias rutas al
   inventario.
6. **El endurecimiento de `caja.ts`/`tips.ts` (criterio 4) no introduce ninguna fuga de datos**: el
   aviso (`UNKNOWN_PAYMENT_LINE_TYPE_WARNING`, § 4) es un string fijo sin interpolación del objeto de
   pago — exactamente lo que E-031 exige, y el propio contrato ya lo dice explícito en § 7.3.

---

## Veredicto

**Se puede abrir el paso 5.** Ningún hallazgo de esta auditoría reabre una decisión de producto ni
encuentra un modelo mal formado, una entrada de `TENANT_RELATION_PATH` incorrecta, o una fuga
alcanzable hoy — F-031 no ejecuta ninguna consulta, así que no hay superficie que atacar todavía.

Lo que sí pido, antes de que `implementer`/`dev-tester` empiecen, es que el `arch-guardian` amplíe el
contrato con **cuatro anotaciones de texto** (B1, B2, M1, M3) — ninguna cambia una firma, un tipo ni
una decisión ya cerrada, y las cuatro caben en los huecos que el propio contrato ya dejó para notas de
este estilo (los "Consecuencia asumida y escrita a propósito" de § 2.1, o las docstrings de § 2.2/2.3/2.3/9).
Es barato hacerlo ahora, sobre un contrato que nadie ha implementado todavía, y caro después: B1 y B2
son garantías de aislamiento multi-tenant que el próximo feature (F-034) va a asumir por leer el
comentario que encuentre, no por releer esta auditoría.

El hallazgo A1 (soft delete de `Cliente` con deuda viva) no bloquea a F-031 pero **sí necesita una
decisión del humano o del `arch-guardian` antes de que F-033 escriba el DELETE de `api/clientes/**`** —
recomiendo resolverlo en esta misma vuelta de contrato, ya que el modelo `Cliente` que lo origina es
de F-031, aunque quien lo aplique sea otro feature.

**Resumen numérico:** 2 bloqueantes (documentación, no alcance) · 1 alta no bloqueante · 3 medias no
bloqueantes · 3 informativas · 6 confirmaciones explícitas de que el diseño ya es correcto en los
puntos que el encargo pedía verificar.
