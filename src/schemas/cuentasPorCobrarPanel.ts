import { z } from "zod";
import { movimientoCuentaPorCobrarSchema } from "@/schemas/cuentaPorCobrar";
import { pagoLineaSchema } from "@/schemas/pago";
import { ventaSchema } from "@/schemas/venta";
import { AGING_BUCKETS } from "@/lib/cuentasPorCobrar/aging";
import { hasControlCharacters } from "@/utils/printableText";

/**
 * The bracket vocabulary of the API is DERIVED from AGING_BUCKETS, never retyped: that array is
 * the only definition of the brackets in the project (E-014).
 */
export const agingBucketEnum = z.enum(
  AGING_BUCKETS.map((b) => b.bucket) as [string, ...string[]],
);

/** Two values, and only two: there is no such thing as an overdue debt here (progress, Q1). */
export const DEUDOR_ESTADOS = ["CON_DEUDA", "SALDADA"] as const;
export const deudorEstadoEnum = z.enum(DEUDOR_ESTADOS);

/* ------------------------------------------------------------------ listing */

export const cuentasPorCobrarFiltrosSchema = z.object({
  tiendaId: z.string().uuid().optional(),
  clienteId: z.string().uuid().optional(),
  antiguedad: agingBucketEnum.optional(),
  estado: deudorEstadoEnum.optional(),
});

/** One live account, as the listing and the detail both show it. */
export const cuentaAbiertaSchema = z.object({
  id: z.string().uuid(),
  ventaId: z.string().uuid(),
  tiendaId: z.string().uuid(),
  tiendaNombre: z.string(),
  fechaVenta: z.coerce.date(),
  montoOriginal: z.number(),
  saldoPendiente: z.number(),
  settledAt: z.coerce.date().nullable(),
  monedaDeudaCode: z.string().nullable(),
  montoDeudaMonedaOriginal: z.number().nullable(),
  /** daysOutstanding(fechaVenta, at) — the `at` of the response, never Date.now(). */
  dias: z.number().int(),
  bucket: agingBucketEnum,
  /**
   * The id of the store's OPEN CierrePeriodo at `at`, or null when it has none.
   *
   * It travels in the response so "is there an open till" is a deterministic property of the
   * data the screen already has, instead of a second request that can fail and leave a third,
   * unknown state. A collection can only land in an open period (criterion 7), so the screen
   * disables the action, with its reason visible, exactly when this is null.
   *
   * It is a READ of `CierrePeriodo`, never a write: § 11 forbids touching `api/cierre/**`, not
   * reading the table the routes of this feature already have to read to answer 409.
   */
  cierrePeriodoAbiertoId: z.string().uuid().nullable(),
});

export const deudorRowSchema = z.object({
  clienteId: z.string().uuid(),
  clienteNombre: z.string(),
  telefono: z.string().nullable(),
  /** Sum of saldoPendiente over `cuentas`, rounded to two decimals. */
  saldo: z.number(),
  cuentasAbiertas: z.number().int(),
  /** Highest `dias` among `cuentas`. null when there is none. */
  antiguedadDias: z.number().int().nullable(),
  antiguedadBucket: agingBucketEnum.nullable(),
  /** `fecha` of the most recent ABONO of this cliente. null when it never paid one. */
  ultimoAbonoAt: z.coerce.date().nullable(),
  estado: deudorEstadoEnum,
  cuentas: z.array(cuentaAbiertaSchema),
});

export const cuentasPorCobrarListResponseSchema = z.object({
  /** The instant the whole response was measured against. Echoed so aging is reproducible. */
  at: z.coerce.date(),
  total: z.number().int(),
  data: z.array(deudorRowSchema),
});

/* ------------------------------------------------------------------- detail */

/**
 * A ledger entry as the DETAIL projects it: the persisted row plus the name of whoever registered
 * it, resolved by the route with `usuario: { select: { nombre: true } }`.
 *
 * It EXTENDS the read schema of F-031 instead of replacing it, and it exists ONLY on the read
 * side: neither the table nor the write path gains a column. A ledger of destructive, permanent
 * operations that cannot say WHO forgave a debt is not an audit trail — and `usuarioId` alone
 * forces every reader into a second query.
 *
 * `usuarioNombre` is null for a row whose `usuarioId` is null, and for a user deleted since.
 */
export const movimientoCuentaPorCobrarConAutorSchema =
  movimientoCuentaPorCobrarSchema.extend({
    usuarioNombre: z.string().nullable(),
  });

export const cuentaPorCobrarDetalleSchema = cuentaAbiertaSchema.extend({
  clienteId: z.string().uuid(),
  clienteNombre: z.string(),
  movimientos: z.array(movimientoCuentaPorCobrarConAutorSchema),
});

