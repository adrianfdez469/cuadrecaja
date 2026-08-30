"use client";

import { FormEvent, useState } from "react";
import Link from "next/link";
import {
  Alert,
  Box,
  Button,
  Card,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import { AuthWordmark } from "@/components/auth/AuthWordmark";

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
    <Box
      sx={{
        minHeight: "100vh",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        py: { xs: 2, sm: 4 },
        px: 2,
        bgcolor: "background.default",
      }}
    >
      <Box sx={{ mb: 3 }}>
        <AuthWordmark />
      </Box>

      <Card
        sx={{
          width: "100%",
          maxWidth: 600,
          p: { xs: 2.5, sm: 3.5 },
          bgcolor: "background.paper",
          boxShadow: "xs",
        }}
      >
        <Stack spacing={3}>
          <Box>
            <Typography variant="h6" sx={{ fontWeight: 700, mb: 1 }}>
              Acceso de promotor
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Ingresa tu correo electrónico y te enviaremos un enlace mágico
              para entrar.
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
                sx={{ py: 1.25, fontWeight: 600 }}
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

          <Box sx={{ pt: 1, borderTop: "1px solid", borderColor: "divider" }}>
            <Typography variant="body2" color="text.secondary">
              ¿Aún no tienes cuenta de promotor?{" "}
              <Button
                component={Link}
                href="/promotor/registro"
                variant="text"
                size="small"
                sx={{
                  fontWeight: 700,
                  textTransform: "none",
                  p: 0,
                  minHeight: "44px",
                  display: "inline-flex",
                  alignItems: "center",
                }}
              >
                Regístrate aquí
              </Button>
            </Typography>
          </Box>
        </Stack>
      </Card>
    </Box>
  );
}
