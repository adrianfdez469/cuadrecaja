"use client";

import React, { useEffect, useState, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import {
  Box,
  Typography,
  Button,
  CircularProgress,
  Alert,
  IconButton,
  Tooltip,
  Divider,
  Chip,
} from "@mui/material";
import {
  CheckCircle,
  ContentCopy,
  Login,
  ErrorOutline,
  AccessTime,
  Home,
  WarningAmber,
} from "@mui/icons-material";
import { AuthCardLayout } from "@/components/auth/AuthCardLayout";
import { LOGIN_CREDENTIALS_SESSION_KEY } from "@/constants/userAccount";
import { LANDING_ACTIVATION_TTL_LABEL } from "@/constants/onboarding";

type ActivationState =
  | "loading"
  | "activating"
  | "success"
  | "error_expired"
  | "error_used"
  | "error_conflict"
  | "error_invalid";

interface Credentials {
  usuario: string;
  passwordTemporal: string;
  negocio: string;
  incluirProductosPrueba?: boolean;
}

function CopiarCampo({ label, value }: { label: string; value: string }) {
  const [copiado, setCopiado] = useState(false);

  const copiar = async () => {
    await navigator.clipboard.writeText(value);
    setCopiado(true);
    setTimeout(() => setCopiado(false), 2000);
  };

  return (
    <Box
      sx={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        p: 2,
        bgcolor: "semantic.hue.accent.surface",
        borderRadius: "8px",
        border: "1px solid",
        borderColor: "semantic.surface.border",
      }}
    >
      <Box>
        <Typography
          variant="caption"
          sx={{ color: "text.secondary", display: "block" }}
        >
          {label}
        </Typography>
        <Typography
          variant="body1"
          sx={{
            color: "text.primary",
            fontFamily: "monospace",
            fontWeight: 600,
          }}
        >
          {value}
        </Typography>
      </Box>
      <Tooltip title={copiado ? "¡Copiado!" : "Copiar"}>
        <IconButton
          onClick={copiar}
          size="small"
          sx={{ color: copiado ? "primary.main" : "text.disabled" }}
        >
          <ContentCopy fontSize="small" />
        </IconButton>
      </Tooltip>
    </Box>
  );
}

function ActivarContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const [estado, setEstado] = useState<ActivationState>("loading");
  const [credentials, setCredentials] = useState<Credentials | null>(null);
  const [errorMessage, setErrorMessage] = useState("");

  const navegarALoginConPrefill = () => {
    if (credentials) {
      sessionStorage.setItem(
        LOGIN_CREDENTIALS_SESSION_KEY,
        JSON.stringify({
          usuario: credentials.usuario,
          password: credentials.passwordTemporal,
        }),
      );
    }
    router.push("/login");
  };

  useEffect(() => {
    const token = searchParams.get("token");

    if (!token) {
      setEstado("error_invalid");
      setErrorMessage("No se encontró un enlace de activación válido.");
      return;
    }

    activarCuenta(token);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const activarCuenta = async (token: string) => {
    setEstado("activating");
    try {
      const response = await fetch("/api/activar-cuenta", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token }),
      });

      const data = (await response.json()) as {
        error?: string;
        conflict?: "email" | "negocio" | "both";
      };

      if (response.ok) {
        setCredentials(data as Credentials);
        setEstado("success");
        return;
      }

      if (response.status === 401) {
        setEstado("error_expired");
        setErrorMessage(data.error ?? "El enlace de activación ha expirado.");
        return;
      }

      if (response.status === 409) {
        const c = data.conflict;
        if (c === "negocio" || c === "both") {
          setEstado("error_conflict");
        } else {
          setEstado("error_used");
        }
        setErrorMessage(
          data.error ??
            (c === "negocio" || c === "both"
              ? "Los datos indicados ya están en uso."
              : "Esta cuenta ya fue activada."),
        );
        return;
      }

      setEstado("error_invalid");
      setErrorMessage(data.error ?? "El enlace de activación no es válido.");
    } catch {
      setEstado("error_invalid");
      setErrorMessage("Error de conexión. Por favor, intenta de nuevo.");
    }
  };

  if (estado === "loading" || estado === "activating") {
    return (
      <Box sx={{ textAlign: "center", py: 4 }}>
        <CircularProgress sx={{ color: "primary.main", mb: 2.5 }} size={48} />
        <Typography
          variant="h5"
          sx={{
            fontWeight: 600,
            fontSize: { xs: "1.125rem", md: "1.25rem" },
          }}
        >
          {estado === "loading"
            ? "Verificando tu enlace…"
            : "Configurando tu negocio…"}
        </Typography>
        {estado === "activating" && (
          <Typography variant="body2" sx={{ color: "text.secondary", mt: 1 }}>
            Estamos preparando todo para que puedas comenzar
          </Typography>
        )}
      </Box>
    );
  }

  if (estado === "success" && credentials) {
    return (
      <>
        <Box sx={{ textAlign: "center", mb: 3.5 }}>
          <CheckCircle sx={{ fontSize: 56, color: "primary.main", mb: 2 }} />
          <Typography
            variant="h4"
            sx={{
              fontWeight: 700,
              mb: 0.75,
              fontSize: { xs: "1.5rem", md: "1.75rem" },
            }}
          >
            ¡Tu cuenta está lista!
          </Typography>
          <Typography variant="body1" sx={{ color: "text.secondary" }}>
            Negocio{" "}
            <Box
              component="strong"
              sx={{ color: "primary.main", fontWeight: 700 }}
            >
              {credentials.negocio}
            </Box>{" "}
            creado exitosamente
          </Typography>
        </Box>

        <Box
          sx={{
            p: 2.5,
            bgcolor: "semantic.hue.accent.surface",
            borderRadius: "8px",
            border: "1px solid",
            borderColor: "semantic.surface.border",
            mb: 2.5,
          }}
        >
          <Typography
            variant="subtitle1"
            sx={{ fontWeight: 600, mb: 1.5, fontSize: "0.9375rem" }}
          >
            Tus credenciales de acceso
          </Typography>
          <Box sx={{ display: "flex", flexDirection: "column", gap: 1 }}>
            <CopiarCampo
              label="Usuario (tu correo)"
              value={credentials.usuario}
            />
            <CopiarCampo
              label="Contraseña temporal"
              value={credentials.passwordTemporal}
            />
          </Box>
        </Box>

        <Alert severity="warning" sx={{ mb: 2.5 }}>
          Guarda estas credenciales. Se recomienda cambiar la contraseña después
          de tu primer inicio de sesión.
        </Alert>

        <Divider sx={{ my: 2.5 }} />

        <Box sx={{ mb: 3 }}>
          <Typography
            variant="subtitle1"
            sx={{ fontWeight: 600, mb: 1.5, fontSize: "0.9375rem" }}
          >
            Condiciones de tu período de prueba
          </Typography>
          <Box sx={{ display: "flex", flexDirection: "column", gap: 0.75 }}>
            {[
              "Período de prueba gratuita de 7 días",
              "Acceso completo a todas las funcionalidades",
              "Una tienda preconfigurada lista para usar",
              ...(credentials.incluirProductosPrueba
                ? ["Inventario de ejemplo precargado en tu tienda Principal"]
                : []),
              "Soporte directo con el equipo de desarrollo",
              "Pasados los 7 días podrás contratar el plan que mejor se adapte a tu negocio",
            ].map((item) => (
              <Box
                key={item}
                sx={{ display: "flex", alignItems: "flex-start", gap: 1 }}
              >
                <CheckCircle
                  sx={{
                    fontSize: 16,
                    color: "semantic.hue.positive.main",
                    mt: 0.3,
                    flexShrink: 0,
                  }}
                />
                <Typography variant="body2" sx={{ color: "text.secondary" }}>
                  {item}
                </Typography>
              </Box>
            ))}
          </Box>
        </Box>

        <Button
          variant="contained"
          fullWidth
          startIcon={<Login />}
          onClick={navegarALoginConPrefill}
          sx={{
            minHeight: "56px",
            fontSize: "1rem",
            fontWeight: 600,
          }}
        >
          Ir a iniciar sesión
        </Button>
      </>
    );
  }

  const errorConfig: Record<
    string,
    {
      icon: React.ReactNode;
      title: string;
      chip?: string;
      severity: "warning" | "error" | "info";
    }
  > = {
    error_expired: {
      icon: (
        <AccessTime sx={{ fontSize: 48, color: "semantic.hue.caution.main" }} />
      ),
      title: "Enlace expirado",
      chip: `El enlace era válido por ${LANDING_ACTIVATION_TTL_LABEL}`,
      severity: "warning",
    },
    error_used: {
      icon: (
        <CheckCircle sx={{ fontSize: 48, color: "semantic.hue.info.main" }} />
      ),
      title: "Cuenta ya activada",
      severity: "info",
    },
    error_conflict: {
      icon: (
        <WarningAmber
          sx={{ fontSize: 48, color: "semantic.hue.caution.main" }}
        />
      ),
      title: "No se pudo completar el registro",
      severity: "warning",
    },
    error_invalid: {
      icon: (
        <ErrorOutline
          sx={{ fontSize: 48, color: "semantic.hue.negative.main" }}
        />
      ),
      title: "Enlace inválido",
      severity: "error",
    },
  };

  const config = errorConfig[estado] ?? errorConfig.error_invalid;

  return (
    <Box sx={{ textAlign: "center" }}>
      <Box sx={{ mb: 2.5 }}>{config.icon}</Box>
      <Typography
        variant="h5"
        sx={{
          fontWeight: 700,
          mb: 1,
          fontSize: { xs: "1.25rem", md: "1.375rem" },
        }}
      >
        {config.title}
      </Typography>
      {config.chip && (
        <Chip
          label={config.chip}
          size="small"
          sx={{ mb: 2 }}
          variant="outlined"
        />
      )}
      <Typography
        variant="body1"
        sx={{
          color: "text.secondary",
          mb: 3,
          maxWidth: 400,
          mx: "auto",
        }}
      >
        {errorMessage}
      </Typography>
      <Button
        variant="outlined"
        startIcon={<Home />}
        onClick={() => router.push("/")}
      >
        Volver a la página principal
      </Button>
    </Box>
  );
}

export default function ActivarPage() {
  return (
    <Suspense
      fallback={
        <Box
          sx={{
            display: "flex",
            justifyContent: "center",
            alignItems: "center",
            minHeight: "100dvh",
            bgcolor: "semantic.surface.page",
          }}
        >
          <CircularProgress />
        </Box>
      }
    >
      <AuthCardLayout>
        <ActivarContent />
      </AuthCardLayout>
    </Suspense>
  );
}
