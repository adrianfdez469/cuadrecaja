"use client";

import type { ReactNode } from "react";
import { Box, Typography } from "@mui/material";
import TrendingUpIcon from "@mui/icons-material/TrendingUp";
import TrendingDownIcon from "@mui/icons-material/TrendingDown";
import { shape } from "@/theme";
import type { PillHue } from "@/components/StatusPill";

export interface Stat {
  label: string;
  value: ReactNode;
  /**
   * Tints the figure. Use it only where the number's sign is the point —
   * money that came in, stock that ran out. A figure with no verdict attached
   * stays ink, which is what makes the tinted ones legible as a verdict.
   */
  tone?: PillHue;
  /**
   * A subordinate line under the figure — typically the same amount in the
   * other currencies. Always quieter than the number it explains: the
   * conversion is a reference, never the amount being charged.
   */
  note?: ReactNode;
  /**
   * Change against the previous period, already in percentage points
   * (-99.7 for −99.7%) — the same units `StatCard.delta` used.
   * Rendered as a small tinted badge with an arrow: green when the figure
   * grew, red when it shrank. Omit it when there is nothing comparable.
   */
  delta?: number;
  /**
   * A trailing control rendered at the cell's far edge — e.g. a chevron
   * that expands a breakdown below the strip. Only meaningful on the
   * `card` variant: it switches that one cell to a row layout with the
   * figure on the left and the action pinned right, instead of the usual
   * label-over-value stack.
   */
  action?: ReactNode;
}

const isLast = (index: number, stats: Stat[]) => index === stats.length - 1;

interface StatStripProps {
  stats: Stat[];
  /**
   * `strip` sits bare on the page ground under the title; `card` boxes the
   * same figures in a bordered panel with the rules running full height.
   * Both shapes are in the redesign — the card is used where the figures are
   * the subject of the screen rather than a preamble to a list.
   */
  variant?: "strip" | "card";
}

/**
 * The counts that head a management screen, as a strip rather than as cards.
 *
 * These were `StatCard`s: a bordered, tinted, icon-bearing box each, three or
 * four across, which gave a page's least interesting numbers its heaviest
 * furniture — and on a phone they were bulky enough to need a show/hide toggle
 * to get out of the way of the actual list. Stripped to a label and a figure
 * they fit on one line, so the toggle stops being necessary and the content
 * below starts higher up the screen.
 *
 * Desktop separates them with hairlines; a phone drops the rules and pairs them
 * two-up, where vertical rules would only crowd the columns.
 */
export function StatStrip({ stats, variant = "strip" }: StatStripProps) {
  const card = variant === "card";

  // A lone figure reads as a sentence, not as a column of one: the redesign
  // sets it on a single baseline ("2 Total Usuarios") rather than leaving a
  // three-up grid with two holes in it.
  if (!card && stats.length === 1) {
    const [only] = stats;
    return (
      <Box
        sx={{
          display: "flex",
          alignItems: "baseline",
          gap: 1.25,
          pb: 2.5,
          mb: 3,
          borderBottom: 1,
          borderColor: "divider",
        }}
      >
        <Typography
          sx={{
            fontSize: "1.625rem",
            fontWeight: 700,
            lineHeight: 1.15,
            letterSpacing: "-0.025em",
            fontVariantNumeric: "tabular-nums",
          }}
        >
          {only.value}
        </Typography>
        <Typography variant="body2" color="text.secondary">
          {only.label}
        </Typography>
      </Box>
    );
  }

  return (
    <Box
      sx={{
        display: "grid",
        gridTemplateColumns: {
          xs: "1fr 1fr",
          md: card ? `repeat(${stats.length}, minmax(0, 1fr))` : "none",
        },
        gap: card ? 0 : { xs: "16px 12px", md: 0 },
        mb: 3,
        ...(card
          ? {
              bgcolor: "background.paper",
              border: 1,
              borderColor: "divider",
              borderRadius: `${shape.radius.md}px`,
              overflow: "hidden",
            }
          : {
              display: { xs: "grid", md: "flex" },
              alignItems: { md: "flex-end" },
              pb: 2.5,
              borderBottom: 1,
              borderColor: "divider",
            }),
      }}
    >
      {stats.map((stat, index) => {
        const content = (
          <>
            <Typography variant="body2" color="text.secondary">
              {stat.label}
            </Typography>
            {typeof stat.value === "string" ||
            typeof stat.value === "number" ? (
              <Typography
                sx={{
                  mt: card ? 0.375 : 0.25,
                  fontSize: card
                    ? { xs: "1.375rem", md: "1.625rem" }
                    : { xs: "1.25rem", md: "1.375rem" },
                  fontWeight: 700,
                  lineHeight: 1.15,
                  letterSpacing: "-0.025em",
                  fontVariantNumeric: "tabular-nums",
                  ...(stat.tone && {
                    color: `semantic.hue.${stat.tone}.main`,
                  }),
                }}
              >
                {stat.value}
              </Typography>
            ) : (
              // A ready-made node (a MultiCurrencyAmount, say) brings its own
              // type scale; wrapping it in ours would fight it.
              <Box sx={{ mt: card ? 0.375 : 0.25 }}>{stat.value}</Box>
            )}
            {stat.note && (
              <Typography
                sx={{
                  mt: 0.5,
                  fontSize: "0.75rem",
                  lineHeight: 1.45,
                  color: "text.secondary",
                  fontVariantNumeric: "tabular-nums",
                }}
              >
                {stat.note}
              </Typography>
            )}
            {typeof stat.delta === "number" && (
              <Box
                sx={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 0.625,
                  height: 22,
                  mt: 1,
                  px: 1,
                  borderRadius: `${shape.radius.pill}px`,
                  fontSize: "0.75rem",
                  fontWeight: 700,
                  fontVariantNumeric: "tabular-nums",
                  bgcolor: `semantic.hue.${stat.delta >= 0 ? "positive" : "negative"}.surface`,
                  color: `semantic.hue.${stat.delta >= 0 ? "positive" : "negative"}.main`,
                }}
              >
                {stat.delta >= 0 ? (
                  <TrendingUpIcon sx={{ fontSize: 13 }} />
                ) : (
                  <TrendingDownIcon sx={{ fontSize: 13 }} />
                )}
                {`${stat.delta >= 0 ? "+" : ""}${stat.delta.toFixed(1)}%`}
              </Box>
            )}
          </>
        );

        return (
          <Box
            key={stat.label}
            sx={
              card
                ? {
                    p: "18px 22px",
                    borderRight: { md: isLast(index, stats) ? 0 : 1 },
                    borderColor: "divider",
                    ...(stat.action && {
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      gap: 1,
                    }),
                  }
                : {
                    // The rule and its gutters belong to every stat but the last.
                    pr: { md: isLast(index, stats) ? 0 : 3.5 },
                    mr: { md: isLast(index, stats) ? 0 : 3.5 },
                    borderRight: { md: isLast(index, stats) ? 0 : 1 },
                    borderColor: "divider",
                  }
            }
          >
            {stat.action ? (
              <>
                <Box sx={{ minWidth: 0 }}>{content}</Box>
                {stat.action}
              </>
            ) : (
              content
            )}
          </Box>
        );
      })}
    </Box>
  );
}
