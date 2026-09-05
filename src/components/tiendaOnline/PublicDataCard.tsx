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
import { shape, touch } from "@/theme/tokens";
import {
  CONTACT_FIELD_LABELS,
  emptyContactFieldsNotice,
  hasLonelyCoordinate,
} from "@/utils/tiendaOnlineDraft";
import type { ITiendaOnlineDraft } from "@/utils/tiendaOnlineDraft";

import { isKnownInOnlineStore } from "./publicationPresentation";

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
 * The two differentiated helpers of an empty contact field. They say opposite
 * things, and which one is true depends on whether the store row exists on the
 * other side — the question `isKnownInOnlineStore` answers, and the only PROOF
 * cuadrecaja has of it (ADR 0038b). Copy fixed by the F-005 design (E-016).
 */
const EMPTY_FIELD_HELPER_KNOWN = "Vacío: se va a borrar de tu tienda online.";
const EMPTY_FIELD_HELPER_UNKNOWN =
  "Opcional. Si lo dejas vacío, no aparece en tu tienda.";

/**
 * What the buyer sees, plus the harder half: on the other side the nine contact
 * fields are written with `payload.x ?? null`, so an empty field DELETES the
 * column. That is what the count banner and the tinted helpers are for.
 */
export function PublicDataCard({
  local,
  draft,
  isMobile,
  onFieldChange,
}: Readonly<PublicDataCardProps>) {
  const router = useRouter();

  // Derived HERE from the prop that already arrives, never passed down as a
  // flag: a flag travelling by prop is E-014's paraphrased definition on a bus.
  const knownInStore = isKnownInOnlineStore(local);
  // From `draft`, not from `local`: that is what makes the count drop live as
  // the merchant types, with no reload (acceptance criterion 7).
  const countNotice = knownInStore ? emptyContactFieldsNotice(draft) : null;

  const emptyHelper = (value: string): string | undefined => {
    if (value.trim().length > 0) return undefined;
    return knownInStore ? EMPTY_FIELD_HELPER_KNOWN : EMPTY_FIELD_HELPER_UNKNOWN;
  };

  const field = (
    key: keyof typeof CONTACT_FIELD_LABELS,
    extra?: Parameters<typeof TextField>[0],
  ) => (
    <TextField
      label={CONTACT_FIELD_LABELS[key]}
      value={draft[key]}
      onChange={(event) => onFieldChange(key, event.target.value)}
      fullWidth
      {...extra}
      helperText={emptyHelper(draft[key] as string)}
      // NEVER `error`: an empty contact field saves perfectly and can be a
      // deliberate choice. The tint goes on the helper text alone, so the field
      // never gets the `Mui-error` class nor reads as invalid. Declared AFTER
      // the spread, merging whatever `extra` brought, so a caller's `htmlInput`
      // survives and this tint is not dropped by it.
      slotProps={{
        ...extra?.slotProps,
        formHelperText: knownInStore
          ? { sx: { color: "semantic.hue.caution.main" } }
          : undefined,
      }}
    />
  );

  return (
    <ContentCard title={CARD_TITLE} spaceButton>
      <Stack spacing={2}>
        {countNotice !== null && (
          // First child of the card body, above the read-only name: between what
          // is only read and what can cost real data, what can be lost goes on
          // top. One text node, no glyph, no control, no bold and no animated
          // height — it shrinks by a reflow, never by a transition.
          <Box
            sx={{
              p: { xs: 1.5, sm: 2 },
              borderRadius: `${shape.radius.md}px`,
              bgcolor: "semantic.hue.caution.surface",
              color: "semantic.hue.caution.main",
            }}
          >
            <Typography variant="body2">{countNotice}</Typography>
          </Box>
        )}

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
