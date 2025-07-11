import axios from "axios";

const API_URL = "/api/cpp"; // Ruta base del backend


export const fetchCPPAnalisis = async (localId: string) => {
  const response = await axios.get(`${API_URL}/${localId}?tipo=analisis`);
  return response.data;
};

export const fetchCPPDesviaciones = async (localId: string, umbral: number = 10) => {
  const response = await axios.get(`${API_URL}/${localId}?tipo=desviaciones&umbral=${umbral}`);
  return response.data;
};



