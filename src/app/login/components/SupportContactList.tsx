"use client";

import { Box, Link, Typography } from "@mui/material";
import { Email, WhatsApp } from "@mui/icons-material";

import {
  SUPPORT_EMAIL,
  SUPPORT_PHONES,
  buildSupportWhatsAppUrl,
  type SupportTopic,
} from "@/constants/support";
import { shape, touch } from "@/theme/tokens";

interface SupportContactListProps {
  topic: SupportTopic;
  /** Show the address as well. Only the setup case needs it. */
  showEmail?: boolean;
}

/**
 * The way out of a blocked login.
 *
 * Inside an alert, so it inherits the alert's hue rather than painting its own:
 * the old version hardcoded WhatsApp's brand green and two shades of orange
 * wash, which made an «usuario sin configurar» warning louder than the error
 * beneath it.
 */
export function SupportContactList({
  topic,
  showEmail = false,
}: SupportContactListProps) {
  return (
    <Box sx={{ display: "flex", flexDirection: "column", gap: 0.5, mt: 1 }}>
      {SUPPORT_PHONES.map((phone) => (
        <Link
          key={phone.whatsapp}
          href={buildSupportWhatsAppUrl(phone.whatsapp, topic)}
          target="_blank"
          rel="noopener noreferrer"
          color="inherit"
          sx={{
            display: "flex",
            alignItems: "center",
            gap: 1,
            minHeight: touch.min,
            px: 1,
            borderRadius: `${shape.radius.sm}px`,
            fontSize: "0.875rem",
            fontWeight: 600,
            fontVariantNumeric: "tabular-nums",
            textDecoration: "none",
            "&:hover": { bgcolor: "action.hover" },
          }}
        >
          <WhatsApp sx={{ fontSize: 18 }} />
          {phone.display}
        </Link>
      ))}

      {showEmail && (
        <Box
          sx={{
            display: "flex",
            alignItems: "center",
            gap: 1,
            px: 1,
            pt: 0.5,
          }}
        >
          <Email sx={{ fontSize: 16 }} />
          <Typography variant="body2">{SUPPORT_EMAIL}</Typography>
        </Box>
      )}
    </Box>
  );
}
