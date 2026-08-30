"use client";

import { useEffect, useState } from "react";
import {
  Alert,
  AlertTitle,
  Box,
  Button,
  Skeleton,
  Typography,
} from "@mui/material";
import { Block, ContactSupport, Payment } from "@mui/icons-material";

import { SectionLabel } from "@/components/SectionLabel";
import { useAppContext } from "@/context/AppContext";
import { SUPPORT_PHONES, buildSupportWhatsAppUrl } from "@/constants/support";
import { SubscriptionService } from "@/services/subscriptionService";
import { shape, touch } from "@/theme/tokens";

import { SuspensionFacts } from "./components/SuspensionFacts";

interface SubscriptionStatus {
  daysRemaining: number;
  gracePeriodDays: number;
}

/** What suspension actually does, and what it does not touch. */
const CONSEQUENCES = [
  ["Acceso Restringido", "No puede acceder a las funcionalidades del sistema"],
  [
    "Usuarios Deshabilitados",
    "Todos los usuarios de su negocio han sido deshabilitados",
  ],
  [
    "Datos Preservados",
    "Su información y datos están seguros y no se han perdido",
  ],
  ["Reactivación Inmediata", "Al renovar, recuperará acceso inmediato"],
] as const;

const [PRIMARY_SUPPORT_PHONE] = SUPPORT_PHONES;

export default function SubscriptionExpired() {
  const { user } = useAppContext();
  const [subscriptionStatus, setSubscriptionStatus] =
    useState<SubscriptionStatus | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const checkSubscriptionStatus = async () => {
      if (!user?.negocio?.id) {
        setLoading(false);
        return;
      }
      try {
        const status = await SubscriptionService.getSubscriptionStatus(
          user.negocio.id,
        );
        setSubscriptionStatus(status);
      } catch (error) {
        console.error("Error al verificar estado de suscripción:", error);
      } finally {
        setLoading(false);
      }
    };

    checkSubscriptionStatus();
  }, [user?.negocio?.id]);

  return (
    <Box
      sx={{
        display: "flex",
        justifyContent: "center",
        px: 3,
        py: { xs: 4, md: 7 },
      }}
    >
      <Box sx={{ width: "100%", maxWidth: 760 }}>
        <Box sx={{ display: "flex", alignItems: "flex-start", gap: 2, mb: 4 }}>
          <Box
            aria-hidden
            sx={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              flex: "0 0 52px",
              width: 52,
              height: 52,
              borderRadius: "50%",
              bgcolor: "semantic.hue.negative.surface",
              color: "semantic.hue.negative.main",
            }}
          >
            <Block sx={{ fontSize: 26 }} />
          </Box>
          <Box sx={{ pt: "2px" }}>
            <Typography
              component="h1"
              sx={{
                fontSize: { xs: "1.5rem", sm: "1.875rem" },
                fontWeight: 700,
                lineHeight: 1.25,
                letterSpacing: "-0.02em",
              }}
            >
              Suscripción Suspendida
            </Typography>
            <Typography
              sx={{
                mt: 0.75,
                fontSize: "1rem",
                lineHeight: 1.5,
                color: "text.secondary",
              }}
            >
              Su cuenta ha sido suspendida automáticamente
            </Typography>
          </Box>
        </Box>

        <Box
          sx={{
            display: "flex",
            flexDirection: { xs: "column", sm: "row" },
            gap: 1.5,
            mb: 4,
          }}
        >
          <Button
            variant="contained"
            startIcon={<Payment />}
            href="/configuracion/planes"
            sx={{
              flex: 1,
              minHeight: touch.comfortable,
              borderRadius: `${shape.radius.md}px`,
              fontSize: "1rem",
            }}
          >
            Renovar Suscripción
          </Button>
          {/* WhatsApp to a real number with the renewal message already
              written. It used to open `mailto:soporte@cuadre-caja.com`, an
              address that does not exist. */}
          <Button
            variant="outlined"
            color="inherit"
            startIcon={<ContactSupport />}
            href={buildSupportWhatsAppUrl(
              PRIMARY_SUPPORT_PHONE.whatsapp,
              "expiredSubscription",
            )}
            target="_blank"
            rel="noopener noreferrer"
            sx={{
              flex: 1,
              minHeight: touch.comfortable,
              borderRadius: `${shape.radius.md}px`,
              fontSize: "1rem",
              fontWeight: 600,
              color: "text.secondary",
              borderColor: "semantic.surface.border",
              bgcolor: "semantic.surface.raised",
            }}
          >
            Contactar Soporte
          </Button>
        </Box>

        {/* One red block, not three: the page used to say «restricted» in a
            chip, an alert and a bullet, all in the same red. */}
        <Alert severity="error" sx={{ mb: 3 }}>
          <AlertTitle sx={{ fontWeight: 700 }}>Acceso restringido</AlertTitle>
          <Typography variant="body2">
            Su suscripción ha expirado y su cuenta ha sido suspendida
            automáticamente. Para reactivarla y recuperar el acceso completo al
            sistema, debe renovar su suscripción.
          </Typography>
        </Alert>

        <SectionLabel>Estado de su suscripción</SectionLabel>
        <Box sx={{ mb: 4 }}>
          {loading ? (
            <Skeleton variant="rounded" height={86} />
          ) : subscriptionStatus ? (
            <SuspensionFacts
              facts={[
                {
                  label: "Expiró hace",
                  value: `${Math.abs(subscriptionStatus.daysRemaining)} días`,
                  negative: true,
                },
                {
                  label: "Estado",
                  value: "Cuenta Suspendida",
                  negative: true,
                  text: true,
                },
                {
                  label: "Período de Gracia",
                  value: `${subscriptionStatus.gracePeriodDays} días`,
                },
              ]}
            />
          ) : null}
        </Box>

        <SectionLabel>¿Qué significa esto?</SectionLabel>
        <Box
          sx={{
            display: "flex",
            flexDirection: "column",
            gap: 1.75,
            px: 3,
            py: 2.75,
            mb: 3,
            bgcolor: "semantic.surface.raised",
            border: "1px solid",
            borderColor: "semantic.surface.border",
            borderRadius: `${shape.radius.md}px`,
          }}
        >
          {CONSEQUENCES.map(([term, detail]) => (
            <Box key={term} sx={{ display: "flex", gap: 1.5 }}>
              <Box
                aria-hidden
                sx={{
                  flex: "0 0 6px",
                  width: 6,
                  height: 6,
                  mt: "8px",
                  borderRadius: "50%",
                  bgcolor: "semantic.surface.borderStrong",
                }}
              />
              <Typography sx={{ fontSize: "0.9375rem", lineHeight: 1.55 }}>
                <Box component="strong" sx={{ fontWeight: 700 }}>
                  {term}:
                </Box>{" "}
                {detail}
              </Typography>
            </Box>
          ))}
        </Box>

        <Box
          sx={{
            px: 2.25,
            py: 2,
            bgcolor: "semantic.surface.sunken",
            borderRadius: `${shape.radius.md}px`,
            fontSize: "0.875rem",
            lineHeight: 1.55,
            color: "text.secondary",
          }}
        >
          <Typography sx={{ fontSize: "inherit", color: "inherit" }}>
            <Box
              component="strong"
              sx={{ fontWeight: 700, color: "text.primary" }}
            >
              ¿Necesita ayuda?
            </Box>{" "}
            Nuestro equipo de soporte está disponible para ayudarle con el
            proceso de renovación y cualquier pregunta que tenga.
          </Typography>
        </Box>
      </Box>
    </Box>
  );
}
