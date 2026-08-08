import axiosClient from "@/lib/axiosClient";
import type { ISalesTrendsResponse } from "@/schemas/reports/salesTrends";
import type { IInventoryReportResponse } from "@/schemas/reports/inventoryReport";
import type { IProfitabilityReportResponse } from "@/schemas/reports/profitabilityReport";
import type { IOperationsReportResponse } from "@/schemas/reports/operationsReport";
import type { IShrinkageReportResponse } from "@/schemas/reports/shrinkageReport";

export type ReportQuery = Record<string, unknown>;

export const getSalesTrendsReport = async (
  tiendaId: string,
  params?: ReportQuery,
): Promise<ISalesTrendsResponse> => {
  const { data } = await axiosClient.get(
    `/api/reportes/${tiendaId}/tendencias`,
    { params },
  );
  return data;
};

export const getInventoryReport = async (
  tiendaId: string,
  params?: ReportQuery,
): Promise<IInventoryReportResponse> => {
  const { data } = await axiosClient.get(
    `/api/reportes/${tiendaId}/inventario`,
    { params },
  );
  return data;
};

export const getProfitabilityReport = async (
  tiendaId: string,
  params?: ReportQuery,
): Promise<IProfitabilityReportResponse> => {
  const { data } = await axiosClient.get(
    `/api/reportes/${tiendaId}/rentabilidad`,
    { params },
  );
  return data;
};

export const getOperationsReport = async (
  tiendaId: string,
  params?: ReportQuery,
): Promise<IOperationsReportResponse> => {
  const { data } = await axiosClient.get(
    `/api/reportes/${tiendaId}/operacion`,
    {
      params,
    },
  );
  return data;
};

export const getShrinkageReport = async (
  tiendaId: string,
  params?: ReportQuery,
): Promise<IShrinkageReportResponse> => {
  const { data } = await axiosClient.get(`/api/reportes/${tiendaId}/mermas`, {
    params,
  });
  return data;
};
