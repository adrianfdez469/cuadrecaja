"use client";

import React, { Suspense, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import Link from "next/link";
import {
  Box,
  Button,
  TextField,
  Typography,
  Alert,
  CircularProgress,
  InputAdornment,
  IconButton,
  Link as MuiLink,
} from "@mui/material";
import {
  Visibility,
  VisibilityOff,
  Lock,
  Login as LoginIcon,
} from "@mui/icons-material";
import { AuthCardLayout } from "@/components/auth/AuthCardLayout";
import { LOGIN_CREDENTIALS_SESSION_KEY } from "@/constants/userAccount";
import { touch } from "@/theme/tokens";

function ActivarUsuarioForm() {
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
      setError("Falta el token de activación en la URL.");
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
      const res = await fetch("/api/auth/activar-usuario-invite", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, password, passwordConfirm }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(
          typeof data.error === "string"
            ? data.error
            : "No se pudo activar la cuenta.",
        );
        return;
      }
      const email = typeof data.usuario === "string" ? data.usuario : "";
      try {
        sessionStorage.setItem(
          LOGIN_CREDENTIALS_SESSION_KEY,
          JSON.stringify({ usuario: email, password }),
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
        Activar tu cuenta
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
        Tu usuario quedará activo al definir una contraseña segura (mayúsculas,
        minúsculas y números; mínimo 8 caracteres).
      </Typography>

      {error ? (
        <Alert severity="error" sx={{ mb: 2.5 }}>
          {error}
        </Alert>
      ) : null}
      {done ? (
        <Alert severity="success" sx={{ mb: 2.5 }}>
          Cuenta activada. Redirigiendo al inicio de sesión…
        </Alert>
      ) : null}

      <Box component="form" onSubmit={handleSubmit}>
        <TextField
          fullWidth
          type={showPassword ? "text" : "password"}
          label="Contraseña"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          sx={{ mb: 2.5 }}
          slotProps={{
            input: {
              startAdornment: (
                <InputAdornment position="start">
                  <Lock sx={{ color: "text.disabled" }} />
                </InputAdornment>
              ),
              endAdornment: (
                <InputAdornment position="end">
                  <IconButton
                    onClick={() => setShowPassword(!showPassword)}
                    edge="end"
                    aria-label="Mostrar u ocultar contraseña"
                  >
                    {showPassword ? <VisibilityOff /> : <Visibility />}
                  </IconButton>
                </InputAdornment>
              ),
            },
          }}
        />
        <TextField
          fullWidth
          type={showPassword ? "text" : "password"}
          label="Confirmar contraseña"
          value={passwordConfirm}
          onChange={(e) => setPasswordConfirm(e.target.value)}
          sx={{ mb: 3.5 }}
          slotProps={{
            input: {
              startAdornment: (
                <InputAdornment position="start">
                  <Lock sx={{ color: "text.disabled" }} />
                </InputAdornment>
              ),
              endAdornment: (
                <InputAdornment position="end">
                  <IconButton
                    onClick={() => setShowPassword(!showPassword)}
                    edge="end"
                    aria-label="Mostrar u ocultar confirmación de contraseña"
                  >
                    {showPassword ? <VisibilityOff /> : <Visibility />}
                  </IconButton>
                </InputAdornment>
              ),
            },
          }}
        />
        <Button
          type="submit"
          fullWidth
          variant="contained"
          disabled={loading}
          startIcon={
            loading ? (
              <CircularProgress size={20} color="inherit" />
            ) : (
              <LoginIcon />
            )
          }
          sx={{
            minHeight: touch.comfortable,
            fontSize: "1rem",
          }}
        >
          {loading ? "Guardando…" : "Activar y continuar"}
        </Button>
      </Box>

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
            color: "primary.main",
            textDecoration: "none",
            "&:hover": { textDecoration: "underline" },
          }}
        >
          Volver al inicio de sesión
        </MuiLink>
      </Box>
    </AuthCardLayout>
  );
}

export default function ActivarUsuarioPage() {
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
      <ActivarUsuarioForm />
    </Suspense>
  );
}
