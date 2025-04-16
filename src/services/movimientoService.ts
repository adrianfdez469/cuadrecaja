import { ICreateMovimientoDTO, ICreateMovimientoFromProdDTO, ITipoMovimiento } from "@/types/IMovimiento";
import axios from "axios";

const API_URL = `/api/movimiento`;

export const saveMovimiento = async (data: ICreateMovimientoDTO) => {
  // TODO: 
  console.log(data);
  
}

export const cretateBatchMovimientos = async (data: Partial<ICreateMovimientoFromProdDTO>, items: Pick<ICreateMovimientoFromProdDTO, "productoId" | "cantidad">[]) => {
  console.log('data', data);
  console.log('items', items);
  
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
