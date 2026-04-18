"use client";

import React, { Suspense, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
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
  IconButton,
} from "@mui/material";
import { Visibility, VisibilityOff, Lock, Login as LoginIcon } from "@mui/icons-material";
import { LOGIN_CREDENTIALS_SESSION_KEY } from "@/constants/userAccount";

function RestablecerForm() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const token = searchParams.get("token") ?? "";

  const [password, setPassword] = useState("");
  const [passwordConfirm, setPasswordConfirm] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (!token.trim()) {
      setError("Falta el token en la URL.");
      return;
    }
    if (!password || !passwordConfirm) {
      setError("Completa ambos campos de contraseña.");
      return;
    }
    if (password !== passwordConfirm) {
      setError("Las contraseñas no coinciden.");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/auth/restablecer-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, password, passwordConfirm }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(typeof data.error === "string" ? data.error : "No se pudo restablecer la contraseña.");
        return;
      }
      const email = typeof data.usuario === "string" ? data.usuario : "";
      try {
        sessionStorage.setItem(
          LOGIN_CREDENTIALS_SESSION_KEY,
          JSON.stringify({ usuario: email, password })
        );
      } catch {
        // ignore
      }
      setDone(true);
      router.push("/login");
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
            Nueva contraseña
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
            Define una contraseña nueva (mayúsculas, minúsculas y números; mínimo 8 caracteres).
          </Typography>

          {error ? (
            <Alert severity="error" sx={{ mb: 2 }}>
              {error}
            </Alert>
          ) : null}
          {done ? (
            <Alert severity="success" sx={{ mb: 2 }}>
              Contraseña actualizada. Redirigiendo al inicio de sesión…
            </Alert>
          ) : null}

          <Box component="form" onSubmit={handleSubmit}>
            <TextField
              fullWidth
              type={showPassword ? "text" : "password"}
              label="Nueva contraseña"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              sx={{ mb: 2 }}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <Lock color="action" />
                  </InputAdornment>
                ),
                endAdornment: (
                  <InputAdornment position="end">
                    <IconButton onClick={() => setShowPassword(!showPassword)} edge="end" aria-label="Mostrar u ocultar contraseña">
                      {showPassword ? <VisibilityOff /> : <Visibility />}
                    </IconButton>
                  </InputAdornment>
                ),
              }}
            />
            <TextField
              fullWidth
              type={showPassword ? "text" : "password"}
              label="Confirmar contraseña"
              value={passwordConfirm}
              onChange={(e) => setPasswordConfirm(e.target.value)}
              sx={{ mb: 3 }}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <Lock color="action" />
                  </InputAdornment>
                ),
                endAdornment: (
                  <InputAdornment position="end">
                    <IconButton onClick={() => setShowPassword(!showPassword)} edge="end" aria-label="Mostrar u ocultar confirmación de contraseña">
                      {showPassword ? <VisibilityOff /> : <Visibility />}
                    </IconButton>
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
              startIcon={loading ? <CircularProgress size={20} /> : <LoginIcon />}
            >
              {loading ? "Guardando…" : "Guardar contraseña"}
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

export default function RestablecerContrasenaPage() {
  return (
    <Suspense
      fallback={
        <Box display="flex" justifyContent="center" py={8}>
          <CircularProgress />
        </Box>
      }
    >
      <RestablecerForm />
    </Suspense>
  );
}
