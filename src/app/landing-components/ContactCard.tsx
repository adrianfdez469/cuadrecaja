"use client";

import { Box, Link, Typography } from "@mui/material";

import {
  LANDING_CONTACTS,
  LANDING_CONTACT_INFO_SECTION_ID,
  buildWhatsAppUrl,
} from "@/constants/landingContact";
import { shape, touch } from "@/theme/tokens";

/**
 * The people behind the product, next to the form.
 *
 * This used to be a section of its own further down the page, reached by a
 * «Ver información de contacto» button that scrolled past everything. Someone
 * who would rather talk than fill a form should not have to travel for it, so
 * it sits beside the form it is an alternative to.
 *
 * Every phone is a WhatsApp deep link with the message already written, and
 * every address a `mailto:` — the same behaviour the old section had.
 */
export function ContactCard() {
  return (
    <Box
      id={LANDING_CONTACT_INFO_SECTION_ID}
      sx={{
        p: { xs: 2.25, md: 3 },
        bgcolor: "semantic.surface.page",
        border: "1px solid",
        borderColor: "semantic.surface.border",
        borderRadius: `${shape.radius.md}px`,
      }}
    >
      <Typography
        component="h3"
        sx={{ fontSize: "1.1875rem", fontWeight: 700 }}
      >
        ¿Prefieres hablar con nosotros?
      </Typography>
      <Typography
        sx={{
          mt: 0.75,
          fontSize: "0.9375rem",
          lineHeight: 1.55,
          color: "text.secondary",
        }}
      >
        Escríbenos por WhatsApp o correo y te acompañamos en la puesta en
        marcha.
      </Typography>

      {LANDING_CONTACTS.map((person, index) => (
        <Box
          key={person.email}
          sx={{
            mt: index === 0 ? 3 : 2,
            pt: 2.5,
            borderTop: "1px solid",
            borderColor: "semantic.surface.border",
          }}
        >
          <Typography sx={{ fontSize: "1rem", fontWeight: 700 }}>
            {person.name}
          </Typography>
          <Typography
            sx={{ mt: "2px", fontSize: "0.8125rem", color: "text.disabled" }}
          >
            {person.role}
          </Typography>

          <Box sx={{ display: "flex", flexDirection: "column", mt: 1.25 }}>
            {person.phones.map((phone) => (
              <Link
                key={phone.whatsapp}
                href={buildWhatsAppUrl(phone.whatsapp)}
                target="_blank"
                rel="noopener noreferrer"
                aria-label={`Escribir por WhatsApp al ${phone.display}${phone.label ? ` (${phone.label})` : ""}`}
                sx={{
                  display: "flex",
                  alignItems: "center",
                  minHeight: touch.min,
                  fontSize: "0.9375rem",
                  fontWeight: 600,
                  fontVariantNumeric: "tabular-nums",
                  textDecoration: "none",
                  "&:hover": { textDecoration: "underline" },
                }}
              >
                {phone.display}
              </Link>
            ))}

            <Link
              href={`mailto:${person.email}`}
              sx={{
                display: "flex",
                alignItems: "center",
                minHeight: touch.min,
                fontSize: "0.9375rem",
                textDecoration: "none",
                wordBreak: "break-all",
                "&:hover": { textDecoration: "underline" },
              }}
            >
              {person.email}
            </Link>
          </Box>
        </Box>
      ))}
    </Box>
  );
}
