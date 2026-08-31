"use client";

import { useEffect, useState, type ReactNode } from "react";
import {
  Paper,
  Box,
  Typography,
  Link,
  Stack,
  CircularProgress,
  Divider,
  IconButton,
  alpha,
  useMediaQuery,
  useTheme,
} from "@mui/material";
import { Warning, Info, Campaign, Message, Close } from "@mui/icons-material";
import {
  INotificacionConEstado,
  NivelImportancia,
  TipoNotificacion,
} from "@/schemas/notificacion";
import { NotificationApiService } from "@/services/notificationApiService";
import { StatusPill } from "@/components/StatusPill";
import type { PillHue } from "@/components/StatusPill";
import { useMessageContext } from "@/context/MessageContext";
import dayjs from "dayjs";

interface NotificationPanelProps {
  open: boolean;
  anchorEl: HTMLElement | null;
  onClose: () => void;
}

const IMPORTANCE: Record<NivelImportancia, { label: string; hue: PillHue }> = {
  CRITICA: { label: "Crítica", hue: "negative" },
  ALTA: { label: "Alta", hue: "caution" },
  MEDIA: { label: "Media", hue: "info" },
  BAJA: { label: "Baja", hue: "neutral" },
};

const getTipoIcon = (tipo: TipoNotificacion) => {
  const iconProps = { sx: { fontSize: 20 } };
  switch (tipo) {
    case "ALERTA":
      return <Warning {...iconProps} />;
    case "PROMOCION":
      return <Campaign {...iconProps} />;
    case "MENSAJE":
      return <Message {...iconProps} />;
    default:
      return <Info {...iconProps} />;
  }
};

const getTipoPaletteColor = (tipo: TipoNotificacion): string => {
  switch (tipo) {
    case "ALERTA":
      return "error";
    case "PROMOCION":
      return "secondary";
    case "MENSAJE":
      return "success";
    default:
      return "info";
  }
};

/**
 * Shared list — same row shape in both the desktop floating panel and the
 * mobile full sheet (`rediseno/notificaciones-campana.html` and
 * `-movil.html` draw an identical row, just at different container widths).
 */
function NotificationList({
  loading,
  notifications,
}: {
  loading: boolean;
  notifications: INotificacionConEstado[];
}) {
  if (loading) {
    return (
      <Box
        sx={{
          display: "flex",
          justifyContent: "center",
          alignItems: "center",
          height: 200,
        }}
      >
        <CircularProgress size={32} />
      </Box>
    );
  }

  if (notifications.length === 0) {
    return (
      <Box
        sx={{
          display: "flex",
          justifyContent: "center",
          alignItems: "center",
          height: 200,
          color: "text.secondary",
        }}
      >
        <Typography variant="body2">No hay notificaciones activas</Typography>
      </Box>
    );
  }

  return (
    <>
      {notifications.map((notification, idx) => (
        <Box key={notification.id}>
          <Box
            sx={{
              p: 2,
              backgroundColor: notification.yaLeida
                ? "transparent"
                : "semantic.surface.sunken",
              "&:hover": { backgroundColor: "semantic.surface.border" },
              cursor: "default",
            }}
          >
            <Stack direction="row" spacing={1.5} alignItems="flex-start">
              <Box
                sx={(theme) => ({
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  width: 36,
                  height: 36,
                  borderRadius: "50%",
                  backgroundColor: alpha(
                    theme.palette[getTipoPaletteColor(notification.tipo)].main,
                    0.08,
                  ),
                  color:
                    theme.palette[getTipoPaletteColor(notification.tipo)].main,
                  flexShrink: 0,
                })}
              >
                {getTipoIcon(notification.tipo)}
              </Box>

              <Stack spacing={0.5} sx={{ flex: 1, minWidth: 0 }}>
                <Stack
                  direction="row"
                  spacing={1}
                  alignItems="center"
                  justifyContent="space-between"
                  sx={{ mb: 0.5 }}
                >
                  <StatusPill
                    label={
                      IMPORTANCE[notification.nivelImportancia]?.label ??
                      notification.nivelImportancia
                    }
                    hue={
                      IMPORTANCE[notification.nivelImportancia]?.hue ??
                      "neutral"
                    }
                  />
                  <Typography
                    variant="caption"
                    color="textSecondary"
                    sx={{ ml: "auto" }}
                  >
                    {dayjs(notification.fechaInicio).format("DD/MM HH:mm")}
                  </Typography>
                </Stack>

                <Typography
                  variant="body2"
                  fontWeight="medium"
                  sx={{
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                  }}
                >
                  {notification.titulo}
                </Typography>

                <Typography
                  variant="caption"
                  color="textSecondary"
                  sx={{
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    display: "-webkit-box",
                    WebkitLineClamp: 1,
                    WebkitBoxOrient: "vertical",
                  }}
                >
                  {notification.descripcion}
                </Typography>
              </Stack>

              {!notification.yaLeida && (
                <Box
                  sx={{
                    width: 8,
                    height: 8,
                    borderRadius: "50%",
                    backgroundColor: "primary.main",
                    flexShrink: 0,
                    mt: 1,
                  }}
                />
              )}
            </Stack>
          </Box>
          {idx < notifications.length - 1 && <Divider sx={{ m: 0 }} />}
        </Box>
      ))}
    </>
  );
}

