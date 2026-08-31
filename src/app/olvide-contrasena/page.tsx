"use client";

import { useState } from "react";
import type { FormEvent } from "react";
import NextLink from "next/link";
import {
  Alert,
  Box,
  Button,
  CircularProgress,
  InputAdornment,
  Link,
  TextField,
  Typography,
} from "@mui/material";
import { Email } from "@mui/icons-material";

import { AuthSplitLayout } from "@/components/auth/AuthSplitLayout";
import { shape, touch } from "@/theme/tokens";

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * The same split screen as the login, because it is the same errand.
 *
 * It used to be a raised card on the page ground with no brand at all, so
 * following «¿Olvidaste tu contraseña?» dropped you somewhere that looked like
 * a different product.
 */
export default function OlvideContrasenaPage() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState("");

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setMessage(null);
    setError("");

    const normalized = email.trim().toLowerCase();
    if (!normalized || !EMAIL_REGEX.test(normalized)) {
      setError("Ingresa un correo electrónico válido.");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/auth/solicitar-reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ usuario: normalized }),
      });
      const data = await res.json().catch(() => ({}));
      // Deliberately the same answer whether or not the address exists: saying
      // «no such account» would turn this form into a way to enumerate users.
      setMessage(
        typeof data.message === "string"
          ? data.message
          : "Si el correo está registrado en un negocio activo, recibirás instrucciones para restablecer tu contraseña.",
      );
    } catch {
      setError("Error de conexión. Intenta de nuevo.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthSplitLayout>
      <Typography
        component="h2"
        sx={{
          fontSize: { xs: "1.375rem", md: "1.75rem" },
          fontWeight: 700,
          lineHeight: 1.25,
          letterSpacing: "-0.02em",
        }}
      >
        Recuperar contraseña
      </Typography>
      <Typography
        sx={{
          mt: 1,
          fontSize: "0.9375rem",
          lineHeight: 1.55,
          color: "text.secondary",
          textWrap: "pretty",
        }}
      >
        Indica el correo con el que inicias sesión. Si existe una cuenta activa,
        te enviaremos un enlace para definir una contraseña nueva.
      </Typography>

      <Box
        component="form"
        onSubmit={handleSubmit}
        sx={{ mt: { xs: 3.5, md: 4 } }}
      >
        <TextField
          fullWidth
          type="email"
          label="Correo electrónico"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          autoComplete="email"
          disabled={loading}
          slotProps={{
            input: {
              startAdornment: (
                <InputAdornment position="start">
                  <Email sx={{ color: "text.disabled" }} />
                </InputAdornment>
              ),
            },
          }}
        />

        {error && (
          <Alert severity="error" sx={{ mt: 2.5 }}>
            {error}
          </Alert>
        )}
        {message && (
          <Alert severity="info" sx={{ mt: 2.5 }}>
            {message}
          </Alert>
        )}

        <Button
          type="submit"
          fullWidth
          variant="contained"
          disabled={loading}
          startIcon={
            loading ? <CircularProgress size={20} color="inherit" /> : undefined
          }
          sx={{
            minHeight: touch.comfortable,
            mt: 2.5,
            borderRadius: `${shape.radius.md}px`,
            fontSize: "1rem",
          }}
        >
          {loading ? "Enviando…" : "Enviar instrucciones"}
        </Button>
      </Box>

      <Box sx={{ display: "flex", justifyContent: "center", mt: 1.5 }}>
        <Link
          component={NextLink}
          href="/login"
          sx={{
            display: "flex",
            alignItems: "center",
            minHeight: touch.min,
            fontSize: "0.875rem",
            fontWeight: 600,
            color: "text.secondary",
            textDecoration: "none",
            "&:hover": { textDecoration: "underline" },
          }}
        >
          Volver al inicio de sesión
        </Link>
      </Box>
    </AuthSplitLayout>
  );
}
