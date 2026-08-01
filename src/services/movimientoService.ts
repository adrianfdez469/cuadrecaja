import axiosClient, { IDEMPOTENCY_KEY_HEADER } from "@/lib/axiosClient";
import { generateUUID } from "@/utils/uuid";
import type {
  ITipoMovimiento,
  IImportData,
  IImportarItemsMov,
  IImportarResponse,
  IMovimientoProductoEnviado,
  IAdvertenciaCajaInsuficiente,
} from "@/schemas/movimiento";
import type {
  IProdTiendaQueryParams,
  IProdTiendaResponse,
} from "@/schemas/producto";
import type { IResumenCajaResponse } from "@/schemas/resumenCaja";

const API_URL = `/api/movimiento`;

/**
 * Creates a batch of stock movements.
 *
 * The idempotency key identifies the batch and lets the server deduplicate it.
 * Generating one here already covers the automatic axios retry, since the retry
 * reuses the same config and therefore the same key. Callers that also want to
 * cover a manual retry by the user after an error must pass a stable key, kept
 * outside the render and renewed only once the save succeeds.
 */
export const cretateBatchMovimientos = async (
  data,
  items,
  idempotencyKey?: string,
): Promise<{
  advertenciasCaja: IAdvertenciaCajaInsuficiente[];
  duplicado?: boolean;
}> => {
  const res = await axiosClient.post(
    API_URL,
    { data, items },
    {
      headers: {
        [IDEMPOTENCY_KEY_HEADER]: idempotencyKey ?? generateUUID(),
      },
    },
  );
  return res.data;
};

export const getEfectivoDisponibleCaja = async (
  tiendaId: string,
): Promise<Record<string, number>> => {
  const res = await axiosClient.get(`${API_URL}/${tiendaId}/caja-disponible`);
  return res.data.disponible;
};

export const getResumenCaja = async (
  tiendaId: string,
): Promise<IResumenCajaResponse> => {
  const res = await axiosClient.get<IResumenCajaResponse>(
    `${API_URL}/${tiendaId}/caja-resumen`,
  );
  return res.data;
};

export const findMovimientos = async (
  tiendaId: string,
  take: number = 20,
  skip: number = 0,
  productoTiendaId?: string,
  tipo?: ITipoMovimiento[],
  intervalo?: { fechaInicio?: Date; fechaFin?: Date },
  searchTerm?: string,
) => {
  const response = await axiosClient.get(API_URL, {
    params: {
      tiendaId: tiendaId,
      take,
      skip,
      ...(intervalo?.fechaInicio && { fechaInicio: intervalo.fechaInicio }),
      ...(intervalo?.fechaFin && { fechaFin: intervalo.fechaFin }),
      ...(productoTiendaId && { productoTiendaId: productoTiendaId }),
      ...(tipo && tipo.length > 0 && { tipo: tipo.join(",") }),
      ...(searchTerm && { search: searchTerm }),
    },
  });

  return response.data;
};

/**
 * Importa movimientos desde un archivo Excel
 * @param data Datos del negocio y usuario
 * @param items Array de productos a importar
 * @returns Promise con el resultado de la importación
 */
export const importarMovimientosExcel = async (
  data: IImportData,
  items: IImportarItemsMov[],
): Promise<IImportarResponse> => {
  try {
    const response = await axiosClient.post(
      `${API_URL}/import`,
      { data, items },
      // Reimportar el mismo archivo duplicaría todo el lote. La clave se genera
      // por invocación: cubre el reintento automático de axios, mientras que
      // volver a lanzar la importación a mano es una decisión deliberada del
      // usuario y sí debe registrarse como una importación nueva.
      { headers: { [IDEMPOTENCY_KEY_HEADER]: generateUUID() } },
    );

    return response.data;
  } catch (error) {
    console.error("Error al importar movimientos:", error);

    // Si hay respuesta del servidor, retornar el error del servidor
    if (error.response?.data) {
      return error.response.data;
    }

    // Error de red o conexión
    return {
      success: false,
      message: "Error de conexión",
      errorCause: error.message || "No se pudo conectar con el servidor",
    };
  }
};

export const getProductosTiendaParaEntrada = async (
  tiendaId: string,
  tipo: ITipoMovimiento,
  filter: IProdTiendaQueryParams,
  proveedorId?: string,
): Promise<IProdTiendaResponse[]> => {
  const resp = await axiosClient.get(
    `${API_URL}/${tiendaId}/productos/entrada`,
    {
      params: {
        ...filter,
        take: filter?.take || 50,
        skip: filter?.skip || 0,
        tipo: tipo,
        ...(proveedorId && { proveedorId: proveedorId }),
      },
    },
  );
  return resp.data;
};

export const getProductosTiendaParaNoEntrada = async (
  tiendaId: string,
  tipo: ITipoMovimiento,
  filter: IProdTiendaQueryParams,
  proveedorId?: string,
): Promise<IProdTiendaResponse[]> => {
  const resp = await axiosClient.get(
    `${API_URL}/${tiendaId}/productos/salida`,
    {
      params: {
        ...filter,
        take: filter?.take || 50,
        skip: filter?.skip || 0,
        tipo: tipo,
        ...(proveedorId && { proveedorId: proveedorId }),
      },
    },
  );
  return resp.data;
};

export const getMovimientosProductosEnviados = async (
  tiendaId: string,
): Promise<IMovimientoProductoEnviado[]> => {
  const resp = await axiosClient.get(`${API_URL}/${tiendaId}/recepcion`);
  return resp.data;
};

export const rejectMovimiento = async (
  movimientoId: string,
  motivo: string,
) => {
  await axiosClient.post(`${API_URL}/rechazo`, {
    movimientoId,
    motivo,
  });
};
