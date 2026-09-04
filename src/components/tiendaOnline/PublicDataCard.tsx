"use client";

import { Box, Button, Stack, TextField, Typography } from "@mui/material";
import { useRouter } from "next/navigation";

import { ContentCard } from "@/components/ContentCard";
import {
  QAB_STORE_ADDRESS_MAX_LENGTH,
  QAB_STORE_CITY_MAX_LENGTH,
  QAB_STORE_DESCRIPTION_MAX_LENGTH,
  QAB_STORE_EMAIL_MAX_LENGTH,
  QAB_STORE_PHONE_MAX_LENGTH,
  QAB_STORE_PROVINCE_MAX_LENGTH,
} from "@/constants/qab";
import type { ITiendaOnlineLocal } from "@/schemas/tiendaOnline";
import { touch } from "@/theme/tokens";
import {
  CONTACT_FIELD_LABELS,
  hasLonelyCoordinate,
} from "@/utils/tiendaOnlineDraft";
import type { ITiendaOnlineDraft } from "@/utils/tiendaOnlineDraft";

export interface PublicDataCardProps {
  local: ITiendaOnlineLocal;
  draft: ITiendaOnlineDraft;
  isMobile: boolean;
  onFieldChange: (field: keyof ITiendaOnlineDraft, value: string) => void;
}

const CARD_TITLE = "Datos públicos del local";
const LOCALES_ROUTE = "/configuracion/locales";
const DESCRIPTION_ROWS = 3;
const LATITUDE_MIN = -90;
const LATITUDE_MAX = 90;
const LONGITUDE_MIN = -180;
const LONGITUDE_MAX = 180;

/**
 * Neutral helper shown under every empty contact field.
 *
 * The two differentiated copies — «no aparece en tu tienda» vs «se va a borrar
 * de tu tienda online» — say opposite things, and picking between them needs to
 * know whether the store row already exists on the other side. That answer
 * requires the real slug, which is deferred to F-020, so until then the screen
 * asserts nothing about what happens to an empty field. `Opcional.` alone is
 * the only claim that cannot be false.
 */
const EMPTY_FIELD_HELPER = "Opcional.";

/**
 * What the buyer sees. The harder half — telling the merchant that on the other
 * side the nine contact fields are written with `payload.x ?? null`, so an empty
 * field DELETES the column — is deferred to F-020 along with the real slug.
 */
export function PublicDataCard({
  local,
  draft,
  isMobile,
  onFieldChange,
}: Readonly<PublicDataCardProps>) {
  const router = useRouter();

  const emptyHelper = (value: string): string | undefined =>
    value.trim().length > 0 ? undefined : EMPTY_FIELD_HELPER;

  const field = (
    key: keyof typeof CONTACT_FIELD_LABELS,
    extra?: Parameters<typeof TextField>[0],
  ) => (
    <TextField
      label={CONTACT_FIELD_LABELS[key]}
      value={draft[key]}
      onChange={(event) => onFieldChange(key, event.target.value)}
      helperText={emptyHelper(draft[key] as string)}
      fullWidth
      {...extra}
    />
  );

  return (
    <ContentCard title={CARD_TITLE} spaceButton>
      <Stack spacing={2}>
        {/* The empty-field count banner is deferred to F-020: it only makes
            sense next to the «se va a borrar» copy, and both need the real
            slug to know whether the row exists on the other side. */}
        <Box>
          {/* Read-only on purpose: `Tienda.nombre` is the local's name in the
              WHOLE application — tickets, reports, movements, closings — with a
              per-business uniqueness index, and there is no separate «public
              name» column. A field here would rename the local everywhere
              without warning. */}
          <Typography
            variant="caption"
            sx={{ color: "semantic.text.secondary" }}
          >
            Nombre del local
          </Typography>
          <Typography variant="body1" sx={{ fontWeight: 600 }}>
            {local.nombre}
          </Typography>
          <Typography variant="body2" sx={{ color: "semantic.text.secondary" }}>
            Es el nombre que ve el comprador y el que usa Cuadre de Caja en todas
            partes.
          </Typography>
          <Button
            variant="text"
            onClick={() => router.push(LOCALES_ROUTE)}
            sx={{ minHeight: touch.min, px: 0 }}
          >
            Cambiarlo en Locales
          </Button>
        </Box>

        {field("descripcion", {
          multiline: true,
          rows: DESCRIPTION_ROWS,
          slotProps: { htmlInput: { maxLength: QAB_STORE_DESCRIPTION_MAX_LENGTH } },
        })}
        {field("direccion", {
          slotProps: { htmlInput: { maxLength: QAB_STORE_ADDRESS_MAX_LENGTH } },
        })}

        <Stack direction={isMobile ? "column" : "row"} spacing={2}>
          {field("ciudad", {
            slotProps: { htmlInput: { maxLength: QAB_STORE_CITY_MAX_LENGTH } },
          })}
          {field("provincia", {
            slotProps: { htmlInput: { maxLength: QAB_STORE_PROVINCE_MAX_LENGTH } },
          })}
        </Stack>

        <Box>
          {/* The one pair that stays side by side even at 320 px: split apart,
              they invite filling one and forgetting the other, and half a
              coordinate draws no point on any map. */}
          <Stack direction="row" spacing={2}>
            {field("latitud", {
              type: "number",
              slotProps: {
                htmlInput: { min: LATITUDE_MIN, max: LATITUDE_MAX, step: "any" },
              },
            })}
            {field("longitud", {
              type: "number",
              slotProps: {
                htmlInput: { min: LONGITUDE_MIN, max: LONGITUDE_MAX, step: "any" },
              },
            })}
          </Stack>
          {hasLonelyCoordinate(draft) && (
            <Typography
              variant="body2"
              sx={{ mt: 1, color: "semantic.hue.caution.main" }}
            >
              Pon las dos coordenadas o ninguna: con una sola no se puede ubicar
              el local en el mapa.
            </Typography>
          )}
        </Box>

        <Stack direction={isMobile ? "column" : "row"} spacing={2}>
          {field("telefono", {
            type: "tel",
            slotProps: { htmlInput: { maxLength: QAB_STORE_PHONE_MAX_LENGTH } },
          })}
          {field("whatsapp", {
            type: "tel",
            slotProps: { htmlInput: { maxLength: QAB_STORE_PHONE_MAX_LENGTH } },
          })}
        </Stack>

        {field("email", {
          type: "email",
          slotProps: { htmlInput: { maxLength: QAB_STORE_EMAIL_MAX_LENGTH } },
        })}
      </Stack>
    </ContentCard>
  );
}

export default PublicDataCard;
