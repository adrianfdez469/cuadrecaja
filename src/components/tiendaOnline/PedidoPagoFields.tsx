"use client";

import { useRef, useState } from "react";
import type { KeyboardEvent } from "react";
import {
  Box,
  FormControl,
  InputLabel,
  MenuItem,
  Select,
  Typography,
} from "@mui/material";
import CreditCardOutlinedIcon from "@mui/icons-material/CreditCardOutlined";
import PaymentsOutlinedIcon from "@mui/icons-material/PaymentsOutlined";
import RadioButtonCheckedIcon from "@mui/icons-material/RadioButtonChecked";
import RadioButtonUncheckedIcon from "@mui/icons-material/RadioButtonUnchecked";

import {
  TIENDA_ONLINE_ORDER_COPY,
  TIENDA_ONLINE_PAYMENT_METHOD_LABELS,
} from "@/components/tiendaOnline/orderPresentation";
import { TIENDA_ONLINE_PAYMENT_METHODS } from "@/constants/tiendaOnline";
import type { ITiendaOnlineTransferDestination } from "@/schemas/tiendaOnline";
import { shape, touch } from "@/theme/tokens";

/** The two methods, in the order they are read. */
export type IPedidoPagoMetodo = (typeof TIENDA_ONLINE_PAYMENT_METHODS)[number];

/** The method that needs a destination, typed against the constant. */
const TRANSFER_METHOD = "TRANSFERENCIA" satisfies IPedidoPagoMetodo;

/** Below this many destinations there is no choice to make, so no control. */
const MIN_DESTINATIONS_TO_CHOOSE = 2;

const METHOD_ICON = {
  EFECTIVO: PaymentsOutlinedIcon,
  TRANSFERENCIA: CreditCardOutlinedIcon,
} as const satisfies Record<IPedidoPagoMetodo, unknown>;

export interface PedidoPagoFieldsProps {
  destinations: readonly ITiendaOnlineTransferDestination[];
  /** `null` until somebody chooses: NO method comes preselected (ADR 0073). */
  metodo: IPedidoPagoMetodo | null;
  /** The chosen destination, or `null` when there is none to choose. */
  transferDestinationId: string | null;
  onMetodoChange: (metodo: IPedidoPagoMetodo) => void;
  onDestinationChange: (transferDestinationId: string) => void;
}

/**
 * The declaration of how an online order was collected: one method for the whole
 * amount, and — only for a transfer — which destination it went into.
 *
 * NEITHER METHOD IS PRESELECTED, and that is the part of this screen easiest to
 * get wrong. Preselecting `Efectivo` would make the confirm button usable from
 * the first frame and save a tap in the commonest case; ADR 0073 rejected a
 * documented default outright, because «a missing datum is fixable; a false one
 * is already in the books», and a radio somebody confirms without looking
 * produces exactly that false datum with a witness attached.
 *
 * The rule of the destination is the POS's, unchanged: with 0 or 1 destination
 * the `Select` is not painted at all — with one there is no decision to take,
 * and a dropdown with a single option asks a question that cannot be answered
 * two ways. Where this DOES depart from the POS is with ZERO destinations: the
 * POS still lets you sell by transfer, and here `pedidoEntrantePagoSchema`
 * requires a destination, so the row goes disabled with its reason beside it.
 */
