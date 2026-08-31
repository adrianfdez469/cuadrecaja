"use client";

import { Box, IconButton, Stack, Tooltip, Typography } from "@mui/material";
import { Delete, Edit } from "@mui/icons-material";
import { IRol } from "@/schemas/rol";
import { RolGlobalBadge } from "./RolGlobalBadge";
import { RolPermisosPreview } from "./RolPermisosPreview";

interface Props {
  rol: IRol;
  puedeEditar: boolean;
  onEdit: () => void;
  onDelete: () => void;
}

/** One role, as a card — the mobile layout `rediseno/roles-movil.html` gives roles instead of a cropped desktop table. */
export function RolCard({ rol, puedeEditar, onEdit, onDelete }: Props) {
  const permisos = rol.permisos.split("|");

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
      <Stack direction="row" flexWrap="wrap" alignItems="center" gap={1}>
        <Typography variant="subtitle1" fontWeight={700}>
          {rol.nombre}
        </Typography>
        {rol.isGlobal && <RolGlobalBadge />}
      </Stack>

      <Typography variant="body2" color="text.secondary" sx={{ mt: 0.75 }}>
        {rol.descripcion || "Sin descripción"}
      </Typography>

      <Box sx={{ mt: 1.5, pt: 1.5, borderTop: 1, borderColor: "divider" }}>
        <Typography variant="caption" color="text.disabled">
          Permisos
        </Typography>
        <Box sx={{ mt: 0.75 }}>
          <RolPermisosPreview permisos={permisos} direction="column" />
        </Box>
      </Box>

      <Stack
        direction="row"
        justifyContent="flex-end"
        sx={{ mt: 1, pt: 0.75, borderTop: 1, borderColor: "divider" }}
      >
        <Tooltip
          title={
            puedeEditar
              ? "Editar"
              : "Solo un superadmin puede modificar roles globales"
          }
        >
          <span>
            <IconButton
              onClick={onEdit}
              disabled={!puedeEditar}
              color="primary"
            >
              <Edit fontSize="small" />
            </IconButton>
          </span>
        </Tooltip>
        <Tooltip
          title={
            rol.isGlobal
              ? "Los roles globales no pueden ser eliminados"
              : "Eliminar"
          }
        >
          <span>
            <IconButton
              onClick={onDelete}
              disabled={rol.isGlobal}
              color="error"
            >
              <Delete fontSize="small" />
            </IconButton>
          </span>
        </Tooltip>
      </Stack>
    </Box>
  );
}
