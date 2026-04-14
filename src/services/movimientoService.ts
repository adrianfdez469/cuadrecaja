import axiosClient from "@/lib/axiosClient";
import type {
  ITipoMovimiento,
  IImportData,
  IImportarItemsMov,
  IImportarResponse,
  IMovimientoProductoEnviado,
} from "@/schemas/movimiento";
import type { IProdTiendaQueryParams, IProdTiendaResponse } from "@/schemas/producto";

const API_URL = `/api/movimiento`;

export const cretateBatchMovimientos = async (data, items) => {
  await axiosClient.post(API_URL, {
    data: data,
    items: items
  });
}

export const findMovimientos = async (
  tiendaId: string, 
  take: number = 20, 
  skip: number = 0, 
  productoTiendaId?: string, 
  tipo?: ITipoMovimiento, 
  intervalo?: {fechaInicio?: Date, fechaFin?: Date},
  searchTerm?: string
) => {
  const response = await axiosClient.get(API_URL, {
    params: {
      tiendaId: tiendaId,
      take, 
      skip,
      ...(intervalo?.fechaInicio && {fechaInicio: intervalo.fechaInicio}),
      ...(intervalo?.fechaFin && {fechaFin: intervalo.fechaFin}),
      ...(productoTiendaId && {productoTiendaId: productoTiendaId}),
      ...(tipo && {tipo: tipo}),
      ...(searchTerm && {search: searchTerm}),
    }
  });

  return response.data;
}

/**
 * Importa movimientos desde un archivo Excel
 * @param data Datos del negocio y usuario
 * @param items Array de productos a importar
 * @returns Promise con el resultado de la importación
 */
export const importarMovimientosExcel = async (
  data: IImportData, 
  items: IImportarItemsMov[]
): Promise<IImportarResponse> => {
  try {
    const response = await axiosClient.post(`${API_URL}/import`, {
      data,
      items
    });

    return response.data;
  } catch (error) {
    console.error('Error al importar movimientos:', error);
    
    // Si hay respuesta del servidor, retornar el error del servidor
    if (error.response?.data) {
      return error.response.data;
    }
    
    // Error de red o conexión
    return {
      success: false,
      message: "Error de conexión",
      errorCause: error.message || "No se pudo conectar con el servidor"
    };
  }
};



export const getProductosTiendaParaEntrada = async (tiendaId: string, tipo: ITipoMovimiento, filter: IProdTiendaQueryParams, proveedorId?: string): Promise<IProdTiendaResponse[]> => {
  const resp = await axiosClient.get(`${API_URL}/${tiendaId}/productos/entrada`, {
    params: {
      ...filter,
      take: filter?.take || 50,
      skip: filter?.skip || 0,
      tipo: tipo,
      ...(proveedorId && {proveedorId: proveedorId})
    }
  });
  return resp.data;
}

export const getProductosTiendaParaNoEntrada = async (tiendaId: string, tipo: ITipoMovimiento, filter: IProdTiendaQueryParams, proveedorId?: string): Promise<IProdTiendaResponse[]> => {
  const resp = await axiosClient.get(`${API_URL}/${tiendaId}/productos/salida`, {
    params: {
      ...filter,
      take: filter?.take || 50,
      skip: filter?.skip || 0,
      tipo: tipo,
      ...(proveedorId && {proveedorId: proveedorId})
    }
  });
  return resp.data;
}


export const getMovimientosProductosEnviados = async (tiendaId: string): Promise<IMovimientoProductoEnviado[]> => {
  const resp = await axiosClient.get(`${API_URL}/${tiendaId}/recepcion`);
  return resp.data;
}

export const rejectMovimiento = async (movimientoId: string, motivo: string) => {
  await axiosClient.post(`${API_URL}/rechazo`, {
    movimientoId,
    motivo
  });
}

