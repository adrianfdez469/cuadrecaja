"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  Box,
  Button,
  FormControlLabel,
  MenuItem,
  Radio,
  RadioGroup,
  Stack,
  Switch,
  TextField,
  Typography,
} from "@mui/material";

import { ContentCard } from "@/components/ContentCard";
import { SectionLabel } from "@/components/SectionLabel";
import {
  QAB_CHECKOUT_MODES,
  QAB_DELIVERY_FEE_MODES,
  QAB_DELIVERY_FEE_MODE_FLAT_RATE,
  QAB_ORDER_EXPIRY_HOURS_MAX,
  QAB_ORDER_EXPIRY_HOURS_MIN,
} from "@/constants/qab";
import type {
  IQabCheckoutMode,
  IQabDeliveryFeeMode,
  IQabPurchaseConfigIssue,
} from "@/schemas/qabStorePurchaseConfig";
import { shape, touch } from "@/theme/tokens";
import type { ITiendaOnlineDraft } from "@/utils/tiendaOnlineDraft";

import {
  CHECKOUT_MODE_DESCRIPTIONS,
  CHECKOUT_MODE_LABELS,
  CHECKOUT_SECTION_LABEL,
  DELIVERY_DISABLED_HELP,
  DELIVERY_ENABLED_LABEL,
  DELIVERY_FEE_HELP,
  DELIVERY_FEE_KEPT_NOTE,
  DELIVERY_FEE_LABEL,
  DELIVERY_FEE_MODE_HELPERS,
  DELIVERY_FEE_MODE_LABEL,
  DELIVERY_FEE_MODE_LABELS,
  DELIVERY_SECTION_LABEL,
  EXPIRY_SECTION_LABEL,
  ORDER_EXPIRY_HOURS_HELP,
  ORDER_EXPIRY_HOURS_LABEL,
  ORDER_EXPIRY_HOURS_NOTE,
  PURCHASE_CONFIG_CARD_SUBTITLE,
  PURCHASE_CONFIG_CARD_TITLE,
  PURCHASE_CONFIG_ISSUE_MESSAGES,
  purchaseConfigSummaryTitle,
} from "./purchaseConfigCopy";

export interface PurchaseConfigCardProps {
  draft: ITiendaOnlineDraft;
  /** `collectPurchaseConfigIssues(draft)`. The card never decides validity. */
  issues: IQabPurchaseConfigIssue[];
  isMobile: boolean;
  /**
   * Bumped by the page every time the guard inside `persist` stopped a save.
   * Turns every infraction red, draws the summary, scrolls here and focuses the
   * first culprit. `0` means «nobody has tried to save yet».
   */
  rejectedSaveNonce: number;
  onChange: (patch: Partial<ITiendaOnlineDraft>) => void;
}

/** The numeric fields that can carry an infraction, and therefore a focus jump. */
type PurchaseConfigField = IQabPurchaseConfigIssue["field"];

/** The contradiction is the one infraction nobody typed: it opens in `caution`. */
const PENDING_CODE = "DELIVERY_CONFIG_INCONSISTENT";

/** Where the hours field stops growing. A four-digit field is not a headline. */
const EXPIRY_FIELD_MAX_WIDTH = 220;

/**
 * «Cómo se compra en este local»: the five columns of contract v7, the three
 * sections they fall into, and the rejection the merchant sees BEFORE any
 * request exists.
 *
 * It is a card of this feature and not an extension of `PublicDataCard`: there,
 * clearing a field DELETES the column on the other side; here, a key that does
 * not travel leaves it untouched. Two opposite saving semantics do not belong in
 * one component.
 */
