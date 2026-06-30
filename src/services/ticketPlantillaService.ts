import axiosClient from "@/lib/axiosClient";
import { ITicketPlantilla, IUpdateTicketPlantilla } from "@/schemas/ticketPlantilla";

const apiUrl = (tiendaId: string) => `/api/tiendas/${tiendaId}/ticket-plantilla`;

export const getTicketPlantilla = async (
  tiendaId: string,
): Promise<ITicketPlantilla> => {
  const response = await axiosClient.get(apiUrl(tiendaId));
  return response.data;
};

export const updateTicketPlantilla = async (
  tiendaId: string,
  data: IUpdateTicketPlantilla,
): Promise<ITicketPlantilla> => {
  const response = await axiosClient.put(apiUrl(tiendaId), data);
  return response.data;
};
