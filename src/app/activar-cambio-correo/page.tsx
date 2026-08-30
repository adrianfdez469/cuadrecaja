"use client";

import React, { Suspense, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import Link from "next/link";
import {
  Box,
  Button,
  Typography,
  Alert,
  CircularProgress,
  Link as MuiLink,
} from "@mui/material";
import { Email as EmailIcon } from "@mui/icons-material";
import { AuthCardLayout } from "@/components/auth/AuthCardLayout";
import { touch } from "@/theme/tokens";

function ActivarCambioCorreoForm() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const token = searchParams.get("token") ?? "";

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);

  const handleActivate = async () => {
    setError("");
    if (!token.trim()) {
      setError("Falta el token de activación en la URL.");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/auth/activar-cambio-correo", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(
          typeof data.error === "string"
            ? data.error
            : "No se pudo activar el correo.",
        );
        return;
      }
      setDone(true);
      setTimeout(() => {
        router.push("/login");
      }, 800);
    } catch {
      setError("Error de conexión. Intenta de nuevo.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthCardLayout>
      <Typography
        component="h2"
        sx={{
          fontSize: { xs: "1.375rem", md: "1.75rem" },
          fontWeight: 700,
          lineHeight: 1.25,
          letterSpacing: "-0.02em",
          mb: 1,
        }}
      >
        Activar cambio de correo
      </Typography>
      <Typography
        sx={{
          mb: 3.5,
          fontSize: "0.9375rem",
          lineHeight: 1.55,
          color: "text.secondary",
          textWrap: "pretty",
        }}
      >
        Confirma este paso para activar tu nuevo correo de acceso.
      </Typography>

      {error ? (
        <Alert severity="error" sx={{ mb: 2.5 }}>
          {error}
        </Alert>
      ) : null}
      {done ? (
        <Alert severity="success" sx={{ mb: 2.5 }}>
          Correo actualizado correctamente. Redirigiendo al inicio de sesión…
        </Alert>
      ) : null}

      <Button
        fullWidth
        variant="contained"
        disabled={loading || done}
        startIcon={
          loading ? (
            <CircularProgress size={20} color="inherit" />
          ) : (
            <EmailIcon />
          )
        }
        onClick={handleActivate}
        sx={{
          minHeight: touch.comfortable,
          fontSize: "1rem",
        }}
      >
        {loading ? "Activando…" : "Activar correo"}
      </Button>

      <Box sx={{ display: "flex", justifyContent: "center", mt: 2.5 }}>
        <MuiLink
          component={Link}
          href="/login"
          sx={{
            display: "flex",
            alignItems: "center",
            minHeight: touch.min,
            fontSize: "0.875rem",
            fontWeight: 600,
            color: "#5B4CA8",
            textDecoration: "none",
            "&:hover": { textDecoration: "underline" },
          }}
        >
          Ir a iniciar sesión
        </MuiLink>
      </Box>
    </AuthCardLayout>
  );
}

export default function ActivarCambioCorreoPage() {
  return (
    <Suspense
      fallback={
        <Box
          sx={{
            display: "flex",
            justifyContent: "center",
            alignItems: "center",
            minHeight: "100dvh",
          }}
        >
          <CircularProgress />
        </Box>
      }
    >
      <ActivarCambioCorreoForm />
    </Suspense>
  );
}
