"use client";

import { Box, Card, CardContent, Stack, Typography } from "@mui/material";
import RequestQuoteOutlinedIcon from "@mui/icons-material/RequestQuoteOutlined";
import { shape } from "@/theme";
import { formatCurrency } from "@/utils/formatters";
import type { ICreditFlow } from "@/schemas/cierre";
import { CREDIT_TEST_IDS } from "@/app/cierre/utils/creditoCierre";
import { CREDIT_COPY } from "@/app/cierre/utils/creditoCierreCopy";

interface Props {
  /** The period's two credit figures, base currency. */
  flow: ICreditFlow;
  isMobile?: boolean;
}

/**
 * The period's credit, on the same row as the profit and the tips cards.
 *
 * It EXPLAINS the drawer, it does not correct it (ADR 0122): neither figure is
 * a deduction, neither is subtracted from anything on this screen, and the
 * cash discrepancy of `MonedaBreakdownRow` is computed exactly as it was
 * before this card existed.
 *
 * It does not decide whether to render: the page does, with
 * `hasCreditToExplain`, the same way it gates `PropinasCard` (criterion 5).
 */
export default function CreditoCard({
  flow,
  isMobile = false,
}: Readonly<Props>) {
  const figures = [
    { key: "granted", label: CREDIT_COPY.cardGrantedLabel, value: flow.granted },
    {
      key: "collected",
      label: CREDIT_COPY.cardCollectedLabel,
      value: flow.collected,
    },
  ];

  return (
    <Card sx={{ height: "100%" }} data-testid={CREDIT_TEST_IDS.card}>
      <CardContent sx={{ p: isMobile ? 2 : 3 }}>
        <Stack direction="row" alignItems="center" spacing={isMobile ? 1 : 2}>
          {/* Debt is `caution`, never `negative`: owing money is the business
              model, not a failure. Same pair the checkout of F-032 uses for
              its "A crédito" block, so both screens read as the same thing. */}
          <Box
            sx={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              minWidth: isMobile ? 40 : 48,
              minHeight: isMobile ? 40 : 48,
              borderRadius: `${shape.radius.sm}px`,
              bgcolor: "semantic.hue.caution.surface",
              color: "semantic.hue.caution.main",
            }}
          >
            <RequestQuoteOutlinedIcon fontSize="medium" />
          </Box>
          <Typography
            sx={{
              flex: 1,
              minWidth: 0,
              fontSize: "0.8125rem",
              fontWeight: 600,
              letterSpacing: "0.06em",
              textTransform: "uppercase",
              color: "semantic.text.secondary",
            }}
          >
            {CREDIT_COPY.cardTitle}
          </Typography>
        </Stack>

        {/* Granted before collected, in the DOM and on screen: the order of
            the reconciliation equation, and the order the notice, the
            recalculation and the history all repeat. */}
        <Box
          sx={{
            mt: 2,
            display: "grid",
            gridTemplateColumns: { xs: "1fr", sm: "1fr 1fr" },
            gap: 2,
          }}
        >
          {figures.map((figure) => (
            <Box key={figure.key} sx={{ minWidth: 0 }}>
              <Typography variant="caption" color="text.secondary">
                {figure.label}
              </Typography>
              {/* Plain ink, no verdict: this screen explains credit, it does
                  not judge it (ADR 0122), and `collected` can be negative
                  after a reversal (ADR 0121) — a green minus is worse than
                  neutral ink. */}
              <Typography
                sx={{
                  minWidth: 0,
                  fontSize: isMobile ? "1.25rem" : "1.5rem",
                  fontWeight: 700,
                  lineHeight: 1.2,
                  wordBreak: "break-all",
                  fontVariantNumeric: "tabular-nums",
                  color: "semantic.money.neutral.main",
                }}
              >
                {formatCurrency(figure.value)}
              </Typography>
            </Box>
          ))}
        </Box>

        <Typography
          variant="caption"
          color="text.secondary"
          display="block"
          sx={{ mt: 1.5 }}
        >
          {CREDIT_COPY.cardHint}
        </Typography>
      </CardContent>
    </Card>
  );
}
