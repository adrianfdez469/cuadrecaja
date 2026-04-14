import axiosClient from "@/lib/axiosClient";

const API_URL = "/api/cpp"; // Ruta base del backend


export const fetchCPPAnalisis = async (localId: string) => {
  const response = await axiosClient.get(`${API_URL}/${localId}?tipo=analisis`);
  return response.data;
};

export const fetchCPPDesviaciones = async (localId: string, umbral: number = 10) => {
  const response = await axiosClient.get(`${API_URL}/${localId}?tipo=desviaciones&umbral=${umbral}`);
  return response.data;
};



