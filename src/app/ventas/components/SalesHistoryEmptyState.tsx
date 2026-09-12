import React from "react";
import { Box, Button, Stack, Typography, alpha } from "@mui/material";
import { ReceiptLong } from "@mui/icons-material";
import type { ISaleHistoryEmptyReason } from "@/constants/venta";

/**
 * What the sales history prints for one empty reason.
 *
 * A single interface and not a discriminated union: with `strict: false` a
 * boolean discriminant does not narrow, so a union here would only buy
 * TS2339s (E-036).
 */
interface SalesHistoryEmptyCopy {
  title: string;
  body: string;
  /** Printed under the body when present. Only the empty period has them. */
  bullets?: readonly string[];
  /** Whether this state offers the caller's way out of the filter. */
  showClearFilter: boolean;
}

/**
 * Every reason maps to its OWN wording, and the map is exhaustive by type.
 *
 * `Record<ISaleHistoryEmptyReason, …>` and never a switch with a default: a
 * fifth value of the vocabulary has to break the build right here, where its
 * sentence is missing, instead of quietly painting one of the other four
 * (E-035).
 *
 * The first two entries are the wording this screen already showed, kept to
 * the byte: this feature adds two states, it does not reword the two that
 * were there.
 */
const EMPTY_STATE_COPY: Record<ISaleHistoryEmptyReason, SalesHistoryEmptyCopy> =
  {
    NO_SALES_IN_PERIOD: {
      title: "No hay ventas registradas en este período",
      body: "Las ventas aparecerán aquí cuando:",
      bullets: [
        "• Se realicen ventas desde el POS",
        "• Se procesen transacciones",
        "• Se registren pagos de clientes",
      ],
      showClearFilter: false,
    },
    NO_SALES_FOR_SEARCH: {
      title: "No se encontraron ventas",
      body: "Intenta con otros términos de búsqueda",
      showClearFilter: false,
    },
    NO_SALES_WITH_SYNC_TRACE: {
      // It does NOT explain the absence away: a sale that reached the server on
      // its second try from the queue is stored as an ordinary one, so "all of
      // them went through at the first attempt" would be false. It says the one
      // thing that is true and that the reader needs — nothing was lost.
      title: "Ninguna venta de este período tiene rastro de sincronización",
      body: "El historial completo del período sigue ahí.",
      showClearFilter: true,
    },
    NO_TRACED_SALES_FOR_SEARCH: {
      title: "Ninguna venta con rastro coincide con tu búsqueda",
      body: "Este período sí tiene ventas con rastro. Prueba con otro término, o quita el filtro para buscar en todas.",
      showClearFilter: true,
    },
  };

interface SalesHistoryEmptyStateProps {
  /** Which of the four empty states to paint. */
  reason: ISaleHistoryEmptyReason;
  /** The way out of the filter. Only two of the four reasons offer it. */
  onClearFilter?: () => void;
}

/**
 * The block the sales history paints in place of its rows.
 *
 * The icon is the SAME in the four states on purpose: it is the identity of the
 * region — "the list of sales goes here" — and not a status. What tells the
 * four apart is the sentence.
 */
const SalesHistoryEmptyState: React.FC<SalesHistoryEmptyStateProps> = ({
  reason,
  onClearFilter,
}) => {
  const copy = EMPTY_STATE_COPY[reason];

  return (
    <Box
      sx={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        py: 6,
        px: 2,
      }}
    >
      {/* Icon with wash background */}
      <Box
        sx={{
          bgcolor: (theme) => alpha(theme.palette.info.main, 0.1),
          borderRadius: "50%",
          p: 2,
          mb: 2,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          width: 64,
          height: 64,
        }}
      >
        <ReceiptLong
          sx={{
            fontSize: 48,
            color: "info.main",
          }}
        />
      </Box>

      {/* Main heading */}
      <Typography
        variant="body1"
        sx={{
          fontSize: "17px",
          fontWeight: 700,
          mb: 1,
          textAlign: "center",
        }}
      >
        {copy.title}
      </Typography>

      {/* Subheading */}
      <Typography
        variant="body2"
        color="text.secondary"
        sx={{
          fontSize: "14px",
          mb: copy.bullets ? 2 : 0,
          textAlign: "center",
        }}
      >
        {copy.body}
      </Typography>

      {/* Bullet points */}
      {copy.bullets && (
        <Stack spacing={0.5} sx={{ mt: 1 }}>
          {copy.bullets.map((bullet) => (
            <Typography
              key={bullet}
              variant="body2"
              color="text.secondary"
              sx={{ fontSize: "13px" }}
            >
              {bullet}
            </Typography>
          ))}
        </Stack>
      )}

      {copy.showClearFilter && onClearFilter && (
        <Button
          variant="outlined"
          color="primary"
          onClick={onClearFilter}
          sx={{ mt: 3 }}
        >
          Quitar el filtro
        </Button>
      )}
    </Box>
  );
};

export default SalesHistoryEmptyState;
