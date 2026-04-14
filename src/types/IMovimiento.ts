export type {
  ITipoMovimiento,
  IMovimiento,
  IMovimientoCreate,
  IMovimientoData,
  IImportData,
  IImportarItemsMov,
  IImportarResponse,
  IMovimientoProductoEnviado,
} from '@/schemas/movimiento';
// Backwards-compat: TypeScript enum (used as MovimientoTipo.COMPRA etc.)
export { MovimientoTipo } from '@/schemas/movimiento';
