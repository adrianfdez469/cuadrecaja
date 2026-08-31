"use client";

import { FormEvent, useState } from "react";
import Link from "next/link";
import {
  Alert,
  Box,
  Button,
  Card,
  Container,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import Grid from "@mui/material/Grid2";
import { HomeOutlined, Login } from "@mui/icons-material";
import InformacionProgramaPromotor from "@/app/promotor/registro/InformacionProgramaPromotor";

export default function PromotorRegistroPage() {
  const [fullName, setFullName] = useState("");
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
      const response = await fetch("/api/promoters/apply", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fullName: fullName.trim(),
          email: email.trim().toLowerCase(),
        }),
      });
      const data = await response.json();

      if (!response.ok) {
        setStatus("error");
        setMessage(data.error ?? "No se pudo enviar la solicitud.");
        return;
      }

      setStatus("success");
      setMessage(
        data.message ??
          "Si el correo es válido, te enviamos un enlace de activación.",
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
        py: { xs: 2, sm: 4 },
        px: 2,
        bgcolor: "background.default",
      }}
    >
      <Container maxWidth="lg">
        <Box
          sx={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            gap: 2,
            mb: 4,
            flexWrap: "wrap",
          }}
        >
          <Button
            component={Link}
            href="/"
            startIcon={<HomeOutlined />}
            sx={{ textTransform: "none" }}
          >
            Volver al inicio
          </Button>
          <Button
            component={Link}
            href="/promotor/acceso"
            variant="outlined"
            startIcon={<Login />}
            sx={{ textTransform: "none" }}
          >
            Ya soy promotor — acceder
          </Button>
        </Box>

        <Box sx={{ mb: 4 }}>
          <Typography variant="h2" component="h1" sx={{ mb: 1 }}>
            Programa de{" "}
            <Box component="span" sx={{ color: "primary.main" }}>
              promotores
            </Box>
          </Typography>
          <Typography
            variant="body1"
            sx={{ color: "text.secondary", maxWidth: 720 }}
          >
            Gana recomendando Cuadre de Caja a otros negocios. Regístrate, obtén
            tu código y sigue el estado de tus referidos desde tu panel. Abajo
            tienes el formulario y toda la información que necesitas antes de
            empezar.
          </Typography>
        </Box>

        <Grid container spacing={4}>
          <Grid size={{ xs: 12, md: 5 }}>
            <Card
              sx={{
                p: { xs: 2.5, sm: 3 },
                position: { md: "sticky" },
                top: { md: 24 },
                bgcolor: "background.paper",
                boxShadow: "sm",
              }}
            >
              <Stack spacing={2.5}>
                <Box>
                  <Typography variant="h6" sx={{ fontWeight: 700, mb: 0.5 }}>
                    Solicitud de alta
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    Te enviaremos un enlace al correo
                  </Typography>
                </Box>

                <Box component="form" onSubmit={onSubmit}>
                  <Stack spacing={2}>
                    <TextField
                      label="Nombre y apellidos"
                      value={fullName}
                      onChange={(e) => setFullName(e.target.value)}
                      required
                      fullWidth
                      size="small"
                      inputProps={{ minLength: 2, maxLength: 255 }}
                    />
                    <TextField
                      type="email"
                      label="Correo electrónico"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
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
                      {loading ? "Enviando…" : "Solicitar enlace de activación"}
                    </Button>
                  </Stack>
                </Box>

                {status !== "idle" && (
                  <Alert severity={status} variant="filled">
                    {message}
                    {status === "success" && (
                      <Box sx={{ mt: 1 }}>
                        <Typography variant="body2" color="inherit">
                          Revisa la bandeja de entrada y spam. Cuando actives tu
                          cuenta, podrás entrar desde{" "}
                          <Button
                            component={Link}
                            href="/promotor/acceso"
                            variant="text"
                            size="small"
                            sx={{
                              color: "inherit",
                              fontWeight: 600,
                              textDecoration: "underline",
                              p: 0,
                              minHeight: "auto",
                            }}
                          >
                            /promotor/acceso
                          </Button>{" "}
                          con tu correo.
                        </Typography>
                      </Box>
                    )}
                  </Alert>
                )}
              </Stack>
            </Card>
          </Grid>

          <Grid size={{ xs: 12, md: 7 }}>
            <Card
              sx={{
                p: { xs: 2.5, sm: 3 },
                bgcolor: "background.paper",
                boxShadow: "sm",
              }}
            >
              <InformacionProgramaPromotor />
            </Card>
          </Grid>
        </Grid>
      </Container>
    </Box>
  );
}
