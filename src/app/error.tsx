"use client";

import { useEffect } from "react";
import { Box, Button, Container, Typography, Alert } from "@mui/material";
import { ErrorOutline, Refresh, Home } from "@mui/icons-material";
import { useRouter } from "next/navigation";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const router = useRouter();

  useEffect(() => {
    console.error("[Error boundary]", error);
  }, [error]);

  return (
    <Container maxWidth="sm">
      <Box
        sx={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          minHeight: "70vh",
          textAlign: "center",
          gap: 3,
        }}
      >
        <Box sx={{ position: "relative", display: "flex", alignItems: "center", justifyContent: "center" }}>
          <Typography
            sx={{
              fontSize: { xs: "6rem", sm: "9rem" },
              fontWeight: 700,
              color: "error.main",
              lineHeight: 1,
              opacity: 0.12,
              userSelect: "none",
            }}
          >
            500
          </Typography>
          <ErrorOutline
            sx={{
              fontSize: 56,
              color: "error.main",
              position: "absolute",
            }}
          />
        </Box>

        <Box>
          <Typography variant="h4" gutterBottom>
            Algo salió mal
          </Typography>
          <Typography variant="body1" color="text.secondary">
            Ocurrió un error inesperado. Intenta de nuevo.
          </Typography>
        </Box>

        {error.digest && (
          <Alert severity="info" sx={{ width: "100%", textAlign: "left" }}>
            Código de error: <strong>{error.digest}</strong>
          </Alert>
        )}

        <Box sx={{ display: "flex", gap: 2, flexWrap: "wrap", justifyContent: "center" }}>
          <Button
            variant="outlined"
            startIcon={<Home />}
            onClick={() => router.push("/home")}
          >
            Ir al inicio
          </Button>
          <Button
            variant="contained"
            color="error"
            startIcon={<Refresh />}
            onClick={reset}
          >
            Intentar de nuevo
          </Button>
        </Box>
      </Box>
    </Container>
  );
}
