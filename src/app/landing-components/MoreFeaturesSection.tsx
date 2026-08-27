"use client";

import { Box, Typography } from "@mui/material";

import { SectionLabel } from "@/components/SectionLabel";
import { LANDING_FEATURES_SECTION_ID } from "@/constants/landingContact";

import { CheckBadgeIcon } from "./LandingIcons";
import { LandingSection } from "./LandingSection";

/**
 * Everything else the product does, as one line each.
 *
 * These nine replace fourteen expandable cards. A visitor scanning a landing
 * wants to know whether their case is covered, not to read a manual — so each
 * item is the shortest sentence that answers «¿lo hace o no?».
 */
const EXTRAS = [
  "Tickets de venta personalizables por tienda",
  "Varios locales y almacenes en un solo sistema",
  "Productos e inventario en la misma pantalla",
  "Códigos, etiquetas y escaneo con pistola o cámara",
  "Productos en consignación, con cuenta para el proveedor",
  "Descuentos por porcentaje, monto o código",
  "Permisos por persona y por local",
  "Reportes en Word o Excel para tu contador",
  "App instalable en celular o tablet",
] as const;

export function MoreFeaturesSection() {
  return (
    <LandingSection id={LANDING_FEATURES_SECTION_ID}>
      <SectionLabel>Además</SectionLabel>

      <Box
        sx={{
          display: "grid",
          gridTemplateColumns: { xs: "1fr", md: "repeat(3, minmax(0, 1fr))" },
          gap: { xs: "12px", md: "14px 32px" },
        }}
      >
        {EXTRAS.map((item) => (
          <Box
            key={item}
            sx={{ display: "flex", alignItems: "flex-start", gap: 1.25 }}
          >
            <CheckBadgeIcon
              sx={{
                flex: "0 0 18px",
                width: 18,
                height: 18,
                mt: "3px",
                color: "semantic.hue.accent.main",
              }}
            />
            <Typography sx={{ fontSize: "0.9375rem", lineHeight: 1.55 }}>
              {item}
            </Typography>
          </Box>
        ))}
      </Box>

      <Typography
        sx={{
          mt: { xs: 3, md: 4 },
          pt: { xs: 2.5, md: 3 },
          borderTop: "1px solid",
          borderColor: "semantic.surface.border",
          fontSize: "0.9375rem",
          lineHeight: 1.6,
          color: "text.secondary",
          textWrap: "pretty",
        }}
      >
        Sirve igual para una tienda de barrio que para una cadena con almacenes,
        administradores, vendedores y jefes de negocio.
      </Typography>
    </LandingSection>
  );
}