export function PedidoPagoFields({
  destinations,
  metodo,
  transferDestinationId,
  onMetodoChange,
  onDestinationChange,
}: Readonly<PedidoPagoFieldsProps>) {
  const hasDestinations = destinations.length > 0;
  const showDestinationSelect =
    metodo === TRANSFER_METHOD &&
    destinations.length >= MIN_DESTINATIONS_TO_CHOOSE;

  const isDisabled = (option: IPedidoPagoMetodo) =>
    option === TRANSFER_METHOD && !hasDestinations;

  const isEnabledIndex = (index: number) => {
    const option = TIENDA_ONLINE_PAYMENT_METHODS[index];
    return option !== undefined && !isDisabled(option);
  };

  const firstEnabledIndex = TIENDA_ONLINE_PAYMENT_METHODS.findIndex(
    (option) => !isDisabled(option),
  );

  // The roving position: where the ONE tab stop of the group sits while nothing
  // has been chosen yet. `metodo` takes over as soon as there is a choice, so
  // the two can never disagree about which row is the active one.
  const [roving, setRoving] = useState(firstEnabledIndex);
  const rowRefs = useRef<(HTMLDivElement | null)[]>([]);

  const chosenIndex =
    metodo === null ? -1 : TIENDA_ONLINE_PAYMENT_METHODS.indexOf(metodo);
  const rawActiveIndex = chosenIndex >= 0 ? chosenIndex : roving;
  // Clamped to a row that can actually take the focus: the destinations can go
  // away with the dialog open, and a tab stop on a disabled row is a dead end.
  const activeIndex = isEnabledIndex(rawActiveIndex)
    ? rawActiveIndex
    : firstEnabledIndex;

  /** The next row that can be chosen, skipping the disabled one. */
  const nextEnabledIndex = (from: number, delta: number) => {
    const total = TIENDA_ONLINE_PAYMENT_METHODS.length;
    for (let step = 1; step <= total; step += 1) {
      const candidate = (from + delta * step + total * total) % total;
      if (isEnabledIndex(candidate)) return candidate;
    }
    return from;
  };

  /**
   * Chooses one row. `moveFocus` carries the focus WITH the selection: an
   * `aria-checked` that walks away from `document.activeElement` means the next
   * Space lands on the row left behind and silently undoes the choice.
   */
  const choose = (index: number, moveFocus: boolean) => {
    const option = TIENDA_ONLINE_PAYMENT_METHODS[index];
    if (option === undefined || isDisabled(option)) return;
    setRoving(index);
    if (moveFocus) rowRefs.current[index]?.focus();
    onMetodoChange(option);
  };

  const move = (delta: number) => {
    const next = nextEnabledIndex(activeIndex, delta);
    // Nowhere else to go — the only other row is disabled. Nothing moves and
    // nothing is chosen: an arrow key that lands back on itself is not a choice.
    if (next === activeIndex) return;
    choose(next, true);
  };

  const handleKeyDown = (
    event: KeyboardEvent<HTMLDivElement>,
    index: number,
  ) => {
    if (event.key === " " || event.key === "Enter") {
      event.preventDefault();
      choose(index, false);
      return;
    }
    if (event.key === "ArrowDown" || event.key === "ArrowRight") {
      event.preventDefault();
      move(1);
      return;
    }
    if (event.key === "ArrowUp" || event.key === "ArrowLeft") {
      event.preventDefault();
      move(-1);
    }
  };

  return (
    <Box>
      <Typography
        variant="subtitle2"
        sx={{ color: "semantic.text.primary", mb: 1 }}
      >
        {TIENDA_ONLINE_ORDER_COPY.pagoPregunta}
      </Typography>

      <Box
        role="radiogroup"
        aria-label={TIENDA_ONLINE_ORDER_COPY.pagoGrupo}
        sx={{ display: "flex", flexDirection: "column", gap: 1 }}
      >
        {TIENDA_ONLINE_PAYMENT_METHODS.map((option, index) => {
          const selected = metodo === option;
          const disabled = isDisabled(option);
          const Icon = METHOD_ICON[option];
          const RadioIcon = selected
            ? RadioButtonCheckedIcon
            : RadioButtonUncheckedIcon;

          return (
            <Box
              key={option}
              ref={(node: HTMLDivElement | null) => {
                rowRefs.current[index] = node;
              }}
              role="radio"
              aria-checked={selected}
              aria-disabled={disabled || undefined}
              // EXACTLY ONE tab stop for the whole group: `Tab` reaches the
              // choice once and leaves, and the arrows walk inside it. Two rows
              // at `0` would make the group two independent stops.
              tabIndex={index === activeIndex ? 0 : -1}
              onClick={disabled ? undefined : () => choose(index, true)}
              onKeyDown={
                disabled ? undefined : (event) => handleKeyDown(event, index)
              }
              sx={{
                display: "flex",
                alignItems: "center",
                gap: 1.25,
                px: 1.5,
                minHeight: touch.row,
                width: "100%",
                boxSizing: "border-box",
                borderRadius: `${shape.radius.md}px`,
                border: 1,
                borderColor: selected
                  ? "semantic.hue.accent.main"
                  : "semantic.surface.border",
                bgcolor: selected
                  ? "semantic.hue.accent.surface"
                  : "semantic.surface.raised",
                cursor: disabled ? "default" : "pointer",
                opacity: disabled ? 0.6 : 1,
              }}
            >
              <RadioIcon
                fontSize="small"
                sx={{
                  color: disabled
                    ? "semantic.text.disabled"
                    : selected
                      ? "semantic.hue.accent.main"
                      : "semantic.text.secondary",
                }}
              />
              <Icon
                fontSize="small"
                sx={{
                  color: disabled
                    ? "semantic.text.disabled"
                    : selected
                      ? "semantic.hue.accent.main"
                      : "semantic.text.secondary",
                }}
              />
              <Typography
                component="span"
                sx={{
                  fontSize: "0.9375rem",
                  fontWeight: 600,
                  color: disabled
                    ? "semantic.text.disabled"
                    : "semantic.text.primary",
                }}
              >
                {TIENDA_ONLINE_PAYMENT_METHOD_LABELS[option]}
              </Typography>
            </Box>
          );
        })}
      </Box>

      {!hasDestinations && (
        <Typography
          variant="body2"
          sx={{ mt: 1, color: "semantic.text.secondary" }}
        >
          {TIENDA_ONLINE_ORDER_COPY.pagoSinDestinos}
        </Typography>
      )}

      {showDestinationSelect && (
        <FormControl
          fullWidth
          size="small"
          sx={{
            mt: 1.5,
            "& .MuiOutlinedInput-root": { minHeight: touch.min },
          }}
        >
          <InputLabel id="pedido-pago-destino-label">
            {TIENDA_ONLINE_ORDER_COPY.pagoDestinoLabel}
          </InputLabel>
          <Select
            labelId="pedido-pago-destino-label"
            label={TIENDA_ONLINE_ORDER_COPY.pagoDestinoLabel}
            value={transferDestinationId ?? ""}
            onChange={(event) => onDestinationChange(event.target.value)}
          >
            {destinations.map((destination) => (
              <MenuItem key={destination.id} value={destination.id}>
                {destination.nombre}
              </MenuItem>
            ))}
          </Select>
        </FormControl>
      )}
    </Box>
  );
}

export default PedidoPagoFields;
