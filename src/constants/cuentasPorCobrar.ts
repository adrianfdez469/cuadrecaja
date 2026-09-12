import type { PillHue } from "@/components/StatusPill";
import {
  TIPOS_MOVIMIENTO_CUENTA_POR_COBRAR,
  type ITipoMovimientoCuentaPorCobrar,
} from "@/schemas/cuentaPorCobrar";
import type { ICuentasPorCobrarFiltros } from "@/schemas/cuentasPorCobrarPanel";
import type { IFiltroOpciones } from "@/lib/cuentasPorCobrar/panel";

/**
 * Re-exported, never restated: `src/schemas/cuentaPorCobrar.ts` declares itself THE ONLY
 * declaration of this list, and its own comment points here for the re-export (E-014, E-039).
 */
export { TIPOS_MOVIMIENTO_CUENTA_POR_COBRAR };

/** The permission gating the panel. Already declared by F-033; re-exported, not redefined. */
export { CUENTAS_POR_COBRAR_PERMISO } from "@/constants/clientes";

export const CUENTAS_POR_COBRAR_PERMISO_COBRAR =
  "operaciones.cuentasporcobrar.cobrar";
export const CUENTAS_POR_COBRAR_PERMISO_PERDONAR =
  "operaciones.cuentasporcobrar.perdonar";
export const CUENTAS_POR_COBRAR_PERMISO_REVERTIR =
  "operaciones.cuentasporcobrar.revertir";

/**
 * The visible label of each ledger entry type. `CONDONACION` reads "Perdon de deuda" on purpose:
 * the persisted value and the visible name diverge, and neither is corrected into the other
 * (ADR 0122). A Record over the closed vocabulary, so a fifth type does not compile until its
 * label is written.
 */
export const TIPO_MOVIMIENTO_LABEL: Record<
  ITipoMovimientoCuentaPorCobrar,
  string
> = {
  ABONO: "Abono",
  AJUSTE_DEVOLUCION: "Ajuste por devolucion",
  CONDONACION: "Perdon de deuda",
  REVERSION_ABONO: "Reversion de abono",
};

/**
 * The ink of each ledger entry type. Four types, four distinct hues, and NONE of them `accent`:
 * the violet is reserved for action and selection (design § 7). A `Record` over the closed
 * vocabulary, so a fifth type does not compile until it gets an ink.
 *
 * `PillHue` arrives through an `import type`, which is erased before anything runs: no value of
 * a `.tsx` is pulled into this module (E-015). Same figure as
 * `src/components/tiendaOnline/orderPresentation.ts`.
 */
export const TIPO_MOVIMIENTO_HUE: Record<
  ITipoMovimientoCuentaPorCobrar,
  PillHue
> = {
  ABONO: "positive",
  CONDONACION: "negative",
  REVERSION_ABONO: "caution",
  AJUSTE_DEVOLUCION: "info",
};

/**
 * Re-exported from the schema module, NOT declared here: `src/schemas/cuentasPorCobrarPanel.ts`
 * needs both to build `motivoField`, and importing them from this file would close a value cycle
 * between two modules that evaluate schemas at the top level (E-028) — the same reason
 * `EMPTY_PAGOS_WITHOUT_CREDIT_MESSAGE` lives in `src/schemas/pago.ts` and not in
 * `src/constants/creditoVenta.ts`. This module already imports from `src/schemas/**`; the arrow
 * only points one way.
 */
export {
  CUENTAS_POR_COBRAR_MOTIVO_MAX,
  MOTIVO_CONTROL_CHARACTERS_MESSAGE,
} from "@/schemas/cuentasPorCobrarPanel";

/**
 * The body of a rejected collection carries the real balance as a NUMBER, and repeats it inside
 * the message. Never `toLocaleString`: an API body is not a screen, and `es-ES` does not group
 * four-digit thousands anyway (E-033).
 */
