"use client";

import { Box, IconButton, Stack, Tooltip, Typography } from "@mui/material";
import { Delete, Edit } from "@mui/icons-material";
import type { ILocal } from "@/schemas/tienda";
import { TipoLocalPill } from "./TipoLocalPill";
import { UsuariosLabel } from "./UsuariosLabel";

interface Props {
  local: ILocal;
  onEdit: () => void;
  onDelete: () => void;
}

/** One local, as a card — `rediseno/locales-movil.html`: tipo below the name, users as a list. */
export function LocalCard({ local, onEdit, onDelete }: Props) {
  return (
    <Box
      sx={{
        bgcolor: "background.paper",
        border: 1,
        borderColor: "divider",
        borderRadius: 3,
        p: 2,
      }}
    >
      <Stack
        direction="row"
        justifyContent="space-between"
        alignItems="flex-start"
        gap={1.5}
      >
        <Box sx={{ minWidth: 0 }}>
          <Typography
            variant="subtitle1"
            fontWeight={700}
            sx={{ lineHeight: 1.35 }}
          >
            {local.nombre}
          </Typography>
          <Box sx={{ mt: 0.75 }}>
            <TipoLocalPill tipo={local.tipo} />
          </Box>
        </Box>
        <Stack direction="row" sx={{ flexShrink: 0 }}>
          <Tooltip title="Editar local">
            <IconButton onClick={onEdit} color="primary">
              <Edit fontSize="small" />
            </IconButton>
          </Tooltip>
          <Tooltip title="Eliminar local">
            <IconButton onClick={onDelete} color="error">
              <Delete fontSize="small" />
            </IconButton>
          </Tooltip>
        </Stack>
      </Stack>

      <Box sx={{ mt: 1.5, pt: 1.5, borderTop: 1, borderColor: "divider" }}>
        {local.usuariosTiendas?.length || local.usuarios?.length ? (
          <>
            <Typography variant="caption" color="text.disabled">
              Usuarios
            </Typography>
            <Box sx={{ mt: 0.5 }}>
              <UsuariosLabel local={local} direction="column" />
            </Box>
          </>
        ) : (
          <UsuariosLabel local={local} />
        )}
      </Box>
    </Box>
  );
}
