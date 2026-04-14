"use client";

import { Box, Button, Container, Typography } from "@mui/material";
import { SearchOff, Home } from "@mui/icons-material";
import { useRouter } from "next/navigation";

export default function NotFound() {
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
              color: "primary.main",
              lineHeight: 1,
              opacity: 0.12,
              userSelect: "none",
            }}
          >
            404
          </Typography>
          <SearchOff
            sx={{
              fontSize: 56,
              color: "primary.main",
              position: "absolute",
            }}
          />
        </Box>

        <Box>
          <Typography variant="h4" gutterBottom>
            Página no encontrada
          </Typography>
          <Typography variant="body1" color="text.secondary">
            La página que buscas no existe o fue movida.
          </Typography>
        </Box>

        <Button
          variant="contained"
          startIcon={<Home />}
          onClick={() => router.push("/home")}
          size="large"
        >
          Ir al inicio
        </Button>
      </Box>
    </Container>
  );
}