export const CUENTAS_POR_COBRAR_API_ERRORS = {
  sinPeriodoAbierto:
    "La tienda no tiene un periodo de caja abierto. Abre la caja antes de registrar un cobro",
  cuentaNoEncontrada: "Cuenta por cobrar no encontrada",
  cuerpoInvalido: "Datos del cobro invalidos",
  cabeceraIdempotenciaAusente: "Falta la cabecera de idempotencia",
  monedaNoAdmitida: "La moneda del cobro no esta habilitada en el negocio",
  destinoTransferenciaInvalido:
    "El destino de transferencia no pertenece a la tienda de la cuenta",
  operacionEnCurso: "La operacion ya esta en curso",
  errorInterno: "Error interno del servidor",
  /** Perdoning an account whose balance is already zero. The figure travels in the body too. */
  nadaQuePerdonar: "Esta deuda ya esta saldada: no hay nada que perdonar",
  saldoInsuficiente: (saldoPendiente: number): string =>
    `El monto supera el saldo pendiente de la cuenta, que es ${saldoPendiente}`,
} as const;

/**
 * The literal copy of the panel, the detail and the three dialogs, fixed by
 * `.agents/designs/F-035.md` § 8. NO component writes a literal of its own.
 */
export const CUENTAS_POR_COBRAR_COPY = {
  /* ---- The panel ---- */
  pageTitle: "Cuentas por Cobrar",
  pageSubtitle: "Quién debe, cuánto y desde cuándo.",
  breadcrumbInicio: "Inicio",
  seccionEtiqueta: "Deudores del negocio",
  listaTitulo: "Deudores",
  recargar: "Actualizar la lista",

  statDeudores: "Deudores con saldo",
  statTotal: "Total por cobrar",
  statCuentas: "Cuentas abiertas",
  statMasAntigua: "Deuda más antigua",

  columnaCliente: "Cliente",
  columnaSaldo: "Saldo",
  columnaAntiguedad: "Antigüedad",
  columnaUltimoAbono: "Último abono",
  columnaCuentas: "Cuentas",
  columnaEstado: "Estado",
  columnaAcciones: "Acciones",

  etiquetaSaldo: "Saldo",
  etiquetaAntiguedad: "Antigüedad",
  etiquetaUltimoAbono: "Último abono",
  etiquetaCuentas: "Cuentas abiertas",

  sinDato: "—",
  sinContacto: "Sin contacto",
  sinAutor: "Sin autor registrado",
  verDetalle: "Ver el detalle del deudor",

  estadoConDeuda: "Con deuda",
  estadoSaldada: "Saldada",

  /* ---- Filters ---- */
  filtrosAbrir: "Filtros",
  filtrosTitulo: "Filtrar deudores",
  filtroDeudor: "Deudor",
  filtroTienda: "Tienda",
  filtroAntiguedad: "Tramo de antigüedad",
  filtroEstado: "Estado de la cuenta",
  filtroTodos: "Todos",
  filtroTodas: "Todas",
  filtrosLimpiar: "Limpiar filtros",
  filtrosAplicar: "Ver resultados",

  /* ---- List states ---- */
  vacioTitulo: "Nadie debe nada",
  vacioDescripcion: "Cuando fíes una venta, el deudor aparece aquí.",
  sinResultadosTitulo: "Ningún deudor coincide",
  sinResultadosDescripcion: "Prueba con otros filtros, o quítalos todos.",
  /**
   * The action of the "no results" state, and it deliberately does NOT say "Limpiar filtros".
   * At 320 px the loose button of the filter bar already says that, and the two coexist in this
   * exact state: two buttons with the same own text inside one region make any counting check
   * ambiguous (E-016, design criterion 21).
   */
  sinResultadosAccion: "Ver la lista completa",
  errorTitulo: "No se pudo cargar la lista",
  errorDescripcion:
    "Vuelve a intentarlo. Si sigue fallando, avisa a un administrador del negocio.",
  offlineTitulo: "Sin conexión",
  offlineDescripcion:
    "Esta pantalla lee del servidor. Vuelve a intentarlo cuando haya conexión.",

  /* ---- The detail ---- */
  detalleVentas: "Ventas fiadas",
  detalleLibro: "Movimientos de la deuda",
  cuentaVentaDel: "Venta del",
  cuentaAbonoDel: "Abono del",
  cuentaMontoOriginal: "Monto fiado",
  cuentaSaldo: "Saldo pendiente",
  cuentaSaldadaEl: "Saldada el",
  cuentaEquivale: "Equivale a",
  cuentaAbierta: "Abierta",
  resumenSaldo: "Saldo",

  verVenta: "Ver la venta",
  /**
   * The title of the two action sheets is a FIXED literal, never the date of the sale or of the
   * collection. The sheet lives in a portal and its rows accept no `className`, so its title is
   * the only thing it can be located by — and a date collides with the ones the screen itself
   * paints (E-008, E-016). It doubles as the `aria-label` of the button that opens it.
   */
  hojaAccionesCuenta: "Acciones de la venta",
  hojaAccionesAbono: "Acciones del abono",
  ventaNoDisponible: "La venta no está disponible",
  cobrar: "Cobrar",
  perdonar: "Perdonar deuda",
  revertir: "Revertir abono",
  revertido: "Revertido",
  libroVacioTitulo: "Todavía no hay movimientos",
  libroVacioDescripcion: "Cuando registres un cobro aparecerá aquí.",
  columnaMovimiento: "Movimiento",
  columnaMonto: "Monto",
  columnaFecha: "Fecha",
  columnaVenta: "Venta",
  columnaNota: "Nota",

  /* ---- The reason of criterion 7 ---- */
  sinCajaAbierta: "Esta tienda no tiene caja abierta. Ábrela para poder cobrar.",

  /* ---- The collection dialog ---- */
  abonoTitulo: "Registrar cobro",
  abonoConfirmar: "Registrar cobro",
  abonoVacio: "Escribe cuánto se cobra.",
  abonoSalda: "Este cobro salda la deuda.",
  abonoRestante: "Quedará debiendo",
  abonoExcede: "El cobro supera el saldo en",
  abonoOk: "Cobro registrado. Saldo pendiente:",
  abonoOkSalda: "Deuda saldada.",
  abonoDuplicado: "Ese cobro ya estaba registrado.",

  /* ---- The perdon dialog ---- */
  perdonarTitulo: "Perdonar deuda",
  perdonarConfirmar: "Perdonar la deuda",
  perdonarAviso: "Vas a dar por cobrados",
  perdonarAvisoCola: "que el cliente no ha pagado.",
  perdonarNota:
    "Esto no entra en la caja de ningún período y no se puede deshacer desde aquí.",
  perdonarMotivo: "Motivo",
  perdonarMotivoAyuda: "Queda escrito en el historial de la deuda.",
  perdonarOk: "Deuda perdonada.",
  perdonarYaSaldada: "Esta deuda ya está saldada. No hay nada que perdonar.",

  /* ---- The reversal dialog ---- */
  revertirTitulo: "Revertir abono",
  revertirConfirmar: "Revertir el abono",
  revertirAviso: "Vas a devolver",
  revertirAvisoCola: "al saldo de esta deuda.",
  revertirNota:
    "El abono original se conserva en el historial; se añade un movimiento nuevo que lo revierte.",
  revertirMotivo: "Motivo (opcional)",
  revertirOk: "Abono revertido. Saldo pendiente:",
  revertirYaHecho: "Ese abono ya se revirtió.",

  /* ---- The Motivo field of the two destructive dialogs (finding H1) ---- */
  motivoLimpiado: "Se quitaron caracteres que no se pueden guardar.",

  /* ---- Errors the three dialogs share ---- */
  errorSaldoReal: "El saldo real de esta cuenta es",
  errorSaldoRealCola: "Ajusta el monto y vuelve a intentarlo.",
  errorCuentaAusente: "La cuenta ya no existe.",
  errorSinPermiso: "Tu usuario no puede hacer esta operación.",
  errorSinCaja:
    "Esta tienda no tiene caja abierta. Abre la caja e inténtalo de nuevo.",
  errorGenerico: "No se pudo completar la operación.",

  /**
   * A SECOND text, deliberately, for what `missingExchangeRateMessage` says on the server: that
   * function lives in `src/lib/tasaSnapshotResolver.ts`, which imports `@/lib/prisma` at module
   * scope and would drag Prisma into the browser bundle. Declared exception to E-039, with its
   * reason written (design § 3).
   */
  sinTasa: (codes: string[]): string =>
    `Falta la tasa de ${codes.join(", ")}. Regístrala en Configuración → Tasas de cambio antes de cobrar en esa moneda.`,
} as const;

