"use client";

import { Box, Link, Typography } from "@mui/material";

import { BrandLockup } from "@/components/brand";
import {
  LANDING_CONTACTS,
  LANDING_CTA_SECTION_ID,
  LANDING_FEATURES_SECTION_ID,
  LANDING_PRICING_SECTION_ID,
  buildWhatsAppUrl,
  scrollToLandingSection,
} from "@/constants/landingContact";
import { touch } from "@/theme/tokens";
import { useLandingNavigation } from "@/hooks/useLandingNavigation";

const [PRIMARY_CONTACT] = LANDING_CONTACTS;

/**
 * The footer, as three short lists.
 *
 * It used to reprint all fourteen features here as bullet text — the same copy
 * the page had already made twice. A footer's job is to be the index, not the
 * third telling.
 */
export function LandingFooter() {
  const { navigateTo } = useLandingNavigation();

  const columns = [
    {
      title: "Producto",
      links: [
        {
          label: "Funcionalidades",
          onClick: () => scrollToLandingSection(LANDING_FEATURES_SECTION_ID),
        },
        {
          label: "Planes y precios",
          onClick: () => scrollToLandingSection(LANDING_PRICING_SECTION_ID),
        },
        {
          label: "Descargar app Android",
          onClick: () => navigateTo("/descargar"),
        },
      ],
    },
    {
      title: "Empezar",
      links: [
        {
          label: "Probar gratis",
          onClick: () => scrollToLandingSection(LANDING_CTA_SECTION_ID),
        },
        {
          label: "Ser promotor",
          onClick: () => navigateTo("/promotor/registro"),
        },
        { label: "Iniciar Sesión", onClick: () => navigateTo("/login") },
      ],
    },
  ];

  return (
    <Box
      component="footer"
      sx={{
        px: { xs: 2, md: 3 },
        pt: { xs: 3.5, md: 5 },
        pb: 4,
        bgcolor: "semantic.surface.page",
        borderTop: "1px solid",
        borderColor: "semantic.surface.border",
      }}
    >
      <Box sx={{ maxWidth: 1200, mx: "auto" }}>
        <Box
          sx={{
            display: "flex",
            flexDirection: { xs: "column", md: "row" },
            alignItems: { xs: "stretch", md: "flex-start" },
            justifyContent: "space-between",
            gap: { xs: 3, md: 5 },
          }}
        >
          <Box sx={{ maxWidth: 420 }}>
            <BrandLockup markSize={30} wordSize={16} sx={{ gap: 1.25 }} />
            <Typography
              sx={{
                mt: 1.25,
                fontSize: "0.875rem",
                lineHeight: 1.6,
                color: "text.secondary",
              }}
            >
              Ventas, inventario y cierre de caja para un local o para varios.
              Cobra en varias monedas, imprime tickets y sigue vendiendo sin
              conexión.
            </Typography>
          </Box>

          <Box
            sx={{
              display: "grid",
              gridTemplateColumns: { xs: "1fr 1fr", md: "repeat(3, auto)" },
              gap: { xs: 2.5, md: 7 },
            }}
          >
            {columns.map((column) => (
              <Box
                key={column.title}
                sx={{ display: "flex", flexDirection: "column", gap: 0.75 }}
              >
                <Typography
                  component="h3"
                  sx={{ mb: 0.25, fontSize: "0.8125rem", fontWeight: 700 }}
                >
                  {column.title}
                </Typography>
                {column.links.map((link) => (
                  <Link
                    key={link.label}
                    component="button"
                    type="button"
                    onClick={link.onClick}
                    sx={{
                      alignSelf: "flex-start",
                      minHeight: { xs: touch.min, md: "auto" },
                      fontSize: "0.875rem",
                      color: "text.secondary",
                      textAlign: "left",
                      textDecoration: "none",
                      cursor: "pointer",
                      "&:hover": { textDecoration: "underline" },
                    }}
                  >
                    {link.label}
                  </Link>
                ))}
              </Box>
            ))}

            <Box sx={{ display: "flex", flexDirection: "column", gap: 0.75 }}>
              <Typography
                component="h3"
                sx={{ mb: 0.25, fontSize: "0.8125rem", fontWeight: 700 }}
              >
                Contacto
              </Typography>
              <Link
                href={buildWhatsAppUrl(PRIMARY_CONTACT.phones[0].whatsapp)}
                target="_blank"
                rel="noopener noreferrer"
                sx={{
                  alignSelf: "flex-start",
                  minHeight: { xs: touch.min, md: "auto" },
                  display: "flex",
                  alignItems: "center",
                  fontSize: "0.875rem",
                  color: "text.secondary",
                  textDecoration: "none",
                  "&:hover": { textDecoration: "underline" },
                }}
              >
                WhatsApp
              </Link>
              <Link
                href={`mailto:${PRIMARY_CONTACT.email}`}
                sx={{
                  alignSelf: "flex-start",
                  minHeight: { xs: touch.min, md: "auto" },
                  display: "flex",
                  alignItems: "center",
                  fontSize: "0.875rem",
                  color: "text.secondary",
                  textDecoration: "none",
                  "&:hover": { textDecoration: "underline" },
                }}
              >
                Correo
              </Link>
            </Box>
          </Box>
        </Box>

        <Typography
          sx={{
            mt: { xs: 3, md: 4 },
            pt: 2.5,
            borderTop: "1px solid",
            borderColor: "semantic.surface.border",
            fontSize: "0.8125rem",
            color: "text.disabled",
          }}
        >
          © 2025 Cuadre de Caja. Todos los derechos reservados.
        </Typography>
      </Box>
    </Box>
  );
}
