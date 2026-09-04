"use client";

import { Box, IconButton, Link, Stack, TextField, Typography } from "@mui/material";
import { ContentCopy, OpenInNew } from "@mui/icons-material";

import { ContentCard } from "@/components/ContentCard";
import { QAB_PUBLIC_STORE_URL_PREFIX } from "@/constants/qab";
import type { ITiendaOnlineLocal } from "@/schemas/tiendaOnline";
import { shape, touch } from "@/theme/tokens";

import { SlugPreviewField } from "./SlugPreviewField";

export interface StoreAddressCardProps {
  local: ITiendaOnlineLocal;
  slug: string;
  isMobile: boolean;
  online: boolean;
  onSlugChange: (next: string) => void;
}

const CARD_TITLE = "Dirección en la tienda online";

export function publicStoreUrl(slug: string): string {
  return `${QAB_PUBLIC_STORE_URL_PREFIX}${slug}`;
}

/**
 * Where the local lives in the online store.
 *
 * Second card, above the nine contact fields, because it is the ONE decision of
 * this screen that cannot be undone: `slug` is a derivation seed only WHEN
 * CREATING, so after the first publish the address is no longer changeable from
 * here.
 */
export function StoreAddressCard({
  local,
  slug,
  isMobile,
  online,
  onSlugChange,
}: Readonly<StoreAddressCardProps>) {
  const published = local.slugQab !== null;

  if (!published) {
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

  const url = publicStoreUrl(local.slugQab as string);

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

        <TextField
          label="Dirección que pediste"
          value={local.slug ?? ""}
          disabled
          fullWidth
          helperText="La dirección se fija al publicar por primera vez y no se puede cambiar desde Cuadre de Caja."
        />

        {local.slug !== null && local.slug !== local.slugQab && (
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
            <Typography variant="body2">
              {`Pediste «${local.slug}» y te asignaron «${local.slugQab}»: alguien ya tenía la que pediste.`}
            </Typography>
          </Box>
        )}
      </Stack>
    </ContentCard>
  );
}

export default StoreAddressCard;