/**
 * The location classes. They exist so a verification finds each piece without leaning on an
 * internal MUI class nor climbing up from an icon (E-011). Compared ALWAYS with
 * `classList.contains`, never by prefix — and none of these is a prefix of another, on purpose.
 */
export const CUENTAS_POR_COBRAR_DOM = Object.freeze({
  panel: "cc-cxc-panel",
  filtros: "cc-cxc-filtros",
  resumenFiltros: "cc-cxc-resumen-filtros",
  abrirFiltros: "cc-cxc-abrir-filtros",
  limpiarFiltros: "cc-cxc-limpiar-filtros",
  lista: "cc-cxc-lista",
  fila: "cc-cxc-fila",
  detalle: "cc-cxc-detalle",
  cuenta: "cc-cxc-cuenta",
  cobrar: "cc-cxc-cobrar",
  motivoCaja: "cc-cxc-motivo-caja",
  perdonar: "cc-cxc-perdonar",
  verVenta: "cc-cxc-ver-venta",
  libro: "cc-cxc-libro",
  movimiento: "cc-cxc-movimiento",
  revertir: "cc-cxc-revertir",
  accionesCuenta: "cc-cxc-acciones-cuenta",
  accionesMovimiento: "cc-cxc-acciones-movimiento",
  dialogoAbono: "cc-cxc-dialogo-abono",
  dialogoPerdon: "cc-cxc-dialogo-perdon",
  dialogoReversion: "cc-cxc-dialogo-reversion",
  resultado: "cc-cxc-resultado",
  errorSaldo: "cc-cxc-error-saldo",
} as const);

