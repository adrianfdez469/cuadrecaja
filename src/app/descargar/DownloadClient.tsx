"use client";

import { useEffect, useState } from "react";
import { Box, Button, Typography } from "@mui/material";
import {
  Android,
  ArrowBack,
  Download,
  Memory,
  Refresh,
  VerifiedUser,
} from "@mui/icons-material";
import { useRouter } from "next/navigation";

import { shape, touch } from "@/theme/tokens";
import {
  getDeviceArchitecture,
  getArchitectureLabel,
  DeviceArchitecture,
} from "@/utils/deviceDetection";

import { ChangelogPanel } from "./components/ChangelogPanel";

interface ReleaseInfo {
  version: string;
  apks: Record<DeviceArchitecture, string>;
  changelog: Record<string, Array<{ [key: string]: string }>>;
}

interface DownloadClientProps {
  release: ReleaseInfo;
}

const ASSURANCES = [
  {
    icon: VerifiedUser,
    hue: "semantic.hue.positive.main",
    title: "Seguro y Verificado",
    body: "Nuestras APKs son firmadas y escaneadas contra malware para garantizar tu seguridad.",
  },
  {
    icon: Refresh,
    hue: "text.secondary",
    title: "Siempre al día",
    body: "La aplicación incluye un sistema de notificación de actualizaciones automáticas.",
  },
] as const;

/**
 * The download page.
 *
 * One violet action and nothing else coloured. It used to run a radial
 * gradient across the page, set the product name in a blue-to-crimson gradient
 * clipped to the text, float the download panel on a blurred translucent card
 * with a decorative circle bleeding out of its corner, and give the button a
 * third gradient with a scale-up on hover.
 */
