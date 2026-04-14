"use client";

import { Box, Button, Container, Typography } from "@mui/material";
import { Lock, Home, ArrowBack } from "@mui/icons-material";
import { useRouter } from "next/navigation";

export default function ForbiddenPage() {
  const router = useRouter();

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
              color: "warning.main",
              lineHeight: 1,
              opacity: 0.12,
              userSelect: "none",
            }}
          >
            403
          </Typography>
          <Lock
            sx={{
              fontSize: 56,
              color: "warning.main",
              position: "absolute",
            }}
          />
        </Box>

        <Box>
          <Typography variant="h4" gutterBottom>
            Acceso denegado
          </Typography>
          <Typography variant="body1" color="text.secondary">
            No tienes permisos para acceder a esta sección.
            Contacta al administrador si crees que esto es un error.
          </Typography>
        </Box>

        <Box sx={{ display: "flex", gap: 2, flexWrap: "wrap", justifyContent: "center" }}>
          <Button
            variant="outlined"
            startIcon={<ArrowBack />}
            onClick={() => router.back()}
          >
            Volver
          </Button>
          <Button
            variant="contained"
            startIcon={<Home />}
            onClick={() => router.push("/home")}
          >
            Ir al inicio
          </Button>
        </Box>
      </Box>
    </Container>
  );
}
