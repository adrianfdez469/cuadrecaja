"use client";

import { useEffect } from "react";
import { Box, Button, Container, Typography } from "@mui/material";
import { ErrorOutline, Refresh, Home } from "@mui/icons-material";
import { useRouter } from "next/navigation";

import { shape, touch } from "@/theme/tokens";

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
        <Box
          sx={{
            position: "relative",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <Typography
            sx={{
              fontSize: { xs: "6rem", sm: "9rem" },
              fontWeight: 700,
              color: "semantic.hue.negative.main",
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
              color: "semantic.hue.negative.main",
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
          <Box
            sx={{
              px: 2,
              py: 1.5,
              bgcolor: "semantic.hue.neutral.surface",
              borderRadius: `${shape.radius.md}px`,
              fontSize: "0.8125rem",
              fontFamily: "monospace",
              color: "semantic.hue.neutral.main",
              fontVariantNumeric: "tabular-nums",
            }}
          >
            Código de error:{" "}
            <Box component="strong" sx={{ fontWeight: 700 }}>
              {error.digest}
            </Box>
          </Box>
        )}

        <Box
          sx={{
            display: "flex",
            gap: 2,
            flexWrap: "wrap",
            justifyContent: "center",
          }}
        >
          <Button
            variant="outlined"
            color="inherit"
            startIcon={<Home />}
            onClick={() => router.push("/home")}
            sx={{
              minHeight: touch.comfortable,
              px: 2,
              borderRadius: `${shape.radius.md}px`,
            }}
          >
            Ir al inicio
          </Button>
          <Button
            variant="contained"
            startIcon={<Refresh />}
            onClick={reset}
            sx={{
              minHeight: touch.comfortable,
              px: 2,
              borderRadius: `${shape.radius.md}px`,
            }}
          >
            Intentar de nuevo
          </Button>
        </Box>
      </Box>
    </Container>
  );
}
