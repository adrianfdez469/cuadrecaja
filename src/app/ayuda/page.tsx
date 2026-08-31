"use client";

import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import { Box, Button } from "@mui/material";
import { useAppContext } from "@/context/AppContext";
import { PageContainer } from "@/components/PageContainer";
import { PrimerosPasosSettings } from "@/features/onboarding/components/PrimerosPasosSettings";

export default function AyudaPage() {
  const { gotToPath } = useAppContext();

  return (
    <PageContainer
      title="Ayuda"
      subtitle="Configura las guías interactivas y consulta recursos de apoyo."
      breadcrumbs={[{ label: "Inicio", href: "/home" }, { label: "Ayuda" }]}
      maxWidth="md"
      headerActions={
        <Button
          variant="outlined"
          startIcon={<ArrowBackIcon />}
          onClick={() => gotToPath("/home")}
          sx={{ flexShrink: 0 }}
        >
          Cerrar
        </Button>
      }
    >
      <Box display="flex" flexDirection="column" gap={3}>
        <PrimerosPasosSettings />
      </Box>
    </PageContainer>
  );
}
