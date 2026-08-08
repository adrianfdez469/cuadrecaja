import * as XLSX from "xlsx";
import { saveAs } from "file-saver";

export type ReportExportColumn<TRow> = {
  header: string;
  /** Raw value — numbers stay numbers so Excel can sum them. */
  value: (row: TRow) => string | number | null;
};

type ExportReportTableOptions<TRow> = {
  rows: TRow[];
  columns: ReportExportColumn<TRow>[];
  /** Becomes the file name and the sheet name. */
  reportName: string;
  tiendaNombre: string;
  /** Rendered as a header block above the table. */
  meta?: Record<string, string>;
};

/** Excel caps sheet names at 31 chars and forbids []:*?/\ */
function sanitizeSheetName(name: string): string {
  return name.replace(/[[\]:*?/\\]/g, "").slice(0, 31) || "Reporte";
}

/**
 * Exports any report table to Excel.
 *
 * Values are written raw rather than pre-formatted so the spreadsheet stays
 * computable — formatting money into strings would make the columns unusable
 * for the arithmetic people actually open Excel to do.
 */
export const exportReportTableToExcel = <TRow>({
  rows,
  columns,
  reportName,
  tiendaNombre,
  meta = {},
}: ExportReportTableOptions<TRow>): void => {
  const workbook = XLSX.utils.book_new();

  const headerBlock: (string | number | null)[][] = [
    [reportName],
    ["Tienda", tiendaNombre],
    ...Object.entries(meta).map(([key, value]) => [key, value]),
    [],
  ];

  const table: (string | number | null)[][] = [
    columns.map((column) => column.header),
    ...rows.map((row) => columns.map((column) => column.value(row))),
  ];

  const sheet = XLSX.utils.aoa_to_sheet([...headerBlock, ...table]);
  sheet["!cols"] = columns.map(() => ({ wch: 20 }));

  XLSX.utils.book_append_sheet(workbook, sheet, sanitizeSheetName(reportName));

  const buffer = XLSX.write(workbook, { bookType: "xlsx", type: "array" });
  const stamp = new Date().toISOString().split("T")[0];

  saveAs(
    new Blob([buffer], { type: "application/octet-stream" }),
    `${reportName.replace(/\s+/g, "_")}_${stamp}.xlsx`,
  );
};
