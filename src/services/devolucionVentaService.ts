import axiosClient from "@/lib/axiosClient";
import {
  IBuscarVentasResponse,
  IDevolucionVentaCreate,
} from "@/schemas/devolucionVenta";

export const buscarVentas = async (
  tiendaId: string,
  filtros: { fechaInicio?: string; fechaFin?: string; search?: string },
): Promise<IBuscarVentasResponse> => {
  const response = await axiosClient.get(`/api/venta/${tiendaId}/buscar`, {
    params: filtros,
  });
  return response.data;
};

export const registrarDevolucionVenta = async (
  tiendaId: string,
  ventaId: string,
  data: IDevolucionVentaCreate,
): Promise<void> => {
  await axiosClient.post(`/api/venta/${tiendaId}/devolucion/${ventaId}`, data);
};
