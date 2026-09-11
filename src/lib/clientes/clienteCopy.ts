import {
  CLIENTES_COPY,
  CLIENTE_CREATE_LABEL_MAX_CHARS,
} from "@/constants/clientes";
import { normalizeClienteNombre } from "@/lib/clientes/clienteNombre";
import type { IClienteCreateBlockReason } from "@/lib/clientes/clienteSearch";

/**
 * The copy that interpolates, apart from `src/constants/clientes.ts` because these are
 * functions and have to be importable from a test: a symbol living in a `.tsx` is not (E-015).
 *
 * Import edges, with no cycle (E-028): this module imports a type from `clienteSearch.ts`, a
 * value from `clienteNombre.ts` and values from `src/constants/clientes.ts`. None of the three
 * imports this one back.
 */

const ELLIPSIS = "…";
const CREATE_LABEL_PREFIX = "Crear «";
const CREATE_LABEL_SUFFIX = "»";

const DEACTIVATE_PREFIX = "¿Desactivar a «";
const DEACTIVATE_SUFFIX =
  "»? Dejará de aparecer en la lista y en el selector de clientes. Sus deudas anteriores se conservan y su nombre sigue apareciendo en ellas.";

const SUBTITLE_SEPARATOR = " · ";
const SUBTITLE_ONE = "cliente";
const SUBTITLE_MANY = "clientes";
const SUBTITLE_CON_SALDO = "con saldo pendiente";

/**
 * The label of the create action. Empty term -> the generic text; otherwise the
 * normalized name inside guillemets, cut to CLIENTE_CREATE_LABEL_MAX_CHARS with a
 * trailing ellipsis. The name is normalized with `normalizeClienteNombre`, so what
 * the label shows is what the row would store.
 */
export function clienteCreateActionLabel(term: string): string {
  const nombre = normalizeClienteNombre(term);
  if (nombre === "") return CLIENTES_COPY.crearNuevo;

  const shown =
    nombre.length > CLIENTE_CREATE_LABEL_MAX_CHARS
      ? `${nombre.slice(0, CLIENTE_CREATE_LABEL_MAX_CHARS)}${ELLIPSIS}`
      : nombre;

  return `${CREATE_LABEL_PREFIX}${shown}${CREATE_LABEL_SUFFIX}`;
}

/** The one-string question `confirmDialog` takes: what is asked and what it does. */
export function clienteDeactivateQuestion(nombre: string): string {
  return `${DEACTIVATE_PREFIX}${nombre}${DEACTIVATE_SUFFIX}`;
}

/**
 * The card subtitle. `withSaldo` adds the second half only when `conSaldo` is
 * greater than zero.
 */
export function clienteListSubtitle(params: {
  total: number;
  conSaldo: number;
  withSaldo: boolean;
}): string {
  const { total, conSaldo, withSaldo } = params;
  const head = `${total} ${total === 1 ? SUBTITLE_ONE : SUBTITLE_MANY}`;

  if (!withSaldo || !(conSaldo > 0)) return head;

  return `${head}${SUBTITLE_SEPARATOR}${conSaldo} ${SUBTITLE_CON_SALDO}`;
}

/**
 * The visible reason of a blocked create action, by the reason
 * `resolveCreateAvailability` returns. It exists because the block reasons are
 * "sin-permiso" / "offline" and the copy keys are `crearSinPermiso` /
 * `crearSinConexion`: indexing one with the other does not compile.
 */
export const CLIENTE_CREATE_BLOCK_COPY: Record<
  IClienteCreateBlockReason,
  string
> = {
  "sin-permiso": CLIENTES_COPY.crearSinPermiso,
  offline: CLIENTES_COPY.crearSinConexion,
};