export function PurchaseConfigCard({
  draft,
  issues,
  isMobile,
  rejectedSaveNonce,
  onChange,
}: Readonly<PurchaseConfigCardProps>) {
  const cardRef = useRef<HTMLDivElement | null>(null);
  const fieldRefs = useRef(new Map<PurchaseConfigField, HTMLInputElement>());
  const switchRef = useRef<HTMLInputElement | null>(null);
  const [touched, setTouched] = useState<PurchaseConfigField[]>([]);
  // Sticky: once somebody pressed «Guardar cambios» there is nothing left to
  // protect them from, and every infraction is theirs to see.
  const [attempted, setAttempted] = useState(false);

  const showFeeField =
    draft.deliveryEnabled &&
    draft.deliveryFeeMode === QAB_DELIVERY_FEE_MODE_FLAT_RATE;

  const focusField = useCallback((field: PurchaseConfigField) => {
    cardRef.current?.scrollIntoView({ block: "start" });
    // The culprit may be hidden — an amount typed before the delivery switch was
    // turned off still counts. Then the switch is the control that brings it
    // back, so that is where the jump lands instead of nowhere.
    const target = fieldRefs.current.get(field) ?? switchRef.current;
    window.requestAnimationFrame(() => target?.focus());
  }, []);

  useEffect(() => {
    if (rejectedSaveNonce === 0) return;
    setAttempted(true);
    if (issues.length > 0) focusField(issues[0].field);
    // Deliberately keyed on the nonce alone: this runs once per rejected save,
    // not every time the issue list changes while the merchant types.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rejectedSaveNonce]);

  const registerField =
    (field: PurchaseConfigField) => (node: HTMLInputElement | null) => {
      if (node === null) fieldRefs.current.delete(field);
      else fieldRefs.current.set(field, node);
    };

  const markTouched = (field: PurchaseConfigField) => {
    setTouched((current) =>
      current.includes(field) ? current : [...current, field],
    );
  };

  const issueOf = (field: PurchaseConfigField) =>
    issues.find((issue) => issue.field === field) ?? null;

  /**
   * What one field shows under itself, and in which ink.
   *
   * Nothing is tinted while somebody types: `12.` and `` are legitimate states
   * of a half-written word. What a merchant typed shows on blur; the
   * contradiction, which can be reached in two taps without touching the amount,
   * shows at once but in `caution` — «falta esto», not «esto está mal» — and
   * only turns red once they actually tried to save.
   */
  const fieldState = (field: PurchaseConfigField, fallback: string) => {
    const issue = issueOf(field);
    if (issue === null) return { text: fallback, error: false, caution: false };

    const pending = issue.code === PENDING_CODE;
    const visible = pending || attempted || touched.includes(field);
    if (!visible) return { text: fallback, error: false, caution: false };

    const error = attempted || (!pending && touched.includes(field));
    return {
      text: PURCHASE_CONFIG_ISSUE_MESSAGES[issue.code],
      error,
      caution: !error,
    };
  };

  const cautionHelperProps = (caution: boolean) =>
    caution
      ? { formHelperText: { sx: { color: "semantic.hue.caution.main" } } }
      : undefined;

  const feeState = fieldState("deliveryFee", DELIVERY_FEE_HELP);
  const hoursState = fieldState("orderExpiryHours", ORDER_EXPIRY_HOURS_HELP);
  const showSummary = attempted && issues.length > 0;

  const checkoutOptionSx = (value: IQabCheckoutMode) => ({
    minHeight: touch.rowLarge,
    height: "100%",
    borderRadius: `${shape.radius.md}px`,
    border: "1px solid",
    borderColor:
      draft.checkoutMode === value
        ? "semantic.hue.accent.main"
        : "semantic.surface.border",
    bgcolor:
      draft.checkoutMode === value ? "semantic.hue.accent.surface" : "transparent",
    px: 1.5,
    py: 1,
    m: 0,
    width: "100%",
    alignItems: "flex-start",
  });

  return (
    <Box ref={cardRef}>
      <ContentCard
        title={PURCHASE_CONFIG_CARD_TITLE}
        subtitle={PURCHASE_CONFIG_CARD_SUBTITLE}
        spaceButton
      >
        <Stack spacing={2}>
          {showSummary && (
            // At 320 px this card is about 700 px tall and the save bar is glued
            // to the bottom edge: pressing «Guardar cambios» with the culprit off
            // screen and seeing nothing is exactly how somebody gets stuck.
            <Box
              sx={{
                p: 1.5,
                borderRadius: `${shape.radius.md}px`,
                bgcolor: "semantic.hue.negative.surface",
                color: "semantic.hue.negative.main",
              }}
            >
              <Typography variant="body2" sx={{ fontWeight: 700 }}>
                {purchaseConfigSummaryTitle(issues.length)}
              </Typography>
              <Stack sx={{ mt: 0.5 }}>
                {issues.map((issue) => (
                  <Button
                    key={issue.code}
                    variant="text"
                    color="inherit"
                    onClick={() => focusField(issue.field)}
                    sx={{
                      minHeight: touch.min,
                      justifyContent: "flex-start",
                      textAlign: "left",
                      px: 0,
                      textTransform: "none",
                    }}
                  >
                    {PURCHASE_CONFIG_ISSUE_MESSAGES[issue.code]}
                  </Button>
                ))}
              </Stack>
            </Box>
          )}

          <Box>
            <SectionLabel>{CHECKOUT_SECTION_LABEL}</SectionLabel>
            {/* Two cards and not a select: the difference between them is a
                button that appears or does not appear, and choosing wrong is
                noticed weeks later — the two consequences have to be readable at
                the same time. */}
            <RadioGroup
              value={draft.checkoutMode}
              onChange={(event) =>
                onChange({ checkoutMode: event.target.value as IQabCheckoutMode })
              }
            >
              <Stack
                direction={isMobile ? "column" : "row"}
                alignItems="stretch"
                spacing={1.5}
              >
                {QAB_CHECKOUT_MODES.map((mode) => (
                  <Box key={mode} sx={{ flex: 1, minWidth: 0 }}>
                    <FormControlLabel
                      value={mode}
                      control={<Radio />}
                      sx={checkoutOptionSx(mode)}
                      label={
                        <Box>
                          <Typography variant="body1" sx={{ fontWeight: 600 }}>
                            {CHECKOUT_MODE_LABELS[mode]}
                          </Typography>
                          <Typography
                            variant="body2"
                            sx={{ color: "semantic.text.secondary" }}
                          >
                            {CHECKOUT_MODE_DESCRIPTIONS[mode]}
                          </Typography>
                        </Box>
                      }
                    />
                  </Box>
                ))}
              </Stack>
            </RadioGroup>
          </Box>

          <Box>
            <SectionLabel>{DELIVERY_SECTION_LABEL}</SectionLabel>
            {/* The whole row is the target, not just the switch. This one IS
                optimistic inside the draft: it fires no request, unlike the
                publish switch of the first card. */}
            <FormControlLabel
              labelPlacement="start"
              control={
                <Switch
                  inputRef={switchRef}
                  checked={draft.deliveryEnabled}
                  onChange={(event) =>
                    onChange({ deliveryEnabled: event.target.checked })
                  }
                />
              }
              label={
                <Typography variant="body1">{DELIVERY_ENABLED_LABEL}</Typography>
              }
              sx={{
                minHeight: touch.row,
                width: "100%",
                m: 0,
                justifyContent: "space-between",
              }}
            />

            {!draft.deliveryEnabled && (
              <Box>
                <Typography
                  variant="body2"
                  sx={{ color: "semantic.text.secondary" }}
                >
                  {DELIVERY_DISABLED_HELP}
                </Typography>
                {draft.deliveryFee.trim().length > 0 && (
                  // Not a consolation: it is true by construction, because
                  // `draftToUpdate` always sends the amount and the mode, painted
                  // or not (ADR ADRIAN-0152).
                  <Typography
                    variant="caption"
                    sx={{ display: "block", color: "semantic.text.secondary" }}
                  >
                    {DELIVERY_FEE_KEPT_NOTE}
                  </Typography>
                )}
              </Box>
            )}

            {draft.deliveryEnabled && (
              // The question and its answer share a row from `sm`: apart, they
              // invite changing the mode and forgetting the amount, which is the
              // very contradiction this feature exists to prevent.
              <Stack
                direction={isMobile ? "column" : "row"}
                spacing={2}
                sx={{ mt: 1 }}
              >
                <TextField
                  select
                  fullWidth
                  label={DELIVERY_FEE_MODE_LABEL}
                  value={draft.deliveryFeeMode}
                  onChange={(event) =>
                    onChange({
                      deliveryFeeMode: event.target.value as IQabDeliveryFeeMode,
                    })
                  }
                  helperText={DELIVERY_FEE_MODE_HELPERS[draft.deliveryFeeMode]}
                  sx={{ flex: 1 }}
                >
                  {QAB_DELIVERY_FEE_MODES.map((mode) => (
                    <MenuItem key={mode} value={mode}>
                      {DELIVERY_FEE_MODE_LABELS[mode]}
                    </MenuItem>
                  ))}
                </TextField>

                {showFeeField && (
                  <TextField
                    fullWidth
                    label={DELIVERY_FEE_LABEL}
                    value={draft.deliveryFee}
                    // No autocorrection of any kind: `12.345` stays `12.345` and
                    // raises its infraction. A field that silently fixes what
                    // somebody typed makes them save an amount they never wrote.
                    onChange={(event) =>
                      onChange({ deliveryFee: event.target.value })
                    }
                    onBlur={() => markTouched("deliveryFee")}
                    inputRef={registerField("deliveryFee")}
                    error={feeState.error}
                    helperText={feeState.text}
                    slotProps={{
                      htmlInput: { inputMode: "decimal" },
                      ...cautionHelperProps(feeState.caution),
                    }}
                    sx={{ flex: 1 }}
                  />
                )}
              </Stack>
            )}
          </Box>

          <Box>
            <SectionLabel>{EXPIRY_SECTION_LABEL}</SectionLabel>
            <TextField
              fullWidth
              label={ORDER_EXPIRY_HOURS_LABEL}
              value={draft.orderExpiryHours}
              onChange={(event) =>
                onChange({ orderExpiryHours: event.target.value })
              }
              onBlur={() => markTouched("orderExpiryHours")}
              inputRef={registerField("orderExpiryHours")}
              error={hoursState.error}
              helperText={hoursState.text}
              slotProps={{
                htmlInput: {
                  inputMode: "numeric",
                  min: QAB_ORDER_EXPIRY_HOURS_MIN,
                  max: QAB_ORDER_EXPIRY_HOURS_MAX,
                },
                ...cautionHelperProps(hoursState.caution),
              }}
              sx={{ maxWidth: isMobile ? "100%" : EXPIRY_FIELD_MAX_WIDTH }}
            />
            {/* Without this, «24 horas» reads as a promise that the order is
                closed in 24 hours. It is not: the two windows add up. */}
            <Typography
              variant="caption"
              sx={{ display: "block", mt: 1, color: "semantic.text.secondary" }}
            >
              {ORDER_EXPIRY_HOURS_NOTE}
            </Typography>
          </Box>
        </Stack>
      </ContentCard>
    </Box>
  );
}

export default PurchaseConfigCard;
