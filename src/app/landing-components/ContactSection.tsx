"use client";

import { Box } from "@mui/material";

import { LANDING_CTA_SECTION_ID } from "@/constants/landingContact";

import { ContactCard } from "./ContactCard";
import { LandingSection } from "./LandingSection";
import { TrialForm } from "./TrialForm";

/**
 * The form, with the alternative to it alongside.
 *
 * One section instead of the two the page used to end with: asking for the
 * trial and offering to talk are the same decision, so they belong at the same
 * scroll position.
 */
export function ContactSection() {
  return (
    <LandingSection id={LANDING_CTA_SECTION_ID}>
      <Box
        sx={{
          display: "grid",
          gridTemplateColumns: { xs: "1fr", md: "1.15fr 1fr" },
          alignItems: "start",
          gap: { xs: 3, md: 7 },
        }}
      >
        <TrialForm />
        <ContactCard />
      </Box>
    </LandingSection>
  );
}
