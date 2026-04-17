"use client";

import React, { useState } from "react";
import Link from "next/link";
import {
  Box,
  Button,
  TextField,
  Typography,
  Container,
  Paper,
  CardContent,
  Alert,
  CircularProgress,
  InputAdornment,
} from "@mui/material";
import { Email } from "@mui/icons-material";

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default function OlvideContrasenaPage() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
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
      setMessage(
        typeof data.message === "string"
          ? data.message
          : "Si el correo está registrado en un negocio activo, recibirás instrucciones para restablecer tu contraseña."
      );
    } catch {
      setError("Error de conexión. Intenta de nuevo.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Container maxWidth="sm" sx={{ py: 6 }}>
      <Paper elevation={3} sx={{ borderRadius: 2, overflow: "hidden" }}>
        <CardContent sx={{ p: 4 }}>
          <Typography variant="h5" fontWeight={700} gutterBottom>
            Recuperar contraseña
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
            Indica el correo con el que inicias sesión. Si existe una cuenta activa, te enviaremos
            un enlace para definir una contraseña nueva.
          </Typography>

          {error ? (
            <Alert severity="error" sx={{ mb: 2 }}>
              {error}
            </Alert>
          ) : null}
          {message ? (
            <Alert severity="info" sx={{ mb: 2 }}>
              {message}
            </Alert>
          ) : null}

          <Box component="form" onSubmit={handleSubmit}>
            <TextField
              fullWidth
              type="email"
              label="Correo electrónico"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              sx={{ mb: 3 }}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <Email color="action" />
                  </InputAdornment>
                ),
              }}
            />
            <Button
              type="submit"
              fullWidth
              variant="contained"
              size="large"
              disabled={loading}
              startIcon={loading ? <CircularProgress size={20} /> : undefined}
            >
              {loading ? "Enviando…" : "Enviar instrucciones"}
            </Button>
            <Button fullWidth component={Link} href="/login" sx={{ mt: 2 }} color="inherit">
              Volver al inicio de sesión
            </Button>
          </Box>
        </CardContent>
      </Paper>
    </Container>
  );
}
