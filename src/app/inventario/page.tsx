"use client";

import { Suspense, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Box, CircularProgress } from "@mui/material";
import { usePermisos } from "@/utils/permisos_front";
import { useAppContext } from "@/context/AppContext";
import { GestionInventarioPage } from "@/components/GestionInventario";

function GestionInventarioGuard() {
  const { tieneAlguno } = usePermisos();
  const { loadingContext } = useAppContext();
  const router = useRouter();

  useEffect(() => {
    if (
      !loadingContext &&
      !tieneAlguno([
        "operaciones.inventario.acceder",
        "operaciones.movimientos.acceder",
      ])
    ) {
      router.push("/forbidden");
    }
  }, [loadingContext]);

  return <GestionInventarioPage />;
}

export default function GestionInventarioRoute() {
  return (
    <Suspense
      fallback={
        <Box display="flex" justifyContent="center" py={8}>
          <CircularProgress />
        </Box>
      }
    >
      <GestionInventarioGuard />
    </Suspense>
  );
}
