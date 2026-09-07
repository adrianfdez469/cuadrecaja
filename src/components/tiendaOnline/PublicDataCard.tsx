"use client";

import { Box, Button, Stack, TextField, Typography } from "@mui/material";
import { useRouter } from "next/navigation";

import { ContentCard } from "@/components/ContentCard";
import {
  LATITUDE_MAX,
  LATITUDE_MIN,
  LONGITUDE_MAX,
  LONGITUDE_MIN,
} from "@/constants/map";
import {
  QAB_STORE_ADDRESS_MAX_LENGTH,
  QAB_STORE_CITY_MAX_LENGTH,
  QAB_STORE_DESCRIPTION_MAX_LENGTH,
  QAB_STORE_EMAIL_MAX_LENGTH,
  QAB_STORE_PHONE_MAX_LENGTH,
  QAB_STORE_PROVINCE_MAX_LENGTH,
} from "@/constants/qab";
import type { IMapPoint } from "@/schemas/map";
import type { ITiendaOnlineLocal } from "@/schemas/tiendaOnline";
import { shape, touch } from "@/theme/tokens";
import {
  CONTACT_FIELD_LABELS,
  draftToMapPoint,
  emptyContactFieldsNotice,
  hasLonelyCoordinate,
} from "@/utils/tiendaOnlineDraft";
import type { ITiendaOnlineDraft } from "@/utils/tiendaOnlineDraft";

import { MAP_GROUP_LABEL, mapHintCopy } from "./map/mapCopy";
import { isKnownInOnlineStore } from "./publicationPresentation";
import { StoreLocationField } from "./StoreLocationField";

export interface PublicDataCardProps {
  local: ITiendaOnlineLocal;
  draft: ITiendaOnlineDraft;
  isMobile: boolean;
  onFieldChange: (field: keyof ITiendaOnlineDraft, value: string) => void;
  onPointChange: (point: IMapPoint | null) => void;
}

const CARD_TITLE = "Datos públicos del local";
const LOCALES_ROUTE = "/configuracion/locales";
const DESCRIPTION_ROWS = 3;
/**
 * The width of the coordinates column once the card stops growing (`md`, 900 px,
 * where `Container maxWidth="md"` tops out). Side by side inside it the two
 * fields would be ~118 px each, which does not fit «Longitud» plus a
 * nine-character number, so there they stack instead.
 */
const COORDINATES_COLUMN_WIDTH = 264;

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
  onPointChange,
}: Readonly<PublicDataCardProps>) {
  const router = useRouter();

  // Derived from the draft on every render, and it is the ONLY reader of the two
  // coordinates for map purposes: the marker cannot get out of step with the
  // fields because it is drawn from the very same value (ADR 0098).
  const point = draftToMapPoint(draft);

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

        {/* The SAME element that grouped the two coordinates before F-025, with
            `component` and `aria-label` added and nothing wrapped around it: it
            stays the direct flex item of this `Stack`, so it cannot trap
            anybody's own margin (E-048). */}
        <Box component="section" aria-label={MAP_GROUP_LABEL}>
          {/* Names the whole group, so it goes above the row and not inside
              either half. The caption treatment is this card's own, the one
              «Nombre del local» already uses. */}
          <Typography
            variant="caption"
            sx={{ color: "semantic.text.secondary" }}
          >
            {MAP_GROUP_LABEL}
          </Typography>
          {/* Shown ALWAYS, including when the map fails: neither this card nor
              the field can know that it did, so both variants name the map AND
              the fields and stay true either way (E-013). */}
          <Typography variant="body2" sx={{ color: "semantic.text.secondary" }}>
            {mapHintCopy(point !== null)}
          </Typography>

          <Box
            sx={{
              mt: 1,
              display: "flex",
              flexDirection: { xs: "column", md: "row" },
              alignItems: "flex-start",
              gap: { xs: 2, md: 3 },
            }}
          >
            <Box sx={{ width: "100%", flex: { md: 1 }, minWidth: 0 }}>
              <StoreLocationField
                point={point}
                onPointChange={onPointChange}
              />
            </Box>

            <Box
              sx={{
                width: { xs: "100%", md: COORDINATES_COLUMN_WIDTH },
                flexShrink: 0,
              }}
            >
              {/* The one pair that stays side by side even at 320 px: split
                  apart, they invite filling one and forgetting the other, and
                  half a coordinate draws no point on any map. They stack only in
                  the narrow column of the two-column layout. */}
              <Stack direction={{ xs: "row", md: "column" }} spacing={2}>
                {field("latitud", {
                  type: "number",
                  slotProps: {
                    htmlInput: {
                      min: LATITUDE_MIN,
                      max: LATITUDE_MAX,
                      step: "any",
                    },
                  },
                })}
                {field("longitud", {
                  type: "number",
                  slotProps: {
                    htmlInput: {
                      min: LONGITUDE_MIN,
                      max: LONGITUDE_MAX,
                      step: "any",
                    },
                  },
                })}
              </Stack>
              {hasLonelyCoordinate(draft) && (
                <Typography
                  variant="body2"
                  sx={{ mt: 1, color: "semantic.hue.caution.main" }}
                >
                  Pon las dos coordenadas o ninguna: con una sola no se puede
                  ubicar el local en el mapa.
                </Typography>
              )}
            </Box>
          </Box>
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
