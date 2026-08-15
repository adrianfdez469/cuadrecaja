"use client";

import { ReactNode, useMemo, useState } from "react";
import {
  Alert,
  Box,
  Button,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TablePagination,
  TableRow,
  TableSortLabel,
} from "@mui/material";
import { Download } from "@mui/icons-material";
import { useAppContext } from "@/context/AppContext";

export type ReportColumn<TRow> = {
  key: string;
  label: string;
  align?: "left" | "right" | "center";
  render: (row: TRow) => ReactNode;
  /** Omit to make the column non-sortable. */
  sortValue?: (row: TRow) => number | string;
  width?: number | string;
  /**
   * Raw value for Excel export. Defaults to `sortValue`, so numeric columns
   * stay numeric in the spreadsheet; set explicitly when neither applies.
   */
  exportValue?: (row: TRow) => string | number | null;
};

type ReportDataTableProps<TRow> = {
  rows: TRow[];
  columns: ReportColumn<TRow>[];
  getRowKey: (row: TRow, index: number) => string;
  emptyMessage?: string;
  initialSortKey?: string;
  initialSortDirection?: "asc" | "desc";
  rowsPerPageOptions?: number[];
  dense?: boolean;
  /** Enables the Excel export button; used as file and sheet name. */
  exportName?: string;
};

/**
 * Sortable, paginated table shared by the report pages.
 *
 * Horizontal overflow is contained here so wide reports scroll inside their own
 * card instead of pushing the page sideways on mobile.
 */
export function ReportDataTable<TRow>({
  rows,
  columns,
  getRowKey,
  emptyMessage = "No hay datos disponibles",
  initialSortKey,
  initialSortDirection = "desc",
  rowsPerPageOptions = [10, 25, 50],
  dense = true,
  exportName,
}: ReportDataTableProps<TRow>) {
  const { user } = useAppContext();
  const [sortKey, setSortKey] = useState<string | null>(initialSortKey ?? null);
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">(
    initialSortDirection,
  );
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(rowsPerPageOptions[0]);

  const sortedRows = useMemo(() => {
    const column = columns.find((c) => c.key === sortKey);
    if (!column?.sortValue) return rows;

    return [...rows].sort((a, b) => {
      const left = column.sortValue!(a);
      const right = column.sortValue!(b);
      const comparison =
        typeof left === "number" && typeof right === "number"
          ? left - right
          : String(left).localeCompare(String(right), "es");
      return sortDirection === "asc" ? comparison : -comparison;
    });
  }, [rows, columns, sortKey, sortDirection]);

  const visibleRows = useMemo(
    () =>
      sortedRows.slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage),
    [sortedRows, page, rowsPerPage],
  );

  const handleSort = (key: string) => {
    if (sortKey === key) {
      setSortDirection((prev) => (prev === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDirection("desc");
    }
    setPage(0);
  };

  const handleExport = async () => {
    // Importado aquí y no arriba: `xlsx` solo hace falta al exportar, y
    // estáticamente entraba en el bundle inicial de todos los reportes.
    const { exportReportTableToExcel } =
      await import("@/utils/reportExcelExport");
    exportReportTableToExcel({
      rows: sortedRows,
      columns: columns.map((column) => ({
        header: column.label,
        value: (row: TRow) =>
          column.exportValue?.(row) ?? column.sortValue?.(row) ?? "",
      })),
      reportName: exportName ?? "Reporte",
      tiendaNombre: user?.localActual?.nombre ?? "",
    });
  };

  if (rows.length === 0) {
    return <Alert severity="info">{emptyMessage}</Alert>;
  }

  return (
    <Box>
      {exportName && (
        <Stack direction="row" justifyContent="flex-end" sx={{ mb: 1 }}>
          <Button size="small" startIcon={<Download />} onClick={handleExport}>
            Exportar a Excel
          </Button>
        </Stack>
      )}

      <TableContainer sx={{ overflowX: "auto" }}>
        <Table size={dense ? "small" : "medium"}>
          <TableHead>
            <TableRow>
              {columns.map((column) => (
                <TableCell
                  key={column.key}
                  align={column.align ?? "left"}
                  sx={{ width: column.width, whiteSpace: "nowrap" }}
                >
                  {column.sortValue ? (
                    <TableSortLabel
                      active={sortKey === column.key}
                      direction={
                        sortKey === column.key ? sortDirection : "desc"
                      }
                      onClick={() => handleSort(column.key)}
                    >
                      {column.label}
                    </TableSortLabel>
                  ) : (
                    column.label
                  )}
                </TableCell>
              ))}
            </TableRow>
          </TableHead>
          <TableBody>
            {visibleRows.map((row, index) => (
              <TableRow key={getRowKey(row, index)} hover>
                {columns.map((column) => (
                  <TableCell key={column.key} align={column.align ?? "left"}>
                    {column.render(row)}
                  </TableCell>
                ))}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>

      {rows.length > rowsPerPageOptions[0] && (
        <TablePagination
          component="div"
          count={rows.length}
          page={page}
          onPageChange={(_, nextPage) => setPage(nextPage)}
          rowsPerPage={rowsPerPage}
          onRowsPerPageChange={(event) => {
            setRowsPerPage(parseInt(event.target.value, 10));
            setPage(0);
          }}
          rowsPerPageOptions={rowsPerPageOptions}
          labelRowsPerPage="Filas"
        />
      )}
    </Box>
  );
}
