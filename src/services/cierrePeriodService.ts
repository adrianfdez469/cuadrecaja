import {
  ICierreData,
  ICierrePeriodo,
  ICloseCierreResult,
  IRecalculateCierreResult,
  ISalesCutoffTarget,
} from "@/schemas/cierre";
import { IBillCount, ICashBreakdownCierre } from "@/schemas/billBreakdown";
import type { ITasaSnapshot } from "@/schemas/tasaCambio";
import type { IInitialCashFundEntry } from "@/schemas/initialCashFund";
import axios from "@/lib/axiosClient";

const API_URL = (tiendaId) => `/api/cierre/${tiendaId}`; // Ruta base del backend

export const fetchLastPeriod = async (
  tiendaId,
): Promise<ICierrePeriodo | undefined> => {
  const response = await axios.get<ICierrePeriodo>(`${API_URL(tiendaId)}/last`);
  return response.data;
};

export const openPeriod = async (
  tiendaId,
): Promise<ICierrePeriodo | undefined> => {
  const response = await axios.put<ICierrePeriodo>(`${API_URL(tiendaId)}/open`);
  return response.data;
};

export const fetchCierreData = async (tiendaId: string, cierreId: string) => {
  const response = await axios.get<ICierreData>(
    `${API_URL(tiendaId)}/${cierreId}`,
  );
  return response.data;
};

/**
 * Sets, moves or clears the cut of an open period. Returns the cutoff as it was
 * stored: the caller shows what the database holds, not what it sent.
 *
 * `expectedCutoffAt` is the cut the screen believed was in force; a 409 means
 * another cashier moved it meanwhile and nothing was written.
 */
export const setSalesCutoff = async (
  tiendaId: string,
  cierreId: string,
  target: ISalesCutoffTarget,
  expectedCutoffAt: Date | null,
): Promise<Date | null> => {
  const response = await axios.patch<{ cutoffAt: string | null }>(
    `${API_URL(tiendaId)}/${cierreId}/sales-cutoff`,
    { target, expectedCutoffAt },
  );
  return response.data.cutoffAt ? new Date(response.data.cutoffAt) : null;
};

/**
 * Closes the period. `expectedCutoffAt` is the cut the caller had on screen; a
 * 409 means someone changed it meanwhile and nothing was written.
 *
 * BREAKING: the response is no longer the closed period alone. `openedPeriod`
 * is the period the close created at the cut, or null when there was none — in
 * which case the caller opens the next one itself, as it always did.
 */
export const closePeriod = async (
  tiendaId: string,
  cierreId: string,
  expectedCutoffAt: Date | null,
): Promise<ICloseCierreResult> => {
  const response = await axios.put<ICloseCierreResult>(
    `${API_URL(tiendaId)}/${cierreId}/close`,
    { expectedCutoffAt },
  );
  return response.data;
};

/**
 * Re-derives the stored figures of a closed period from its current sales
 * (superadmin only). `dryRun` returns the before/after without writing.
 */
export const recalculateCierre = async (
  tiendaId: string,
  cierreId: string,
  options: { dryRun?: boolean } = {},
): Promise<IRecalculateCierreResult> => {
  const response = await axios.post<IRecalculateCierreResult>(
    `${API_URL(tiendaId)}/${cierreId}/recalculate`,
    undefined,
    { params: options.dryRun ? { dryRun: "1" } : undefined },
  );
  return response.data;
};

/**
 * Renames a period. `null` clears the label and the period goes back to being
 * shown by its date range. Returns the label as it was stored — normalized,
 * so the caller shows what the database holds, not what was typed.
 */
export const updateCierreEtiqueta = async (
  tiendaId: string,
  cierreId: string,
  etiqueta: string | null,
): Promise<string | null> => {
  const response = await axios.patch<{ etiqueta: string | null }>(
    `${API_URL(tiendaId)}/${cierreId}/etiqueta`,
    { etiqueta },
  );
  return response.data.etiqueta;
};

export const fetchCashBreakdown = async (
  tiendaId: string,
  cierreId: string,
): Promise<ICashBreakdownCierre | null> => {
  const response = await axios.get<ICashBreakdownCierre | null>(
    `${API_URL(tiendaId)}/${cierreId}/cash-breakdown`,
  );
  return response.data;
};

export const saveCashBreakdown = async (
  tiendaId: string,
  cierreId: string,
  currency: string,
  items: IBillCount[],
  total: number,
): Promise<ICashBreakdownCierre> => {
  const response = await axios.put<ICashBreakdownCierre>(
    `${API_URL(tiendaId)}/${cierreId}/cash-breakdown`,
    {
      currency,
      items,
      total,
    },
  );
  return response.data;
};

export const fetchMonedaBreakdown = async (
  tiendaId: string,
  cierreId: string,
  monedaCode: string,
): Promise<{ items: IBillCount[]; total: number } | null> => {
  const response = await axios.get<{
    items: IBillCount[];
    total: number;
  } | null>(`${API_URL(tiendaId)}/${cierreId}/moneda-breakdown/${monedaCode}`);
  return response.data;
};

export const fetchTasasAtClose = async (
  tiendaId: string,
  cierreId: string,
): Promise<ITasaSnapshot> => {
  const response = await axios.get<ITasaSnapshot>(
    `${API_URL(tiendaId)}/${cierreId}/tasas-at-close`,
  );
  return response.data;
};

export const saveMonedaBreakdown = async (
  tiendaId: string,
  cierreId: string,
  monedaCode: string,
  items: IBillCount[],
  total: number,
): Promise<void> => {
  await axios.put(
    `${API_URL(tiendaId)}/${cierreId}/moneda-breakdown/${monedaCode}`,
    { items, total },
  );
};

export const fetchInitialCashFundHistory = async (
  tiendaId: string,
  cierreId: string,
): Promise<IInitialCashFundEntry[]> => {
  const response = await axios.get<IInitialCashFundEntry[]>(
    `${API_URL(tiendaId)}/${cierreId}/initial-cash-fund`,
  );
  return response.data;
};

export const saveInitialCashFund = async (
  tiendaId: string,
  cierreId: string,
  amounts: Record<string, number>,
): Promise<IInitialCashFundEntry> => {
  const response = await axios.put<IInitialCashFundEntry>(
    `${API_URL(tiendaId)}/${cierreId}/initial-cash-fund`,
    { amounts },
  );
  return response.data;
};