/**
 * What `MultiCurrencyPayment` receives for `denominaciones` when `allowChange` is false: only
 * `calcularVuelto` reads them, and that function is not called in this flow. Frozen at module
 * scope, never an object literal in JSX, so its identity does not change on every render.
 */
export const SIN_DENOMINACIONES: Readonly<Record<string, number[]>> =
  Object.freeze({});

/**
 * PURE. How many of the four filters are set. It is what decides `empty` against `no-results`,
 * and whether the clear control is mounted — never the length of the response.
 */
export function countFiltrosActivos(filtros: ICuentasPorCobrarFiltros): number {
  if (!filtros) return 0;
  const valores = [
    filtros.clienteId,
    filtros.tiendaId,
    filtros.antiguedad,
    filtros.estado,
  ];
  return valores.filter((valor) => valor !== undefined && valor !== null).length;
}

const DEUDOR_ESTADO_LABEL: Record<string, string> = {
  CON_DEUDA: CUENTAS_POR_COBRAR_COPY.estadoConDeuda,
  SALDADA: CUENTAS_POR_COBRAR_COPY.estadoSaldada,
};

/**
 * PURE. The one-line summary of the active filters shown under 600 px, joined with " · " in the
 * fixed order Deudor -> Tienda -> Antigüedad -> Estado. `null` when nothing is filtered.
 *
 * A `clienteId` or a `tiendaId` that is not among the options is OMITTED rather than printed:
 * a uuid on screen is noise, not information.
 */
export function describeFiltros(
  filtros: ICuentasPorCobrarFiltros,
  opciones: IFiltroOpciones,
): string | null {
  if (!filtros) return null;
  const partes: string[] = [];

  const deudor = (opciones?.deudores ?? []).find(
    (opcion) => opcion.id === filtros.clienteId,
  );
  if (deudor) partes.push(deudor.nombre);

  const tienda = (opciones?.tiendas ?? []).find(
    (opcion) => opcion.id === filtros.tiendaId,
  );
  if (tienda) partes.push(tienda.nombre);

  if (filtros.antiguedad) partes.push(`${filtros.antiguedad} días`);

  if (filtros.estado) {
    const label = DEUDOR_ESTADO_LABEL[filtros.estado];
    if (label) partes.push(label);
  }

  return partes.length > 0 ? partes.join(" · ") : null;
}
