"use client";

import { Box } from "@mui/material";

import { LandingSection } from "./LandingSection";
import {
  MarginIcon,
  MultiCurrencyIcon,
  OfflineSalesIcon,
} from "./LandingIcons";
import { PillarCard } from "./PillarCard";

const PILLARS = [
  {
    icon: OfflineSalesIcon,
    title: "Vende aunque se caiga el internet",
    description:
      "Cobras, se guarda la venta y cuando vuelve la conexión se sincroniza sola. Nunca dejas de vender.",
  },
  {
    icon: MultiCurrencyIcon,
    title: "Cobra en varias monedas",
    description:
      "Mezcla efectivo y transferencia en la misma venta, con tus tasas de cambio. Al cerrar ves cuánto entró en cada moneda.",
  },
  {
    icon: MarginIcon,
    title: "Sabe si ganas o pierdes",
    description:
      "El sistema calcula el costo promedio solo. Ves la ganancia por producto y por período, sin cuentas a mano.",
  },
] as const;

/**
 * Three reasons, and only three.
 *
 * The page used to list fourteen features, each behind a modal. Fourteen
 * reasons is no reason: the visitor reads none of them. These are the three
 * the product is actually chosen for.
 */
export function PillarsSection() {
  return (
    <LandingSection divider>
      <Box
        sx={{
          display: "grid",
          gridTemplateColumns: { xs: "1fr", md: "repeat(3, minmax(0, 1fr))" },
          gap: { xs: 4, md: 4 },
        }}
      >
        {PILLARS.map((pillar) => (
          <PillarCard key={pillar.title} {...pillar} />
        ))}
      </Box>
    </LandingSection>
  );
}
