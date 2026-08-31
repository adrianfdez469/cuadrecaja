"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Box,
  CircularProgress,
  ToggleButton,
  ToggleButtonGroup,
  Typography,
} from "@mui/material";

import type { IPlan } from "@/schemas/plan";
import { getPlanes } from "@/services/planService";
import {
  LANDING_CTA_SECTION_ID,
  LANDING_PRICING_SECTION_ID,
  scrollToLandingSection,
} from "@/constants/landingContact";
import { buildPlanLimits } from "@/utils/planUtils";
import { shape } from "@/theme/tokens";

import { CustomPlanRow } from "./CustomPlanRow";
import { LandingSection } from "./LandingSection";
import { PlanCard } from "./PlanCard";
import type { PlanCardData } from "./PlanCard";

type BillingCycle = "monthly" | "yearly";

/** A year costs ten months: the two saved are the reason to prepay. */
const MONTHS_CHARGED_PER_YEAR = 10;
const DAYS_PER_YEAR = 365;

/** `-1` is the API's way of saying «negotiable». */
const NEGOTIABLE = -1;

/** Title-cases the stored name, which arrives shouting from the database. */
function displayName(plan: IPlan): string {
  return plan.nombre.charAt(0) + plan.nombre.slice(1).toLowerCase();
}

function toCardData(plan: IPlan, cycle: BillingCycle): PlanCardData {
  const yearly = cycle === "yearly";
  const free = plan.precio === 0;
  const name = displayName(plan);

  return {
    id: plan.id,
    name,
    price: free
      ? "$0"
      : `$${yearly ? plan.precio * MONTHS_CHARGED_PER_YEAR : plan.precio}`,
    period: free ? "/semana" : yearly ? "/año" : "/mes",
    validity: free
      ? `Prueba de ${plan.duracion} días`
      : `${plan.moneda} · ${yearly ? DAYS_PER_YEAR : plan.duracion} días`,
    limits: buildPlanLimits(plan),
    ctaLabel: free ? "Empezar" : plan.recomendado ? `Elegir ${name}` : "Elegir",
    recommended: plan.recomendado,
  };
}

/**
 * The plans, as the database has them.
 *
 * The design draws four cards and a row, but the list is whatever the API
 * returns and active: adding a plan in configuración has to show up here
 * without a deploy. Plans priced `-1` are negotiated, so they drop out of the
 * grid and into the row underneath, which is the only shape that fits a plan
 * with no number to compare.
 */
export function PricingSection() {
  const [billingCycle, setBillingCycle] = useState<BillingCycle>("monthly");
  const [planes, setPlanes] = useState<IPlan[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getPlanes()
      .then((data) => setPlanes(data.filter((plan) => plan.activo)))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const { priced, negotiated } = useMemo(
    () => ({
      priced: planes.filter((plan) => plan.precio !== NEGOTIABLE),
      negotiated: planes.filter((plan) => plan.precio === NEGOTIABLE),
    }),
    [planes],
  );

  const goToForm = () => scrollToLandingSection(LANDING_CTA_SECTION_ID);

  return (
    <LandingSection id={LANDING_PRICING_SECTION_ID} tone="sunken" divider>
      <Box
        sx={{ textAlign: { xs: "left", md: "center" }, mb: { xs: 3, md: 5 } }}
      >
        <Typography
          component="h2"
          sx={{
            fontSize: { xs: "1.625rem", md: "2.125rem" },
            fontWeight: 700,
            lineHeight: 1.15,
            letterSpacing: "-0.025em",
          }}
        >
          Elige el plan de tu negocio
        </Typography>

        <Typography
          sx={{
            maxWidth: 560,
            mx: { xs: 0, md: "auto" },
            mt: 1.5,
            fontSize: { xs: "1rem", md: "1.1875rem" },
            lineHeight: 1.55,
            color: "text.secondary",
          }}
        >
          Empieza gratis 7 días. Capacitación, migración de datos y soporte
          incluidos en cualquier plan.
        </Typography>

        <Box
          sx={{
            display: "flex",
            alignItems: "center",
            justifyContent: { xs: "flex-start", md: "center" },
            gap: 1.5,
            mt: 3,
          }}
        >
          <ToggleButtonGroup
            value={billingCycle}
            exclusive
            size="small"
            onChange={(_event, value) => value && setBillingCycle(value)}
            aria-label="Ciclo de facturación"
            sx={{
              bgcolor: "semantic.surface.raised",
              "& .MuiToggleButton-root": {
                px: 2,
                borderColor: "semantic.surface.border",
                color: "text.secondary",
                fontWeight: 600,
                "&.Mui-selected": {
                  bgcolor: "semantic.hue.accent.surface",
                  color: "semantic.hue.accent.main",
                  "&:hover": { bgcolor: "semantic.hue.accent.surface" },
                },
              },
            }}
          >
            <ToggleButton value="monthly">Mensual</ToggleButton>
            <ToggleButton value="yearly">Anual</ToggleButton>
          </ToggleButtonGroup>

          {billingCycle === "yearly" && (
            <Box
              component="span"
              sx={{
                display: "inline-flex",
                alignItems: "center",
                height: 26,
                px: 1.25,
                borderRadius: `${shape.radius.pill}px`,
                bgcolor: "semantic.hue.positive.surface",
                color: "semantic.hue.positive.main",
                fontSize: "0.75rem",
                fontWeight: 700,
              }}
            >
              Ahorras 2 meses
            </Box>
          )}
        </Box>
      </Box>

      {loading ? (
        <Box sx={{ display: "flex", justifyContent: "center", py: 8 }}>
          <CircularProgress />
        </Box>
      ) : (
        <>
          <Box
            sx={{
              display: "grid",
              gridTemplateColumns: {
                xs: "1fr",
                sm: "repeat(2, minmax(0, 1fr))",
                lg: "repeat(4, minmax(0, 1fr))",
              },
              gap: 2,
            }}
          >
            {priced.map((plan) => (
              <PlanCard
                key={plan.id}
                plan={toCardData(plan, billingCycle)}
                onChoose={goToForm}
              />
            ))}
          </Box>

          {negotiated.map((plan) => (
            <CustomPlanRow
              key={plan.id}
              name={displayName(plan)}
              description={
                plan.descripcion ??
                "Locales, usuarios y funcionalidades a medida. Duración negociable."
              }
              onRequestQuote={goToForm}
            />
          ))}
        </>
      )}
    </LandingSection>
  );
}