export default function DownloadClient({ release }: DownloadClientProps) {
  const router = useRouter();
  const [detectedArch, setDetectedArch] =
    useState<DeviceArchitecture>("arm64-v8a");

  useEffect(() => {
    setDetectedArch(getDeviceArchitecture());
  }, []);

  const downloadUrl = (fileId: string) =>
    `https://drive.google.com/uc?export=download&id=${fileId}&confirm=t`;

  const recommended =
    release.apks[detectedArch] ||
    release.apks["arm64-v8a"] ||
    release.apks["universal"];

  const currentChangelog = release.changelog[`v${release.version}`] || [];

  return (
    <Box
      sx={{
        minHeight: "100dvh",
        bgcolor: "semantic.surface.page",
        px: { xs: 2, md: 5 },
        pt: { xs: 2, md: 3.5 },
        pb: 6,
      }}
    >
      <Button
        startIcon={<ArrowBack />}
        onClick={() => router.push("/")}
        sx={{ minHeight: touch.min, mb: 3, px: 1, color: "text.secondary" }}
      >
        Volver al inicio
      </Button>

      <Box
        sx={{
          display: "grid",
          gridTemplateColumns: { xs: "1fr", md: "1fr 470px" },
          alignItems: "start",
          gap: 4,
          maxWidth: 1360,
          mx: "auto",
        }}
      >
        <Box>
          <Box sx={{ display: "flex", alignItems: "center", gap: 1.75 }}>
            <Box
              sx={{
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                flex: "0 0 44px",
                width: 44,
                height: 44,
                borderRadius: `${shape.radius.md}px`,
                bgcolor: "semantic.hue.accent.main",
                color: "semantic.hue.accent.contrast",
              }}
            >
              <Android sx={{ fontSize: 24 }} />
            </Box>
            <Typography
              component="h1"
              sx={{
                fontSize: { xs: "1.625rem", md: "1.875rem" },
                fontWeight: 700,
                letterSpacing: "-0.025em",
              }}
            >
              Cuadre de Caja
            </Typography>
          </Box>

          <Typography
            sx={{
              mt: 1.5,
              fontSize: "1rem",
              lineHeight: 1.55,
              color: "text.secondary",
              fontVariantNumeric: "tabular-nums",
            }}
          >
            Escogiste el mejor sistema para tu negocio. Descarga la versión
            oficial v{release.version}.
          </Typography>

          <Box
            sx={{
              mt: 3,
              p: 3,
              bgcolor: "semantic.surface.raised",
              border: "1px solid",
              borderColor: "semantic.surface.border",
              borderRadius: `${shape.radius.md}px`,
            }}
          >
            <Box sx={{ display: "flex", alignItems: "center", gap: 1.25 }}>
              <Memory sx={{ fontSize: 19, color: "text.secondary" }} />
              <Typography
                sx={{
                  fontSize: "0.875rem",
                  fontWeight: 600,
                  color: "text.secondary",
                }}
              >
                Arquitectura detectada: {getArchitectureLabel(detectedArch)}
              </Typography>
            </Box>
            <Typography
              sx={{
                mt: 0.5,
                ml: "29px",
                fontSize: "0.8125rem",
                color: "text.secondary",
              }}
            >
              Optimizamos la descarga según tu dispositivo actual.
            </Typography>

            <Button
              variant="contained"
              fullWidth
              startIcon={<Download />}
              href={downloadUrl(recommended)}
              sx={{
                minHeight: 62,
                mt: 2.5,
                borderRadius: `${shape.radius.md}px`,
                fontSize: "1.1875rem",
                fontVariantNumeric: "tabular-nums",
                backgroundColor: "semantic.hue.accent.main",
                color: "semantic.hue.accent.contrast",
                "&:hover": {
                  backgroundColor: "primary.dark",
                },
              }}
            >
              Descargar APK v{release.version}
            </Button>

            <Typography
              sx={{
                mt: 2.5,
                mb: 1.5,
                textAlign: "center",
                fontSize: "0.8125rem",
                color: "text.secondary",
              }}
            >
              U otras versiones
            </Typography>
            <Box
              sx={{
                display: "flex",
                flexWrap: "wrap",
                justifyContent: "center",
                gap: 1.25,
              }}
            >
              {(Object.keys(release.apks) as DeviceArchitecture[]).map(
                (arch) => (
                  <Button
                    key={arch}
                    variant="outlined"
                    color="inherit"
                    href={downloadUrl(release.apks[arch])}
                    target="_blank"
                    rel="noopener noreferrer"
                    sx={{
                      minHeight: touch.min,
                      px: 2.25,
                      borderRadius: `${shape.radius.md}px`,
                      fontSize: "0.875rem",
                      color: "text.secondary",
                      borderColor: "semantic.surface.border",
                    }}
                  >
                    {arch}
                  </Button>
                ),
              )}
            </Box>
          </Box>

          <Box
            sx={{
              display: "grid",
              gridTemplateColumns: { xs: "1fr", sm: "1fr 1fr" },
              gap: 2,
              mt: 2,
            }}
          >
            {ASSURANCES.map(({ icon: Icon, hue, title, body }) => (
              <Box
                key={title}
                sx={{
                  px: 2.5,
                  py: 2.25,
                  bgcolor: "semantic.surface.raised",
                  border: "1px solid",
                  borderColor: "semantic.surface.border",
                  borderRadius: `${shape.radius.md}px`,
                }}
              >
                <Box sx={{ display: "flex", alignItems: "center", gap: 1.25 }}>
                  <Icon sx={{ fontSize: 20, color: hue }} />
                  <Typography sx={{ fontSize: "1.0625rem", fontWeight: 700 }}>
                    {title}
                  </Typography>
                </Box>
                <Typography
                  sx={{
                    mt: 1,
                    fontSize: "0.875rem",
                    lineHeight: 1.55,
                    color: "text.secondary",
                  }}
                >
                  {body}
                </Typography>
              </Box>
            ))}
          </Box>
        </Box>

        <ChangelogPanel entries={currentChangelog} />
      </Box>
    </Box>
  );
}
