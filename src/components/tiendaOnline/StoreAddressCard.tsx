"use client";

import { Box, IconButton, Link, Stack, TextField, Typography } from "@mui/material";
import { ContentCopy, OpenInNew } from "@mui/icons-material";

import { ContentCard } from "@/components/ContentCard";
import type { ITiendaOnlineLocal } from "@/schemas/tiendaOnline";
import { shape, touch } from "@/theme/tokens";

import { SlugPreviewField } from "./SlugPreviewField";
import {
  assignedSlugNotice,
  isStoreAddressCommitted,
  onlineStoreUrl,
} from "./publicationPresentation";

export interface StoreAddressCardProps {
  local: ITiendaOnlineLocal;
  slug: string;
  isMobile: boolean;
  online: boolean;
  onSlugChange: (next: string) => void;
}

const CARD_TITLE = "Dirección en la tienda online";

const FROZEN_ADDRESS_LABEL = "Dirección que pediste";
const FROZEN_ADDRESS_HELPER =
  "La dirección se fija al publicar por primera vez y no se puede cambiar desde Cuadre de Caja.";

/**
 * The waiting block of state B. One paragraph, three sentences, no glyph and no
 * control: the value does not arrive in this render — the learning runs in the
 * server's cron — and there is no endpoint the browser could press, so a button
 * would be decoration. It deliberately does NOT claim the store already exists
 * on the other side: `isStoreAddressCommitted` proves the event was EMITTED, not
 * applied (ADR 0038), and it must not contradict the `Despublicado` pill either.
 */
const UNKNOWN_ADDRESS_NOTICE =
  "Todavía no sabemos en qué dirección quedó tu local. Cuadre de Caja se la pregunta a la tienda online después de publicar y la muestra aquí en cuanto tenga la respuesta. No hay nada que hacer mientras tanto.";

/**
 * Where the local lives in the online store.
 *
 * Second card, above the nine contact fields, because it is the ONE decision of
 * this screen that cannot be undone: `slug` is a derivation seed only WHEN
 * CREATING, so after the first publish the address is no longer changeable from
 * here.
 *
 * THREE states, gated by the two signals of ADR 0038, both imported and never
 * paraphrased here (E-014): no column of the local is read directly by this
 * card, so a `grep` for either signal's column finds only its one definition.
 */
export function StoreAddressCard({
  local,
  slug,
  isMobile,
  online,
  onSlugChange,
}: Readonly<StoreAddressCardProps>) {
  // State A: never published. The address is still a seed, so it is editable.
  if (!isStoreAddressCommitted(local)) {
    return (
      <ContentCard title={CARD_TITLE} spaceButton>
        <SlugPreviewField
          slug={slug}
          localNombre={local.nombre}
          tiendaId={local.id}
          isMobile={isMobile}
          online={online}
          onSlugChange={onSlugChange}
        />
      </ContentCard>
    );
  }

  const frozenAddressField = (
    <TextField
      label={FROZEN_ADDRESS_LABEL}
      value={local.slug ?? ""}
      disabled
      fullWidth
      helperText={FROZEN_ADDRESS_HELPER}
    />
  );

  // State B: published, address frozen, assigned value still unknown. A `null`
  // URL is exactly «not known in the online store» — the signal the gating table
  // hangs the public-address row on. The waiting block takes the same vertical
  // slot the link row takes in state C, so learning the value replaces one row
  // with another instead of reordering the card. No URL and no divergence
  // notice: there is no value to show.
  const url = onlineStoreUrl(local);
  if (url === null) {
    return (
      <ContentCard title={CARD_TITLE} spaceButton>
        <Stack spacing={1.5}>
          <Box
            sx={{
              p: { xs: 1.5, sm: 2 },
              borderRadius: `${shape.radius.md}px`,
              bgcolor: "semantic.hue.info.surface",
              color: "semantic.hue.info.main",
            }}
          >
            <Typography variant="body2">{UNKNOWN_ADDRESS_NOTICE}</Typography>
          </Box>

          {frozenAddressField}
        </Stack>
      </ContentCard>
    );
  }

  // State C: published and known. Unchanged from F-005 in copy and structure;
  // only the condition that selects it changed.
  const divergence = assignedSlugNotice(local);

  return (
    <ContentCard title={CARD_TITLE} spaceButton>
      <Stack spacing={1.5}>
        <Stack direction="row" alignItems="center" spacing={1}>
          <Link
            href={url}
            target="_blank"
            rel="noopener noreferrer"
            sx={{
              minHeight: touch.min,
              display: "inline-flex",
              alignItems: "center",
              gap: 0.5,
              wordBreak: "break-all",
            }}
          >
            {url}
            <OpenInNew fontSize="small" />
          </Link>
          <IconButton
            aria-label="Copiar la dirección"
            onClick={() => {
              void navigator.clipboard?.writeText(url);
            }}
            sx={{ width: touch.min, height: touch.min }}
          >
            <ContentCopy fontSize="small" />
          </IconButton>
        </Stack>

        {frozenAddressField}

        {divergence !== null && (
          // Without this, the first time the merchant looks at their store they
          // see an address they did not type and assume they mistyped it.
          <Box
            sx={{
              p: 1.5,
              borderRadius: `${shape.radius.md}px`,
              bgcolor: "semantic.hue.caution.surface",
              color: "semantic.hue.caution.main",
            }}
          >
            <Typography variant="body2">{divergence}</Typography>
          </Box>
        )}
      </Stack>
    </ContentCard>
  );
}

export default StoreAddressCard;
