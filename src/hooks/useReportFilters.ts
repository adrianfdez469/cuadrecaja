"use client";

import { useCallback, useState } from "react";
import dayjs, { Dayjs } from "dayjs";
import type { IReportPeriod } from "@/schemas/reports/common";

export type ReportFilters = {
  periodo: IReportPeriod;
  fechaInicio: Dayjs | null;
  fechaFin: Dayjs | null;
};

export type ReportFiltersQuery = {
  periodo: string;
  fechaInicio?: string;
  fechaFin?: string;
};

const DATE_FORMAT = "YYYY-MM-DD";

/**
 * Period filter state shared by the dashboard and every report page.
 *
 * `ready` is the important part: in "personalizado" both dates must be set
 * before a request is worth firing, and every caller used to re-derive that
 * check by hand.
 */
export function useReportFilters(initial?: Partial<ReportFilters>) {
  const [filters, setFilters] = useState<ReportFilters>({
    periodo: initial?.periodo ?? "mes",
    fechaInicio: initial?.fechaInicio ?? null,
    fechaFin: initial?.fechaFin ?? null,
  });

  const setPeriodo = useCallback((periodo: IReportPeriod) => {
    setFilters((prev) => {
      const next: ReportFilters = { ...prev, periodo };
      // Entering custom mode with no dates: default both ends to today.
      if (periodo === "personalizado" && !prev.fechaInicio) {
        const today = dayjs();
        next.fechaInicio = today;
        next.fechaFin = today;
      }
      return next;
    });
  }, []);

  const setFechaInicio = useCallback((fechaInicio: Dayjs | null) => {
    setFilters((prev) => ({ ...prev, fechaInicio }));
  }, []);

  const setFechaFin = useCallback((fechaFin: Dayjs | null) => {
    setFilters((prev) => ({ ...prev, fechaFin }));
  }, []);

  const ready =
    filters.periodo !== "personalizado" ||
    Boolean(filters.fechaInicio && filters.fechaFin);

  const toQuery = useCallback((): ReportFiltersQuery => {
    const query: ReportFiltersQuery = { periodo: filters.periodo };
    if (filters.periodo === "personalizado") {
      if (filters.fechaInicio) {
        query.fechaInicio = filters.fechaInicio.format(DATE_FORMAT);
      }
      if (filters.fechaFin) {
        query.fechaFin = filters.fechaFin.format(DATE_FORMAT);
      }
    }
    return query;
  }, [filters]);

  return {
    filters,
    setPeriodo,
    setFechaInicio,
    setFechaFin,
    ready,
    toQuery,
  };
}