export const cuentaPorCobrarDetalleResponseSchema = z.object({
  at: z.coerce.date(),
  cuenta: cuentaPorCobrarDetalleSchema,
});

export const deudorDetalleResponseSchema = z.object({
  at: z.coerce.date(),
  cliente: z.object({
    id: z.string().uuid(),
    nombre: z.string(),
    telefono: z.string().nullable(),
  }),
  saldo: z.number(),
  /** Every account of the cliente, live and settled, newest first, each with its sale. */
  cuentas: z.array(
    cuentaPorCobrarDetalleSchema.extend({ venta: ventaSchema.nullable() }),
  ),
});

/**
 * THE SCHEMA THE CLIENT PARSES THE DEBTOR DETAIL WITH, and the reason it is not the one above.
 *
 * Everything crossing the wire arrives as JSON, so every `Date` arrives as a STRING. Nothing on
 * this screen may assume otherwise: `buildMovimientoRows` sorts with `fecha.getTime()`, and
 * `Array.prototype.sort` does not call the comparator with fewer than two elements — so an
 * account with a single movement hides the fault and the second one brings the whole page down.
 * Running the response through Zod is what turns those strings back into `Date`, because
 * `z.coerce.date()` is declared once, here, and not re-derived at each call site.
 *
 * `venta` is handed through UNVALIDATED, and that is a DECLARED exception, not an oversight:
 * `mapVentaToIVenta` (`src/lib/ventaMapper.ts`, F-037) fills `usuario.usuario` with `""`, while
 * `usuarioSchema` demands `.min(1)`. VERIFIED BY RUNNING IT: `ventaSchema.safeParse` of what the
 * mapper produces fails with `too_small` at `["usuario","usuario"]`. Parsing it would throw on
 * every debtor that has a sale — a worse fault than the one being fixed. The mapper and
 * `src/schemas/usuario.ts` both belong to other features (contract § 11), so F-035 narrows what
 * IT parses instead of touching either; the deuda is recorded in the implementation report.
 *
 * DERIVED with `.extend()` from the response schema, never restated (E-014): the two shapes
 * cannot drift, and `venta` is the ONLY field whose validation is dropped.
 */
export const deudorDetalleClientSchema = deudorDetalleResponseSchema.extend({
  cuentas: z.array(
    cuentaPorCobrarDetalleSchema.extend({
      venta: z.custom<IVentaDelDeudor>(() => true),
    }),
  ),
});

/** What `venta` is typed as on the client. Same type the response schema declares. */
type IVentaDelDeudor = z.infer<typeof ventaSchema> | null;

/* ------------------------------------------------------------------ actions */

/**
 * A collection line WITHOUT `equivalenteBase`: the server resolves the rate and computes it
 * (ADR 0125). Derived from pagoLineaSchema with `.omit()` so the two shapes cannot drift; Zod
 * strips the field if a client sends it anyway.
 */
export const abonoPagoLineaSchema = pagoLineaSchema.omit({
  equivalenteBase: true,
});

/** Upper bound of the `motivo` a user may type. Same bound as MovimientoStock.motivo. */
export const CUENTAS_POR_COBRAR_MOTIVO_MAX = 300;

/**
 * What a rejected `motivo` is answered with. A FIXED string with no interpolation, for the same
 * reason as CONTROL_CHARACTERS_MESSAGE: echoing the value that failed puts a control sequence in
 * the logs and in the response, which is the very thing being refused (E-031).
 *
 * It is NOT `CONTROL_CHARACTERS_MESSAGE`, and this is a DECLARED exception to E-039. That constant
 * reads "El nombre contiene caracteres no permitidos" and this field is a `motivo`, not a name; the
 * message would be wrong here. Editing the shared one is worse: F-034 verified criteria against its
 * current text (ADR 0120). The PREDICATE is shared — `hasControlCharacters` is the only definition
 * of the range and is imported, not restated. Only the sentence is field-specific.
 *
 * It lives here and not in `src/constants/cuentasPorCobrar.ts` for the same reason
 * `EMPTY_PAGOS_WITHOUT_CREDIT_MESSAGE` lives in `src/schemas/pago.ts`: that module imports from
 * this one, and importing it back would close a value cycle between two modules that evaluate
 * schemas at the top level (E-028).
 */
export const MOTIVO_CONTROL_CHARACTERS_MESSAGE =
  "El motivo contiene caracteres no permitidos";

