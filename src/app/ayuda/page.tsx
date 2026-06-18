"use client";

import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import { Box, Button, Container, Typography } from "@mui/material";
import { useAppContext } from "@/context/AppContext";
import { PrimerosPasosSettings } from "@/features/onboarding/components/PrimerosPasosSettings";

export default function AyudaPage() {
  const { gotToPath } = useAppContext();

  return (
    <Container maxWidth="md" sx={{ py: { xs: 2, sm: 4 } }}>
      <Box
        display="flex"
        alignItems="flex-start"
        justifyContent="space-between"
        gap={2}
        mb={1}
      >
        <Typography variant="h4" fontWeight={700}>
          Ayuda
        </Typography>
        <Button
          variant="outlined"
          startIcon={<ArrowBackIcon />}
          onClick={() => gotToPath("/home")}
          sx={{ flexShrink: 0 }}
        >
          Cerrar
        </Button>
      </Box>
      <Typography variant="body1" color="text.secondary" sx={{ mb: 3 }}>
        Configura las guías interactivas y consulta recursos de apoyo.
      </Typography>

      <Box display="flex" flexDirection="column" gap={3}>
        <PrimerosPasosSettings />
      </Box>
    </Container>
  );
}
