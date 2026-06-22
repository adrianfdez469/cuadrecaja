"use client";

import HelpOutlineIcon from "@mui/icons-material/HelpOutline";
import InfoOutlinedIcon from "@mui/icons-material/InfoOutlined";
import {
  Alert,
  Box,
  Checkbox,
  FormControlLabel,
  IconButton,
  Paper,
  Switch,
  Tooltip,
  Typography,
} from "@mui/material";
import { useSession } from "next-auth/react";
import { TipoLocal } from "@/schemas/tienda";
import { useAppContext } from "@/context/AppContext";
import { usePermisos } from "@/utils/permisos_front";
import { useOnboardingStore } from "../store/onboardingStore";
import { ONBOARDING_TOURS } from "../tours/primerosPasos";
import {
  getPermisoLabel,
  isTourEnabledForUser,
  normalizeOnboardingSettings,
} from "../utils/onboardingSettings";

export function PrimerosPasosSettings() {
  const { user } = useAppContext();
  const { data: session } = useSession();
  const { verificarPermiso } = usePermisos();

  const userId =
    user?.id ?? (session?.user as { id?: string } | undefined)?.id ?? null;

  const rawSettings = useOnboardingStore((s) =>
    userId ? s.userProgress[userId]?.settings : undefined,
  );
  const setMasterEnabled = useOnboardingStore((s) => s.setMasterEnabled);
  const setTourEnabled = useOnboardingStore((s) => s.setTourEnabled);

  const isTienda = user?.localActual?.tipo === TipoLocal.TIENDA;

  if (!userId) return null;

  const settings = normalizeOnboardingSettings(rawSettings);
  const masterOn = settings.enabled;

  return (
    <Paper variant="outlined" sx={{ p: { xs: 2, sm: 3 }, borderRadius: 3 }}>
      <Box display="flex" alignItems="center" gap={1} mb={1}>
        <HelpOutlineIcon color="primary" />
        <Typography variant="h6" fontWeight={700}>
          Primeros pasos
        </Typography>
      </Box>

      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
        Las guías interactivas se muestran al entrar al inicio cuando están
        activadas. Puedes volver a activarlas aquí en cualquier momento.
      </Typography>

      {!isTienda ? (
        <Alert severity="info" sx={{ mb: 2 }}>
          Las guías de primeros pasos solo están disponibles cuando trabajas en
          una tienda (no en almacén).
        </Alert>
      ) : null}

      <FormControlLabel
        sx={{ mb: 2, ml: 0 }}
        control={
          <Switch
            checked={masterOn}
            onChange={(_, checked) => setMasterEnabled(userId, checked)}
            disabled={!isTienda}
          />
        }
        label={
          <Box>
            <Typography fontWeight={600}>
              Activar guías de primeros pasos
            </Typography>
            <Typography variant="caption" color="text.secondary">
              Control general para todas las guías de esta sección
            </Typography>
          </Box>
        }
      />

      <Box
        sx={{
          opacity: masterOn && isTienda ? 1 : 0.55,
          pointerEvents: masterOn && isTienda ? "auto" : "none",
        }}
      >
        {ONBOARDING_TOURS.map((tour) => {
          const hasPermission = verificarPermiso(tour.permission);
          const checked = isTourEnabledForUser(settings, tour.id);
          const disabled = !hasPermission || !isTienda;

          return (
            <Box
              key={tour.id}
              sx={{
                display: "flex",
                alignItems: "flex-start",
                gap: 0.5,
                py: 1,
                borderTop: "1px solid",
                borderColor: "divider",
              }}
            >
              <Checkbox
                checked={checked}
                disabled={disabled}
                onChange={(_, value) => setTourEnabled(userId, tour.id, value)}
                sx={{ mt: 0.25 }}
              />
              <Box flex={1}>
                <Typography fontWeight={600}>{tour.title}</Typography>
                <Typography variant="body2" color="text.secondary">
                  {tour.description}
                </Typography>
              </Box>
              {!hasPermission ? (
                <Tooltip
                  title={`No tienes permiso para esta guía: ${getPermisoLabel(tour.permission)}`}
                  arrow
                  placement="left"
                >
                  <IconButton size="small" aria-label="Requisito de permiso">
                    <InfoOutlinedIcon fontSize="small" color="action" />
                  </IconButton>
                </Tooltip>
              ) : null}
            </Box>
          );
        })}
      </Box>
    </Paper>
  );
}