/**
 * The `motivo` of all three write actions. ONE declaration, used three times.
 *
 * The control-character bound is not decoration. `MovimientoCuentaPorCobrar` is an APPEND-ONLY
 * ledger: a poisoned `motivo` written today cannot be cleaned afterwards without mutating a row,
 * which is exactly what criterion 11 exists to verify never happens. `Cliente.nombre` could be
 * fixed with an UPDATE; this cannot. Rejected at the door, never cleaned in silence — a `motivo`
 * corrected behind the back of whoever wrote it, in a ledger that exists to audit who did what and
 * why, is worse than a rejection (ADR 0120).
 *
 * CONSEQUENCE THAT BELONGS TO THE SCREEN, AND HAS TO BE READ FROM BOTH SIDES: the range
 * `hasControlCharacters` rejects is the C0 range plus DEL and C1, and the line feed is inside it.
 * So the `Motivo` field is SINGLE-LINE in both dialogs: what cannot be typed does not have to
 * be rejected afterwards. The range is not narrowed to let line breaks through — consistency with
 * ADR 0120 is worth more than multi-line notes in a 300-character field, and an exception carved
 * into a shared predicate is a branch nobody tests (E-032).
 */
export const motivoField = z
  .string()
  .max(CUENTAS_POR_COBRAR_MOTIVO_MAX)
  .refine((value) => !hasControlCharacters(value), {
    message: MOTIVO_CONTROL_CHARACTERS_MESSAGE,
  })
  .optional();

export const registrarAbonoSchema = z.object({
  pagos: z.array(abonoPagoLineaSchema).min(1),
  motivo: motivoField,
});

export const perdonarDeudaSchema = z.object({
  motivo: motivoField,
});

export const revertirAbonoSchema = z.object({
  /** The ABONO being undone. It must belong to the account in the path. */
  movimientoId: z.string().uuid(),
  motivo: motivoField,
});

/**
 * The SAME body for the three actions, so the panel refreshes the same way after any of them,
 * and so an idempotent replay of a collection returns a shape the caller already knows.
 * `duplicado` is added ONLY on a replay, exactly as POST /api/movimiento does.
 */
export const movimientoAplicadoResponseSchema = z.object({
  movimientoId: z.string().uuid(),
  cuentaId: z.string().uuid(),
  tipo: movimientoCuentaPorCobrarSchema.shape.tipo,
  /** In base currency. For an ABONO it is the sum the server computed, not one the client sent. */
  monto: z.number(),
  saldoPendiente: z.number(),
  settledAt: z.coerce.date().nullable(),
  duplicado: z.boolean().optional(),
});

/**
 * The body of EVERY rejection the write door produces, and of the route's own pre-check for
 * perdoning a settled account. `saldoPendiente` is the real balance AT THAT MOMENT — for
 * SALDO_INSUFICIENTE it is also repeated inside `error`, which is what criterion 9 measures.
 */
export const saldoInsuficienteResponseSchema = z.object({
  error: z.string(),
  saldoPendiente: z.number(),
});

export type IAgingBucketApi = z.infer<typeof agingBucketEnum>;
export type IDeudorEstado = z.infer<typeof deudorEstadoEnum>;
export type ICuentasPorCobrarFiltros = z.infer<
  typeof cuentasPorCobrarFiltrosSchema
>;
export type ICuentaAbierta = z.infer<typeof cuentaAbiertaSchema>;
export type IDeudorRow = z.infer<typeof deudorRowSchema>;
export type ICuentasPorCobrarListResponse = z.infer<
  typeof cuentasPorCobrarListResponseSchema
>;
export type IMovimientoCuentaPorCobrarConAutor = z.infer<
  typeof movimientoCuentaPorCobrarConAutorSchema
>;
export type ICuentaPorCobrarDetalle = z.infer<
  typeof cuentaPorCobrarDetalleSchema
>;
export type ICuentaPorCobrarDetalleResponse = z.infer<
  typeof cuentaPorCobrarDetalleResponseSchema
>;
export type IDeudorDetalleResponse = z.infer<typeof deudorDetalleResponseSchema>;
export type IDeudorDetalleClient = z.infer<typeof deudorDetalleClientSchema>;
export type IAbonoPagoLinea = z.infer<typeof abonoPagoLineaSchema>;
export type IRegistrarAbono = z.infer<typeof registrarAbonoSchema>;
export type IPerdonarDeuda = z.infer<typeof perdonarDeudaSchema>;
export type IRevertirAbono = z.infer<typeof revertirAbonoSchema>;
export type IMovimientoAplicadoResponse = z.infer<
  typeof movimientoAplicadoResponseSchema
>;
export type ISaldoInsuficienteResponse = z.infer<
  typeof saldoInsuficienteResponseSchema
>;
