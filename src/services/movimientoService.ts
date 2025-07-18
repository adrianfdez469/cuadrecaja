import { ITipoMovimiento } from "@/types/IMovimiento";
import { IProducto, IProductoTienda, IProductoTiendaV2 } from "@/types/IProducto";
import { IProveedor } from "@/types/IProveedor";
import axios from "axios";

const API_URL = `/api/movimiento`;

export const cretateBatchMovimientos = async (data, items) => {
  await axios.post(API_URL, {
    data: data,
    items: items
  });
}

export const findMovimientos = async (tiendaId: string, take: number = 20, skip: number = 0, productoTiendaId?: string, tipo?: ITipoMovimiento, intervalo?: {fechaInicio?: Date, fechaFin?: Date}) => {
  const response = await axios.get(API_URL, {
    params: {
      tiendaId: tiendaId,
      take, 
      skip,
      ...(intervalo?.fechaInicio && {fechaInicio: intervalo.fechaInicio}),
      ...(intervalo?.fechaFin && {fechaFin: intervalo.fechaFin}),
      ...(productoTiendaId && {productoTiendaId: productoTiendaId}),
      ...(tipo && {tipo: tipo}),
    }
  });

  return response.data;
}

// Interfaz para los datos de importación
interface IImportData {
  usuarioId: string;
  negocioId: string;
  localId: string;
}

interface IImportarItemsMov {
  nombreProducto: string;
  costo: number;
  precio: number;
  cantidad: number;
  esConsignación?: boolean;
  nombreProveedor?: string;
}

interface IImportarResponse {
  success: boolean;
  message: string;
  errorCause?: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  data?: any[];
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
    const response = await axios.post(`${API_URL}/import`, {
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



interface IProdTiendaQueryParams {
  text?: string,
  categoriaId?: string;
  take: number;
  skip: number;
}
interface IProdTiendaResponse extends IProducto {
  productosTienda?: IProductoTiendaV2[]
}

export const getProductosTiendaParaEntrada = async (tiendaId: string, tipo: ITipoMovimiento, filter: IProdTiendaQueryParams): Promise<IProdTiendaResponse[]> => {
  const resp = await axios.get(`${API_URL}/${tiendaId}/productos/entrada`, {
    params: {
      ...filter,
      take: filter?.take || 50,
      skip: filter?.skip || 0,
      tipo: tipo
    }
  });
  return resp.data;
}

export const getProductosTiendaParaNoEntrada = async (tiendaId: string, tipo: ITipoMovimiento, filter: IProdTiendaQueryParams): Promise<IProdTiendaResponse[]> => {
  const resp = await axios.get(`${API_URL}/${tiendaId}/productos/salida`, {
    params: {
      ...filter,
      take: filter?.take || 50,
      skip: filter?.skip || 0,
      tipo: tipo
    }
  });
  return resp.data;
}


export interface IMovimientoProductoEnviado {
  
    id: string;
    productoTiendaId: string;
    tipo: string;
    cantidad: number;
    motivo: string | null;
    referenciaId: string | null;
    fecha: Date;
    existenciaAnterior: number;
    costoUnitario: number | null;
    costoTotal: number | null;
    costoAnterior: number | null;
    costoNuevo: number | null;
    usuarioId: string;
    tiendaId: string;
    proveedorId: string | null;
    destinationId: string;
    productoTienda: {
      id: string;
      tiendaId: string;
      productoId: string;
      costo: number;
      precio: number;
      existencia: number;
      proveedorId: string | null;
      producto: IProducto;
      tienda: {
        id: string;
        nombre: string;
        tipo: string;
      };
      proveedor: IProveedor | null
    },
    usuario: {
      id: string;
      nombre: string;
    };
  
}

export const getMovimientosProductosEnviados = async (tiendaId: string): Promise<IMovimientoProductoEnviado[]> => {
  const resp = await axios.get(`${API_URL}/${tiendaId}/recepcion`);
  return resp.data;
}

