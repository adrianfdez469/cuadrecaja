"use client";

import {
  Box,
  Button,
  IconButton,
  Link,
  Stack,
  Switch,
  Typography,
} from "@mui/material";
import { ContentCopy, InfoOutlined, OpenInNew } from "@mui/icons-material";

import { ContentCard } from "@/components/ContentCard";
import { SectionLabel } from "@/components/SectionLabel";
import { StatusPill } from "@/components/StatusPill";
import type { ITiendaOnlineLocal } from "@/schemas/tiendaOnline";
import { shape, touch } from "@/theme/tokens";

import { StoreSyncStateRow } from "./StoreSyncStateRow";
import { publicStoreUrl } from "./StoreAddressCard";
import { publicationPresentation } from "./publicationPresentation";

// Re-exported so the component stays the single entry point for its callers,
// while the pure part remains importable from a `.ts` module.
export { publicationPresentation };
export type { IPublicationPresentation } from "./publicationPresentation";

export interface PublicationStatusCardProps {
  local: ITiendaOnlineLocal;
  /** The draft's switch value, which only moves once the server confirms. */
  publicarEnTienda: boolean;
  onRequestPublish: () => void;
  onRequestUnpublish: () => void;
  onEditReason: () => void;
  onReviewSchedule: () => void;
}

const CARD_TITLE = "Estado de publicación";

export function PublicationStatusCard({
  local,
  publicarEnTienda,
  onRequestPublish,
  onRequestUnpublish,
  onEditReason,
  onReviewSchedule,
}: Readonly<PublicationStatusCardProps>) {
  const presentation = publicationPresentation(local, publicarEnTienda);
  const existsInStore = local.slugQab !== null;
  const url = existsInStore ? publicStoreUrl(local.slugQab as string) : null;

  return (
    <ContentCard title={CARD_TITLE} spaceButton>
      <Stack spacing={1.5}>
        <Box>
          <StatusPill label={presentation.label} hue={presentation.hue} />
        </Box>

        {url !== null && (
          <Stack
            direction="row"
            alignItems="center"
            spacing={1}
            sx={{ minHeight: touch.comfortable }}
          >
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
              aria-label="Copiar la dirección pública"
              onClick={() => {
                void navigator.clipboard?.writeText(url);
              }}
              sx={{ width: touch.min, height: touch.min }}
            >
              <ContentCopy fontSize="small" />
            </IconButton>
          </Stack>
        )}

        <Stack
          direction="row"
          alignItems="center"
          justifyContent="space-between"
          spacing={1}
          sx={{ minHeight: touch.row }}
        >
          <Typography variant="body1">{presentation.switchLabel}</Typography>
          <Switch
            checked={publicarEnTienda}
            // NEVER optimistic: it moves when the server confirms, not before. A
            // switch that snaps back half a second later is indistinguishable
            // from a missed tap, and what is at stake is whether a store is
            // visible at all.
            onChange={(event) =>
              event.target.checked ? onRequestPublish() : onRequestUnpublish()
            }
            inputProps={{ "aria-label": presentation.switchLabel }}
          />
        </Stack>

        <StoreSyncStateRow
          syncState={local.syncState}
          onReviewSchedule={onReviewSchedule}
        />

        {!publicarEnTienda && local.motivoDespublicacion !== null && (
          <Box
            sx={{
              p: 1.5,
              borderRadius: `${shape.radius.md}px`,
              bgcolor: "semantic.hue.caution.surface",
              color: "semantic.hue.caution.main",
            }}
          >
            <SectionLabel sx={{ color: "inherit" }}>
              MOTIVO QUE VE EL COMPRADOR
            </SectionLabel>
            <Typography variant="body2">
              {local.motivoDespublicacion}
            </Typography>
            <Box>
              <Button
                variant="text"
                color="inherit"
                onClick={onEditReason}
                sx={{ minHeight: touch.min }}
              >
                Cambiar el motivo
              </Button>
            </Box>
            <Typography
              variant="body2"
              sx={{ color: "semantic.text.secondary" }}
            >
              Este es el motivo que envía Cuadre de Caja. Si el equipo de la
              tienda online cerró tu local desde su panel, su mensaje es otro y{" "}
              <b>gana el último que haya actuado</b>.
            </Typography>
          </Box>
        )}

        {existsInStore && (
          <Box
            sx={{
              p: 1.5,
              borderRadius: `${shape.radius.md}px`,
              bgcolor: "semantic.hue.info.surface",
              color: "semantic.hue.info.main",
            }}
          >
            <Stack direction="row" spacing={1}>
              <InfoOutlined fontSize="small" sx={{ mt: 0.25 }} />
              <Typography variant="body2">
                {/* The three sentences come from the contract's field-ownership
                    table. This feature reads NOTHING back from the online
                    store, so saying what the real state is would be inventing
                    it — and the way out (off and on again) is the merchant's
                    only lever, so it cannot be hidden from them. */}
                <b>Este interruptor es tu permiso, no el estado de la tienda.</b>{" "}
                Si el equipo de la tienda online cerró tu local desde su panel,
                aquí no se ve: este interruptor puede seguir encendido y tu local
                estar cerrado allá. Apagarlo y volver a encenderlo <b>sí</b> lo
                reabre.
              </Typography>
            </Stack>
          </Box>
        )}
      </Stack>
    </ContentCard>
  );
}

export default PublicationStatusCard;
