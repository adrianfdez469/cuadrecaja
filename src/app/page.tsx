"use client";

import { Suspense } from "react";
import { Box, CircularProgress } from "@mui/material";

import { ClosingSection } from "./landing-components/ClosingSection";
import { ContactSection } from "./landing-components/ContactSection";
import { HeroSection } from "./landing-components/HeroSection";
import { LandingFooter } from "./landing-components/LandingFooter";
import { LandingHeader } from "./landing-components/LandingHeader";
import { MoreFeaturesSection } from "./landing-components/MoreFeaturesSection";
import { PillarsSection } from "./landing-components/PillarsSection";
import { PricingSection } from "./landing-components/PricingSection";

/**
 * The public page.
 *
 * One promise, the product on screen, three reasons, the number the day ends
 * on, everything else in one line each, the price, and the form. In that
 * order, because it is the order the questions arrive in.
 */
export default function LandingPage() {
  return (
    <Box
      sx={{
        minHeight: "100vh",
        bgcolor: "semantic.surface.raised",
        overflowX: "hidden",
      }}
    >
      <LandingHeader />
      <HeroSection />
      <PillarsSection />
      <ClosingSection />
      <MoreFeaturesSection />
      <PricingSection />

      {/* The trial form reads `?ref=` from the URL, so it needs a boundary for
          the static build. */}
      <Suspense
        fallback={
          <Box sx={{ display: "flex", justifyContent: "center", py: 12 }}>
            <CircularProgress />
          </Box>
        }
      >
        <ContactSection />
      </Suspense>

      <LandingFooter />
    </Box>
  );
}
