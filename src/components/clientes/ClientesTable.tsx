"use client";

import {
  IconButton,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Tooltip,
  Typography,
  useMediaQuery,
  useTheme,
} from "@mui/material";
import DeleteIcon from "@mui/icons-material/Delete";
import EditIcon from "@mui/icons-material/Edit";
import { layout } from "@/theme";
import { CLIENTES_COPY, CLIENTES_DOM } from "@/constants/clientes";
import { ClienteSaldoAmount } from "@/components/clientes/ClienteSaldoAmount";
import type { IClienteConSaldo } from "@/schemas/clienteSaldo";

export interface IClientesTableProps {
  clientes: IClienteConSaldo[];
  /** Both absent when the session cannot write: the whole `Acciones` column disappears. */
  onEdit?: (cliente: IClienteConSaldo) => void;
  onDeactivate?: (cliente: IClienteConSaldo) => void;
}

/**
 * The table from 600px up.
 *
 * The note and the address are a second line inside their cell from `md`: at 768px four
 * columns share ~704px of usable width and a second line leaves the name on three, so the
 * detail is CONTENT that appears when there is room, never a change of column count.
 */
export function ClientesTable({
  clientes,
  onEdit,
  onDeactivate,
}: Readonly<IClientesTableProps>) {
  const theme = useTheme();
  // Rendered, not hidden: `textContent` reads through `display: none`, so a detail merely
  // hidden below `md` would still be found by a criterion that asserts its absence.
  const showDetail = useMediaQuery(theme.breakpoints.up("md"));

  const canWrite =
    typeof onEdit === "function" && typeof onDeactivate === "function";

  return (
    <TableContainer
      sx={{
        maxHeight: { md: `calc(100dvh - ${layout.tableViewportOffset}px)` },
      }}
    >
      <Table stickyHeader className={CLIENTES_DOM.list}>
        <TableHead>
          <TableRow>
            <TableCell>{CLIENTES_COPY.columnaCliente}</TableCell>
            <TableCell>{CLIENTES_COPY.columnaContacto}</TableCell>
            <TableCell align="right">{CLIENTES_COPY.columnaSaldo}</TableCell>
            {canWrite && (
              <TableCell align="right">
                {CLIENTES_COPY.columnaAcciones}
              </TableCell>
            )}
          </TableRow>
        </TableHead>
        <TableBody>
          {clientes.map((cliente) => (
            <TableRow
              key={cliente.id}
              className={CLIENTES_DOM.row}
              hover={canWrite}
              sx={canWrite ? { cursor: "pointer" } : undefined}
            >
              <TableCell onClick={canWrite ? () => onEdit(cliente) : undefined}>
                <Typography
                  sx={{
                    fontSize: "0.9375rem",
                    fontWeight: 600,
                    color: "semantic.text.primary",
                    whiteSpace: "normal",
                    overflowWrap: "anywhere",
                  }}
                >
                  {cliente.nombre}
                </Typography>
                {showDetail && cliente.descripcion && (
                  <Typography
                    variant="body2"
                    sx={{ color: "semantic.text.secondary" }}
                  >
                    {cliente.descripcion}
                  </Typography>
                )}
              </TableCell>

              <TableCell onClick={canWrite ? () => onEdit(cliente) : undefined}>
                <Typography
                  variant="body2"
                  sx={{ color: "semantic.text.secondary" }}
                >
                  {cliente.telefono || CLIENTES_COPY.sinContacto}
                </Typography>
                {showDetail && cliente.direccion && (
                  <Typography
                    variant="body2"
                    sx={{ color: "semantic.text.secondary" }}
                  >
                    {cliente.direccion}
                  </Typography>
                )}
              </TableCell>

              <TableCell
                align="right"
                onClick={canWrite ? () => onEdit(cliente) : undefined}
              >
                <ClienteSaldoAmount saldo={cliente.saldo} showDash />
              </TableCell>

              {canWrite && (
                <TableCell align="right">
                  <Stack direction="row" spacing={0.5} justifyContent="flex-end">
                    <Tooltip title={CLIENTES_COPY.editarCliente}>
                      <IconButton
                        color="primary"
                        aria-label={CLIENTES_COPY.editarCliente}
                        onClick={() => onEdit(cliente)}
                      >
                        <EditIcon />
                      </IconButton>
                    </Tooltip>
                    <Tooltip title={CLIENTES_COPY.desactivarCliente}>
                      <IconButton
                        color="error"
                        aria-label={CLIENTES_COPY.desactivarCliente}
                        onClick={() => onDeactivate(cliente)}
                      >
                        <DeleteIcon />
                      </IconButton>
                    </Tooltip>
                  </Stack>
                </TableCell>
              )}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </TableContainer>
  );
}

export default ClientesTable;
