"use client";

import { Box, IconButton, Stack, Tooltip, Typography } from "@mui/material";
import { Delete, Edit, LockReset, MailOutline } from "@mui/icons-material";
import { StatusPill } from "@/components/StatusPill";
import type { IUsuarioListItem } from "@/schemas/usuario";

const PENDIENTE_VERIFICACION = "PENDIENTE_VERIFICACION" as const;

interface Props {
  usuario: IUsuarioListItem;
  canManage: boolean;
  canReinvite: boolean;
  resetPasswordSent: boolean;
  deleteDisabled: boolean;
  onEdit: () => void;
  onDelete: () => void;
  onReinvite: () => void;
  onResetPassword: () => void;
}

/** One user, as a card — `rediseno/usuarios-movil.html`: name + status on top, three 44px actions on the bottom. */
export function UsuarioCard({
  usuario,
  canManage,
  canReinvite,
  resetPasswordSent,
  deleteDisabled,
  onEdit,
  onDelete,
  onReinvite,
  onResetPassword,
}: Props) {
  const pendiente = usuario.estadoCuenta === PENDIENTE_VERIFICACION;

  return (
    <Box
      onClick={onEdit}
      sx={{
        bgcolor: "background.paper",
        border: 1,
        borderColor: "divider",
        borderRadius: 3,
        p: 2,
        cursor: "pointer",
      }}
    >
      <Typography
        variant="subtitle1"
        fontWeight={700}
        sx={{ lineHeight: 1.35 }}
      >
        {usuario.nombre}
      </Typography>
      <Stack
        direction="row"
        alignItems="center"
        gap={1}
        flexWrap="wrap"
        sx={{ mt: 0.75 }}
      >
        <Typography variant="body2" color="text.secondary">
          {usuario.usuario}
        </Typography>
        <StatusPill
          label={pendiente ? "Pendiente" : "Activo"}
          hue={pendiente ? "caution" : "positive"}
        />
        {usuario.rol === "SUPER_ADMIN" && (
          <StatusPill label={usuario.rol} hue="info" />
        )}
        {resetPasswordSent && <StatusPill label="Reset enviado" hue="info" />}
      </Stack>

      <Stack
        direction="row"
        gap={0.5}
        sx={{ mt: 1, pt: 1, borderTop: 1, borderColor: "divider" }}
        onClick={(e) => e.stopPropagation()}
      >
        {pendiente && canReinvite && (
          <Tooltip title="Reenviar invitación">
            <IconButton onClick={onReinvite} color="primary">
              <MailOutline fontSize="small" />
            </IconButton>
          </Tooltip>
        )}
        {canManage && !pendiente && (
          <Tooltip title="Enviar restablecimiento de contraseña">
            <IconButton onClick={onResetPassword} color="primary">
              <LockReset fontSize="small" />
            </IconButton>
          </Tooltip>
        )}
        <Tooltip title="Editar usuario">
          <IconButton onClick={onEdit} color="primary">
            <Edit fontSize="small" />
          </IconButton>
        </Tooltip>
        <Tooltip title="Eliminar usuario">
          <span>
            <IconButton
              onClick={onDelete}
              color="error"
              disabled={deleteDisabled}
            >
              <Delete fontSize="small" />
            </IconButton>
          </span>
        </Tooltip>
      </Stack>
    </Box>
  );
}
