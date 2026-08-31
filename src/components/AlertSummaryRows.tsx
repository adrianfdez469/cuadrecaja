"use client";

import React, { useState, useEffect } from "react";
import {
  Box,
  Paper,
  Stack,
  Typography,
  Badge,
  CircularProgress,
} from "@mui/material";
import {
  Error as ErrorIcon,
  Notifications as NotificationsIcon,
  ChevronRight,
} from "@mui/icons-material";
import { useRouter } from "next/navigation";
import axiosClient from "@/lib/axiosClient";

interface AlertSummaryRowsProps {
  tiendaId?: string;
}

/**
 * Clickable summary rows for Vencidos and Notificaciones.
 * Replaces the expanded ExpiringProductsAlert and NotificationsWidget
 * with compact, clickable rows that navigate to the details.
 */
export default function AlertSummaryRows({ tiendaId }: AlertSummaryRowsProps) {
  const router = useRouter();
  const [vencidosCount, setVencidosCount] = useState(0);
  const [notificationsCount, setNotificationsCount] = useState(0);
  const [loadingVencidos, setLoadingVencidos] = useState(true);
  const [loadingNotifications, setLoadingNotifications] = useState(true);

  // Load expired products count
  useEffect(() => {
    if (!tiendaId) {
      setLoadingVencidos(false);
      return;
    }

    axiosClient
      .get<{ vencidos: Array<{ id: string }> }>(
        `/api/productos_tienda/expirando?tiendaId=${tiendaId}`,
      )
      .then((res) => {
        setVencidosCount(res.data.vencidos?.length || 0);
      })
      .catch(() => setVencidosCount(0))
      .finally(() => setLoadingVencidos(false));
  }, [tiendaId]);

  // Load notifications count
  useEffect(() => {
    if (!tiendaId) {
      setLoadingNotifications(false);
      return;
    }

    axiosClient
      .get<{ nuevas: number }>(`/api/notificaciones/count?tiendaId=${tiendaId}`)
      .then((res) => {
        setNotificationsCount(res.data.nuevas || 0);
      })
      .catch(() => setNotificationsCount(0))
      .finally(() => setLoadingNotifications(false));
  }, [tiendaId]);

  // Don't show if both are zero
  if (vencidosCount === 0 && notificationsCount === 0) {
    return null;
  }

  return (
    <Box
      sx={{
        display: "grid",
        gap: 1.5,
        gridTemplateColumns: {
          xs: "1fr",
          md: "repeat(auto-fit, minmax(280px, 1fr))",
        },
      }}
    >
      {/* Vencidos row */}
      {vencidosCount > 0 && (
        <Paper
          onClick={() => router.push("/inventario?filter=vencidos")}
          sx={{
            p: 2,
            cursor: "pointer",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            border: "1px solid",
            borderColor: "divider",
            borderRadius: 1,
            transition: "background-color 0.2s, border-color 0.2s",
            "&:hover": {
              backgroundColor: "semantic.surface.sunken",
              borderColor: "error.main",
            },
          }}
        >
          <Box sx={{ display: "flex", alignItems: "center", gap: 1.5 }}>
            <Box
              sx={{
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                width: 40,
                height: 40,
                borderRadius: "8px",
                backgroundColor: "error.light",
              }}
            >
              <ErrorIcon sx={{ fontSize: "1.25rem", color: "error.main" }} />
            </Box>
            <Stack spacing={0}>
              <Typography
                variant="body2"
                sx={{ fontWeight: 600, color: "text.primary" }}
              >
                Vencidos
              </Typography>
              <Typography variant="caption" sx={{ color: "text.secondary" }}>
                Productos expirados
              </Typography>
            </Stack>
          </Box>
          <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
            <Badge
              badgeContent={loadingVencidos ? undefined : vencidosCount}
              color="error"
              sx={{
                "& .MuiBadge-badge": {
                  backgroundColor: "error.main",
                  color: "error.contrastText",
                  fontWeight: 600,
                },
              }}
            >
              {loadingVencidos && <CircularProgress size={24} />}
            </Badge>
            <ChevronRight
              sx={{ color: "text.secondary", fontSize: "1.25rem" }}
            />
          </Box>
        </Paper>
      )}

      {/* Notificaciones row */}
      {notificationsCount > 0 && (
        <Paper
          onClick={() => router.push("/configuracion/notificaciones")}
          sx={{
            p: 2,
            cursor: "pointer",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            border: "1px solid",
            borderColor: "divider",
            borderRadius: 1,
            transition: "background-color 0.2s, border-color 0.2s",
            "&:hover": {
              backgroundColor: "semantic.surface.sunken",
              borderColor: "error.main",
            },
          }}
        >
          <Box sx={{ display: "flex", alignItems: "center", gap: 1.5 }}>
            <Box
              sx={{
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                width: 40,
                height: 40,
                borderRadius: "8px",
                backgroundColor: "error.light",
              }}
            >
              <NotificationsIcon
                sx={{ fontSize: "1.25rem", color: "error.main" }}
              />
            </Box>
            <Stack spacing={0}>
              <Typography
                variant="body2"
                sx={{ fontWeight: 600, color: "text.primary" }}
              >
                Notificaciones
              </Typography>
              <Typography variant="caption" sx={{ color: "text.secondary" }}>
                Avisos nuevos
              </Typography>
            </Stack>
          </Box>
          <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
            <Badge
              badgeContent={
                loadingNotifications ? undefined : notificationsCount
              }
              color="error"
              sx={{
                "& .MuiBadge-badge": {
                  backgroundColor: "error.main",
                  color: "error.contrastText",
                  fontWeight: 600,
                },
              }}
            >
              {loadingNotifications && <CircularProgress size={24} />}
            </Badge>
            <ChevronRight
              sx={{ color: "text.secondary", fontSize: "1.25rem" }}
            />
          </Box>
        </Paper>
      )}
    </Box>
  );
}
