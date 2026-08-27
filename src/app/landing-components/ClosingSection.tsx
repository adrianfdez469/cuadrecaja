"use client";

import { Box, Typography } from "@mui/material";
import { alpha } from "@mui/material/styles";

import { ClosingSummaryCard } from "./ClosingSummaryCard";
import { LandingSection } from "./LandingSection";

/**
 * The near-black block, used once.
 *
 * The whole page is arguing about one number, and this is where it is shown.
 * Flipping the ground here is the same move the POS makes with its charge bar:
 * the figure that decides the day is never the same colour as the page around
 * it.
 */
export function ClosingSection() {
  return (
    <LandingSection tone="inverse">
      <Box
        sx={{
          display: "grid",
          gridTemplateColumns: { xs: "1fr", md: "1fr 1fr" },
          alignItems: "center",
          gap: { xs: 3, md: 7 },
        }}
      >
        <Box>
          <Typography
            component="p"
            sx={{
              mb: 1.5,
              fontSize: "0.75rem",
              fontWeight: 700,
              letterSpacing: "0.1em",
              textTransform: "uppercase",
              color: "semantic.text.onInverseMuted",
            }}
          >
            El cierre del día
          </Typography>

          <Typography
            component="h2"
            sx={{
              fontSize: { xs: "1.625rem", md: "2.25rem" },
              fontWeight: 700,
              lineHeight: 1.15,
              letterSpacing: "-0.025em",
              color: "semantic.text.onInverse",
            }}
          >
            Al final del turno, una sola cifra
          </Typography>

          <Typography
            sx={{
              mt: { xs: 1.75, md: 2.25 },
              fontSize: { xs: "1rem", md: "1.0625rem" },
              lineHeight: 1.6,
              color: (theme) => alpha(theme.palette.semantic.text.onInverse, 0.75),
              textWrap: "pretty",
            }}
          >
            Cierras la caja y el sistema te dice cuánto vendiste, cuánto entró
            en efectivo, cuánto por transferencia, el desglose por moneda y
            cuánto ganaste — lo tuyo y lo de consignación, por separado.
          </Typography>
        </Box>

        <ClosingSummaryCard />
      </Box>
    </LandingSection>
  );
}
