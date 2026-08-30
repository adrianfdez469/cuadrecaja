"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import {
  Alert,
  Box,
  Button,
  CircularProgress,
  Typography,
} from "@mui/material";
import LoginIcon from "@mui/icons-material/Login";
import { AuthCardLayout } from "@/components/auth/AuthCardLayout";
import { touch } from "@/theme/tokens";

const BRAND = "#5B4CA8";

type ActivationViewState = "loading" | "success" | "error";

function ActivarPromotorContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [state, setState] = useState<ActivationViewState>("loading");
  const [message, setMessage] = useState(
    "Estamos validando tu enlace de activación…",
  );
  const [promoCode, setPromoCode] = useState<string | null>(null);

  useEffect(() => {
    const token = searchParams.get("token");

    if (!token) {
      setMessage("No encontramos un token de activación válido.");
      setState("error");
      return;
    }

    const activate = async () => {
      try {
        const response = await fetch("/api/promoters/activate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ token }),
        });

        const data = await response.json();

        if (response.ok) {
          setPromoCode(
            typeof data.promoter?.promoCode === "string"
              ? data.promoter.promoCode
              : null,
          );
          setState("success");
          return;
        }

        setMessage(data.error ?? "No se pudo activar tu cuenta de promotor.");
        setState("error");
      } catch {
        setMessage("Ocurrió un error de conexión. Intenta nuevamente.");
        setState("error");
      }
    };

    void activate();
  }, [searchParams]);

  if (state === "loading") {
    return (
      <Box sx={{ textAlign: "center", py: 3 }}>
        <CircularProgress sx={{ color: BRAND, mb: 2 }} size={40} />
        <Typography sx={{ color: "text.secondary" }}>{message}</Typography>
      </Box>
    );
  }

  if (state === "success" && promoCode) {
    return (
      <Box>
        <Alert severity="success" sx={{ mb: 2.5 }}>
          <Typography variant="subtitle2" fontWeight={700} sx={{ mb: 0.5 }}>
            ¡Cuenta activada correctamente!
          </Typography>
          Este es tu código para compartir con negocios que quieran registrarse
          con tu referido.
        </Alert>

        <Box
          sx={{
            py: 2.5,
            px: 2,
            mb: 2.5,
            borderRadius: "8px",
            bgcolor: "#F4F2FB",
            border: `1px solid #E8E6F0`,
            textAlign: "center",
          }}
        >
          <Typography
            variant="caption"
            sx={{ display: "block", mb: 1, color: "text.secondary" }}
          >
            Tu código de promoción
          </Typography>
          <Typography
            component="span"
            sx={{
              fontFamily: "monospace",
              fontSize: "1.5rem",
              fontWeight: 800,
              color: BRAND,
              letterSpacing: 2,
            }}
          >
            {promoCode}
          </Typography>
        </Box>

        <Alert severity="info" icon={false} sx={{ mb: 2.5 }}>
          <Typography variant="body2" sx={{ lineHeight: 1.6 }}>
            <strong>No hace falta que lo guardes ahora.</strong> Siempre podrás
            verlo y copiarlo desde tu <strong>panel de promotor</strong> cuando
            entres con tu correo y el enlace mágico de acceso.
          </Typography>
        </Alert>

        <Typography variant="body2" sx={{ color: "text.secondary", mb: 3 }}>
          También encontrarás ahí el enlace para invitar desde la landing y el
          estado de tus referidos.
        </Typography>

        <StackButtons onHome={() => router.push("/")} />
      </Box>
    );
  }

  if (state === "success" && !promoCode) {
    return (
      <Box sx={{ textAlign: "center" }}>
        <Alert severity="success" sx={{ mb: 2.5 }}>
          Cuenta activada. Ya puedes iniciar sesión con el enlace mágico desde
          el acceso de promotor.
        </Alert>
        <StackButtons onHome={() => router.push("/")} />
      </Box>
    );
  }

  return (
    <Box sx={{ textAlign: "center" }}>
      <Alert severity="error" sx={{ mb: 2.5 }}>
        {message}
      </Alert>
      <Button variant="contained" onClick={() => router.push("/")}>
        Volver al inicio
      </Button>
    </Box>
  );
}

function StackButtons({ onHome }: { onHome: () => void }) {
  return (
    <Box
      sx={{
        display: "flex",
        flexDirection: { xs: "column", sm: "row" },
        gap: 1.5,
        justifyContent: "center",
      }}
    >
      <Button
        component={Link}
        href="/promotor/acceso"
        variant="contained"
        startIcon={<LoginIcon />}
        sx={{
          minHeight: touch.comfortable,
          fontSize: "1rem",
        }}
      >
        Ir al acceso de mi panel
      </Button>
      <Button
        variant="outlined"
        onClick={onHome}
        sx={{
          minHeight: touch.comfortable,
          fontSize: "1rem",
        }}
      >
        Volver al inicio
      </Button>
    </Box>
  );
}

export default function ActivarPromotorPage() {
  return (
    <Suspense
      fallback={
        <Box
          sx={{
            display: "flex",
            justifyContent: "center",
            alignItems: "center",
            minHeight: "100dvh",
            bgcolor: "#F7F7FA",
          }}
        >
          <CircularProgress />
        </Box>
      }
    >
      <AuthCardLayout>
        <ActivarPromotorContent />
      </AuthCardLayout>
    </Suspense>
  );
}
