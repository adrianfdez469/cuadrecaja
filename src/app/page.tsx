import { Suspense } from "react";
import { Box, CircularProgress } from "@mui/material";

import { listActivePlans } from "@/lib/planes";

import { ClosingSection } from "./landing-components/ClosingSection";
import { ContactSection } from "./landing-components/ContactSection";
import { HeroSection } from "./landing-components/HeroSection";
import { LandingFooter } from "./landing-components/LandingFooter";
import { LandingHeader } from "./landing-components/LandingHeader";
import { MoreFeaturesSection } from "./landing-components/MoreFeaturesSection";
import { PillarsSection } from "./landing-components/PillarsSection";
import { PricingSection } from "./landing-components/PricingSection";

/**
 * Rebuild the landing at most once an hour.
 *
 * Prices are the only data on this page and they change a handful of times a
 * year, so an hour of staleness is invisible to a visitor while a plan edited
 * in configuración still reaches the public page without a deploy. Next
 * requires this to be a literal it can read statically, so it cannot be moved
 * to `src/constants/`.
 */
export const revalidate = 3600;

/**
 * The public page.
 *
 * One promise, the product on screen, three reasons, the number the day ends
 * on, everything else in one line each, the price, and the form. In that
 * order, because it is the order the questions arrive in.
 *
 * The plans are read here, on the server, and handed down as props. A browser
 * request for them would hit the authenticated API gate and be answered with a
 * 401, which the axios interceptor turns into a sign-out: the public page
 * would bounce every anonymous visitor to `/login`.
 */
export default async function LandingPage() {
  const planes = await listActivePlans();

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
      <PricingSection planes={planes} />

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
