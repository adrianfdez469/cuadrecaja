"use client";

import { Alert, AlertTitle, Box, Typography } from "@mui/material";

import type { LoginError } from "../loginError";

import { SupportContactList } from "./SupportContactList";

interface LoginErrorAlertProps {
  error: LoginError;
}

/**
 * What went wrong, and what to do about it.
 *
 * Three of the four cases are not the user's mistake — the subscription
 * lapsed, the account was never finished, the invitation is unopened — so each
 * carries the way to resolve it rather than just the refusal. Only the fourth,
 * a wrong password, is a plain line of text.
 */
export function LoginErrorAlert({ error }: LoginErrorAlertProps) {
  if (error.kind === "expiredSubscription") {
    return (
      <Alert severity="error" sx={{ mb: 3 }}>
        <AlertTitle sx={{ fontWeight: 700 }}>Suscripción expirada</AlertTitle>
        <Typography variant="body2">
          La suscripción de su negocio ha expirado. No puede acceder al sistema
          hasta que se renueve.
        </Typography>
        <Box
          sx={{ mt: 2, pt: 2, borderTop: "1px solid", borderColor: "divider" }}
        >
          <Typography variant="body2" sx={{ fontWeight: 600 }}>
            Para renovar, contacte a:
          </Typography>
          <SupportContactList topic="expiredSubscription" />
        </Box>
      </Alert>
    );
  }

  if (error.kind === "unconfiguredUser") {
    return (
      <Alert severity="warning" sx={{ mb: 3 }}>
        <AlertTitle sx={{ fontWeight: 700 }}>Usuario sin configurar</AlertTitle>
        <Typography variant="body2">{error.message}</Typography>
        <Box
          sx={{ mt: 2, pt: 2, borderTop: "1px solid", borderColor: "divider" }}
        >
          <Typography variant="body2" sx={{ fontWeight: 600 }}>
            Para completar tu configuración, contacta al administrador:
          </Typography>
          <SupportContactList topic="unconfiguredUser" showEmail />
        </Box>
      </Alert>
    );
  }

  if (error.kind === "pendingVerification") {
    return (
      <Alert severity="info" sx={{ mb: 3 }}>
        <AlertTitle sx={{ fontWeight: 700 }}>
          Cuenta pendiente de activación
        </AlertTitle>
        <Typography variant="body2">{error.message}</Typography>
        <Typography variant="body2" sx={{ mt: 1.5, color: "text.secondary" }}>
          Si no encuentras el correo, pide a un administrador que reenvíe la
          invitación.
        </Typography>
      </Alert>
    );
  }

  return (
    <Alert severity="error" sx={{ mb: 3 }}>
      {error.message}
    </Alert>
  );
}
