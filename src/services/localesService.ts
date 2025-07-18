import axios from "axios";
import { ILocal } from "@/types/ILocal";
const API_URL = '/api/locales';

export const getLocales = async (): Promise<ILocal[]> => {
  const response = await axios.get(API_URL);
  return response.data;
};