function ScrollArea({ children }: { children: ReactNode }) {
  return (
    <Box
      sx={{
        flex: 1,
        overflowY: "auto",
        "&::-webkit-scrollbar": { width: "6px" },
        "&::-webkit-scrollbar-track": { background: "transparent" },
        "&::-webkit-scrollbar-thumb": {
          background: "divider",
          borderRadius: "3px",
          "&:hover": { background: "action.disabled" },
        },
      }}
    >
      {children}
    </Box>
  );
}

/**
 * Bell panel, from `rediseno/notificaciones-campana.html` (+ `-movil`).
 *
 * Desktop: a small floating panel anchored under the bell.
 * Mobile: "la campana abre una hoja completa" — a full sheet that covers the
 * content below the app bar (the header stays visible), with its own close
 * button, not a shrunk-down version of the desktop popover.
 */
export function NotificationPanel({
  open,
  anchorEl,
  onClose,
}: NotificationPanelProps) {
  const [notifications, setNotifications] = useState<INotificacionConEstado[]>(
    [],
  );
  const [loading, setLoading] = useState(false);
  const { showMessage } = useMessageContext();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down("sm"));

  useEffect(() => {
    if (!open) return;
    fetchNotifications();
  }, [open]);

  const fetchNotifications = async () => {
    setLoading(true);
    try {
      const data = await NotificationApiService.getActiveNotifications();
      setNotifications(data);
    } catch (error) {
      console.error("Error loading notifications", error);
    } finally {
      setLoading(false);
    }
  };

  const handleMarkAllAsRead = async () => {
    try {
      const unreadIds = notifications
        .filter((n) => !n.yaLeida)
        .map((n) => n.id);

      for (const id of unreadIds) {
        await NotificationApiService.markAsRead(id);
      }

      setNotifications((prev) => prev.map((n) => ({ ...n, yaLeida: true })));
      showMessage("Todas las notificaciones marcadas como leídas", "success");
    } catch (error) {
      console.error("Error marking notifications as read", error);
      showMessage("Error al marcar notificaciones como leídas", "error");
    }
  };

  if (!open) return null;

  if (isMobile) {
    const headerHeight = 56;
    return (
      <Box
        sx={{
          position: "fixed",
          top: headerHeight,
          left: 0,
          right: 0,
          bottom: 0,
          zIndex: (t) => t.zIndex.drawer,
          backgroundColor: "background.paper",
          display: "flex",
          flexDirection: "column",
        }}
      >
        <Box
          sx={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 1.25,
            height: 52,
            flex: "0 0 auto",
            px: 2,
            borderBottom: 1,
            borderColor: "divider",
          }}
        >
          <Typography sx={{ fontSize: "1.0625rem", fontWeight: 700 }}>
            Notificaciones
          </Typography>
          <Stack direction="row" spacing={1.75} alignItems="center">
            <Link
              component="button"
              onClick={(e) => {
                e.preventDefault();
                handleMarkAllAsRead();
              }}
              underline="hover"
              sx={{ fontSize: "0.8125rem", cursor: "pointer" }}
            >
              Marcar todas
            </Link>
            <IconButton
              onClick={onClose}
              size="small"
              sx={{ color: "text.secondary" }}
              aria-label="Cerrar notificaciones"
            >
              <Close fontSize="small" />
            </IconButton>
          </Stack>
        </Box>

        <ScrollArea>
          <NotificationList loading={loading} notifications={notifications} />
        </ScrollArea>

        <Link
          href="/configuracion/notificaciones"
          underline="hover"
          onClick={onClose}
          sx={{
            fontSize: "0.9375rem",
            fontWeight: 600,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            height: 52,
            flex: "0 0 auto",
            borderTop: 1,
            borderColor: "divider",
            cursor: "pointer",
          }}
        >
          Ver y gestionar todas
        </Link>
      </Box>
    );
  }

  if (!anchorEl) return null;

  const rect = anchorEl.getBoundingClientRect();
  const top = rect.bottom + 8;
  const right = window.innerWidth - rect.right;

  return (
    <Paper
      sx={(t) => ({
        position: "fixed",
        top,
        right,
        width: 396,
        maxHeight: 500,
        borderRadius: 2,
        boxShadow: `0 20px 25px -5px ${alpha(t.palette.common.black, 0.1)}, 0 10px 10px -5px ${alpha(t.palette.common.black, 0.04)}`,
        zIndex: 1300,
        display: "flex",
        flexDirection: "column",
        backgroundColor: "background.paper",
      })}
    >
      <Box sx={{ p: 2, borderBottom: "1px solid", borderColor: "divider" }}>
        <Stack
          direction="row"
          justifyContent="space-between"
          alignItems="center"
        >
          <Typography variant="h6">Notificaciones</Typography>
          <Link
            component="button"
            onClick={(e) => {
              e.preventDefault();
              handleMarkAllAsRead();
            }}
            underline="hover"
            sx={{ fontSize: "0.8125rem", cursor: "pointer" }}
          >
            Marcar todas como leídas
          </Link>
        </Stack>
      </Box>

      <ScrollArea>
        <NotificationList loading={loading} notifications={notifications} />
      </ScrollArea>

      <Box
        sx={{
          p: 2,
          borderTop: "1px solid",
          borderColor: "divider",
          backgroundColor: "background.paper",
        }}
      >
        <Link
          href="/configuracion/notificaciones"
          underline="hover"
          sx={{
            fontSize: "0.8125rem",
            display: "block",
            textAlign: "center",
            cursor: "pointer",
          }}
        >
          Ver y gestionar todas
        </Link>
      </Box>
    </Paper>
  );
}
