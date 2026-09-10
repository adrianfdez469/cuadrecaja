"use client";

import { Box, ButtonBase, Stack, Typography } from "@mui/material";
import { touch } from "@/theme";
import { CLIENTES_COPY, CLIENTES_DOM } from "@/constants/clientes";
import { ClienteSaldoAmount } from "@/components/clientes/ClienteSaldoAmount";
import type { IClienteConSaldo } from "@/schemas/clienteSaldo";

export interface IClientesMobileListProps {
  clientes: IClienteConSaldo[];
  /** Absent when the session cannot write: the row stops being a button altogether. */
  onOpenActions?: (cliente: IClienteConSaldo) => void;
}

/**
 * The list below 600px: one row per cliente.
 *
 * A table is not compressed, it is forked — the standard `GestionInventarioPage` already
 * follows. The name wraps to at most two lines and is never cut with JavaScript: what an
 * ellipsis eats is exactly what tells two similar clientes apart.
 */
export function ClientesMobileList({
  clientes,
  onOpenActions,
}: Readonly<IClientesMobileListProps>) {
  const interactive = typeof onOpenActions === "function";

  return (
    <Box className={CLIENTES_DOM.list}>
      {clientes.map((cliente) => {
        const content = (
          <Stack
            direction="row"
            alignItems="center"
            spacing={1.5}
            sx={{ width: "100%" }}
          >
            <Box sx={{ minWidth: 0, flex: 1, textAlign: "left" }}>
              <Typography
                sx={{
                  fontSize: "0.9375rem",
                  fontWeight: 600,
                  color: "semantic.text.primary",
                  whiteSpace: "normal",
                  overflowWrap: "anywhere",
                  display: "-webkit-box",
                  WebkitBoxOrient: "vertical",
                  WebkitLineClamp: 2,
                  overflow: "hidden",
                }}
              >
                {cliente.nombre}
              </Typography>
              <Typography
                variant="body2"
                sx={{
                  color: "semantic.text.secondary",
                  whiteSpace: "nowrap",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                }}
              >
                {cliente.telefono || CLIENTES_COPY.sinContacto}
              </Typography>
            </Box>
            <ClienteSaldoAmount saldo={cliente.saldo} />
          </Stack>
        );

        const rowSx = {
          width: "100%",
          display: "flex",
          alignItems: "center",
          minHeight: touch.rowLarge,
          px: 1.5,
          py: 1.25,
          borderTop: "1px solid",
          borderColor: "semantic.surface.border",
          bgcolor: "semantic.surface.raised",
          "&:first-of-type": { borderTop: "none" },
        } as const;

        return interactive ? (
          <ButtonBase
            key={cliente.id}
            className={CLIENTES_DOM.row}
            onClick={() => onOpenActions(cliente)}
            sx={{
              ...rowSx,
              cursor: "pointer",
              "@media (hover: hover)": {
                "&:hover": { bgcolor: "semantic.surface.sunken" },
              },
            }}
          >
            {content}
          </ButtonBase>
        ) : (
          <Box key={cliente.id} className={CLIENTES_DOM.row} sx={rowSx}>
            {content}
          </Box>
        );
      })}
    </Box>
  );
}

export default ClientesMobileList;
