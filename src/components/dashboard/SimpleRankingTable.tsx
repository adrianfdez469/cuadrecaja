"use client";

import {
  Alert,
  Card,
  CardContent,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Typography,
} from "@mui/material";

type SimpleRankingTableProps<TRow> = {
  title: string;
  valueLabel: string;
  rows: TRow[];
  getName: (row: TRow) => string;
  getValue: (row: TRow) => string;
};

/**
 * Two-column ranking used by the dashboard's "least sold" and "least
 * profitable" panels.
 */
export function SimpleRankingTable<TRow>({
  title,
  valueLabel,
  rows,
  getName,
  getValue,
}: SimpleRankingTableProps<TRow>) {
  return (
    <Card sx={{ height: "100%" }}>
      <CardContent>
        <Typography variant="h6" gutterBottom>
          {title}
        </Typography>

        {rows.length === 0 ? (
          <Alert severity="info">No hay datos disponibles</Alert>
        ) : (
          <TableContainer>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>Producto</TableCell>
                  <TableCell align="right">{valueLabel}</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {rows.map((row, index) => (
                  <TableRow key={`${getName(row)}-${index}`}>
                    <TableCell>{getName(row)}</TableCell>
                    <TableCell align="right">{getValue(row)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        )}
      </CardContent>
    </Card>
  );
}
