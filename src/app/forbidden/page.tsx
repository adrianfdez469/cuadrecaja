"use client";

import { Button } from "@mui/material";
import { ArrowBack, Home, Lock } from "@mui/icons-material";
import { useRouter } from "next/navigation";

import { StatusScreen } from "@/components/StatusScreen";
import { shape, touch } from "@/theme/tokens";

export default function ForbiddenPage() {
  const router = useRouter();

  return (
    <StatusScreen
      icon={<Lock />}
      eyebrow="ERROR 403"
      title="Acceso denegado"
      description="No tienes permisos para acceder a esta sección. Contacta al administrador si crees que esto es un error."
      hue="accent"
      actions={
        <>
          <Button
            variant="outlined"
            color="inherit"
            startIcon={<ArrowBack />}
            onClick={() => router.back()}
            sx={{
              minHeight: 48,
              px: 2.25,
              borderRadius: `${shape.radius.md}px`,
              color: "text.secondary",
              borderColor: "semantic.surface.border",
              bgcolor: "semantic.surface.raised",
            }}
          >
            Volver
          </Button>
          <Button
            variant="contained"
            startIcon={<Home />}
            onClick={() => router.push("/home")}
            sx={{
              minHeight: 48,
              px: 2.5,
              borderRadius: `${shape.radius.md}px`,
              minWidth: touch.min,
            }}
          >
            Ir al inicio
          </Button>
        </>
      }
    />
  );
}
