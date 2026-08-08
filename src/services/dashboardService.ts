import axiosClient from "@/lib/axiosClient";

export const getDashboardResumen = async (
  tiendaId: string,
  filters?: Record<string, unknown>,
) => {
  const response = await axiosClient.get(`/api/dashboard/resumen/${tiendaId}`, {
    params: filters,
  });
  return response.data;
};
