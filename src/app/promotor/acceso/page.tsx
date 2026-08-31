"use client";

import { FormEvent, useState } from "react";
import NextLink from "next/link";
import {
  Alert,
  Box,
  Button,
  Link,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import { AuthCardLayout } from "@/components/auth/AuthCardLayout";

export default function PromotorAccesoPage() {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<"idle" | "success" | "error">("idle");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  const onSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setLoading(true);
    setStatus("idle");
    setMessage("");

    try {
      const response = await fetch("/api/promoters/magic-link/request", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const data = await response.json();

      if (!response.ok) {
        setStatus("error");
        setMessage(data.error ?? "No se pudo enviar el enlace de acceso.");
        return;
      }

      setStatus("success");
      setMessage(
        data.message ??
          "Si existe una cuenta activa, enviamos un enlace de acceso.",
      );
    } catch {
      setStatus("error");
      setMessage("Error de conexión. Inténtalo nuevamente.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthCardLayout>
      <Stack spacing={3}>
        <Box>
          <Typography variant="h6" sx={{ fontWeight: 700, mb: 1 }}>
            Acceso de Promotor
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Ingresa tu correo y te enviaremos un enlace mágico para entrar.
          </Typography>
        </Box>

        <Box component="form" onSubmit={onSubmit}>
          <Stack spacing={2}>
            <TextField
              type="email"
              label="Correo electrónico"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              required
              fullWidth
              size="small"
              inputProps={{ maxLength: 255 }}
            />
            <Button
              type="submit"
              variant="contained"
              disabled={loading}
              fullWidth
              sx={{ minHeight: 56, fontWeight: 700 }}
            >
              {loading ? "Enviando…" : "Enviar enlace de acceso"}
            </Button>
          </Stack>
        </Box>

        {status !== "idle" && (
          <Alert severity={status} variant="filled">
            {message}
          </Alert>
        )}

        <Typography
          variant="body2"
          color="text.secondary"
          sx={{ textAlign: "center" }}
        >
          ¿Aún no tienes cuenta de promotor?{" "}
          <Link
            component={NextLink}
            href="/promotor/registro"
            sx={{
              display: "inline-flex",
              alignItems: "center",
              minHeight: "44px",
              fontWeight: 700,
            }}
          >
            Regístrate aquí
          </Link>
        </Typography>
      </Stack>
    </AuthCardLayout>
  );
}
