"use client";

import { Suspense, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import { Box, CircularProgress, Typography } from "@mui/material";
import { AuthCardLayout } from "@/components/auth/AuthCardLayout";

function PromotorAuthRedirect() {
  const searchParams = useSearchParams();

  useEffect(() => {
    const token = searchParams.get("token");
    if (!token) {
      window.location.replace("/promotor/acceso");
      return;
    }

    window.location.replace(
      `/api/promoters/magic-link/consume?token=${encodeURIComponent(token)}`,
    );
  }, [searchParams]);

  return (
    <AuthCardLayout>
      <Box sx={{ textAlign: "center", py: 3 }}>
        <CircularProgress />
        <Typography color="text.secondary" sx={{ mt: 2 }}>
          Validando enlace de acceso…
        </Typography>
      </Box>
    </AuthCardLayout>
  );
}

function PromotorAuthFallback() {
  return (
    <AuthCardLayout>
      <Box sx={{ textAlign: "center", py: 3 }}>
        <CircularProgress />
        <Typography color="text.secondary" sx={{ mt: 2 }}>
          Cargando…
        </Typography>
      </Box>
    </AuthCardLayout>
  );
}

export default function PromotorAuthPage() {
  return (
    <Suspense fallback={<PromotorAuthFallback />}>
      <PromotorAuthRedirect />
    </Suspense>
  );
}
