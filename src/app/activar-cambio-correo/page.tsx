"use client";

import React, { Suspense, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import Link from "next/link";
import {
  Box,
  Button,
  Typography,
  Container,
  Paper,
  CardContent,
  Alert,
  CircularProgress,
} from "@mui/material";
import { Email as EmailIcon, Login as LoginIcon } from "@mui/icons-material";

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
        setError(typeof data.error === "string" ? data.error : "No se pudo activar el correo.");
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
    <Container maxWidth="sm" sx={{ py: 6 }}>
      <Paper elevation={3} sx={{ borderRadius: 2, overflow: "hidden" }}>
        <CardContent sx={{ p: 4 }}>
          <Typography variant="h5" fontWeight={700} gutterBottom>
            Activar cambio de correo
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
            Confirma este paso para activar tu nuevo correo de acceso.
          </Typography>

          {error ? (
            <Alert severity="error" sx={{ mb: 2 }}>
              {error}
            </Alert>
          ) : null}
          {done ? (
            <Alert severity="success" sx={{ mb: 2 }}>
              Correo actualizado correctamente. Redirigiendo al inicio de sesión...
            </Alert>
          ) : null}

          <Button
            fullWidth
            variant="contained"
            size="large"
            disabled={loading || done}
            startIcon={loading ? <CircularProgress size={20} /> : <EmailIcon />}
            onClick={handleActivate}
          >
            {loading ? "Activando..." : "Activar correo"}
          </Button>
          <Button fullWidth component={Link} href="/login" sx={{ mt: 2 }} color="inherit">
            Volver al inicio de sesión
          </Button>
          {!done ? (
            <Box sx={{ mt: 2, textAlign: "center" }}>
              <Button
                startIcon={<LoginIcon />}
                onClick={() => router.push("/login")}
                color="primary"
                size="small"
              >
                Ir a iniciar sesión
              </Button>
            </Box>
          ) : null}
        </CardContent>
      </Paper>
    </Container>
  );
}

export default function ActivarCambioCorreoPage() {
  return (
    <Suspense
      fallback={
        <Box display="flex" justifyContent="center" py={8}>
          <CircularProgress />
        </Box>
      }
    >
      <ActivarCambioCorreoForm />
    </Suspense>
  );
}
