"use client";

import { ReactNode } from "react";
import {
  Box,
  Card,
  CardContent,
  Skeleton,
  Stack,
  Typography,
  useMediaQuery,
  useTheme,
} from "@mui/material";
import { TrendingDown, TrendingFlat, TrendingUp } from "@mui/icons-material";

import { ColorRole } from "@/theme/tokens";

/**
 * Which semantic hue the tile carries. A closed set on purpose.
 *
 * The previous version took a free-form `color` string, and that permissiveness
 * is why consolidating it failed the first time: a component that accepts any
 * colour, any icon and any alignment is always slower to negotiate with than to
 * copy and tweak. Twelve files copied it. If a new tile needs a hue that is not
 * here, that is a question about the design system, not about this file.
 */
export type StatTone =
  "positive" | "negative" | "caution" | "info" | "neutral" | "accent";

/**
 * The three shapes the app actually needs, recovered from the thirteen copies
 * that existed before:
 *
 * - `tile`    — filled colour chip beside a large value. Eleven of the twelve
 *               local copies were this, byte-for-byte apart from padding.
 * - `compact` — small inline icon, label above value. Dense rows (inventory).
 * - `metric`  — centred, optional period-over-period delta. Reports.
 */
export type StatVariant = "tile" | "compact" | "metric";

export type StatCardProps = {
  label: string;
  value: ReactNode;
  /** Extra context under the label. Ignored by `compact`, which has no room. */
  subtitle?: string;
  icon?: ReactNode;
  /**
   * Omit it and the card stays neutral. `metric` reads this as emphasis on the
   * value itself, since those cards carry no icon to colour — that is how the
   * report cards used to signal a loss without one.
   */
  tone?: StatTone;
  variant?: StatVariant;
  /** Period-over-period change, as a percentage. `metric` only. */
  delta?: { value: number; label?: string };
  loading?: boolean;
};

/** Direction colouring is semantic, so a drop in expenses can still read positive. */
function deltaTone(value: number): StatTone {
  if (value > 0) return "positive";
  if (value < 0) return "negative";
  return "neutral";
}

function DeltaIcon({ value }: { value: number }) {
  if (value > 0) return <TrendingUp fontSize="inherit" />;
  if (value < 0) return <TrendingDown fontSize="inherit" />;
  return <TrendingFlat fontSize="inherit" />;
}

/**
 * The stat tile for the whole app.
 *
 * This replaces thirteen components that all went by the name `StatCard`: one
 * shared and twelve defined inline. The shared one's own docblock claimed to
 * have already done this consolidation — it had not, because nothing stopped
 * the next screen from writing its own.
 */
export function StatCard({
  label,
  value,
  subtitle,
  icon,
  tone,
  variant = "tile",
  delta,
  loading = false,
}: StatCardProps) {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down("sm"));
  // `tile` and `compact` always paint something, so they fall back; `metric`
  // stays neutral unless a tone was asked for.
  const role: ColorRole = theme.palette.semantic.hue[tone ?? "info"];

  if (variant === "compact") {
    return (
      <Card sx={{ flex: 1, minWidth: isMobile ? 140 : 160 }}>
        <CardContent sx={{ p: 1.5, "&:last-child": { pb: 1.5 } }}>
          <Stack direction="row" alignItems="center" gap={1}>
            {icon && (
              <Box sx={{ color: role.main, display: "flex" }}>{icon}</Box>
            )}
            <Box sx={{ minWidth: 0 }}>
              <Typography
                variant="caption"
                color="text.secondary"
                lineHeight={1}
              >
                {label}
              </Typography>
              {loading ? (
                <Skeleton variant="text" width={72} height={26} />
              ) : (
                <Typography
                  variant="h6"
                  fontWeight={700}
                  lineHeight={1.2}
                  sx={{ fontVariantNumeric: "tabular-nums" }}
                >
                  {value}
                </Typography>
              )}
            </Box>
          </Stack>
        </CardContent>
      </Card>
    );
  }

  if (variant === "metric") {
    return (
      <Card sx={{ height: "100%" }}>
        <CardContent sx={{ p: 2 }}>
          <Stack spacing={1} alignItems="center">
            {icon && (
              <Box sx={{ color: role.main, display: "flex" }}>{icon}</Box>
            )}

            <Typography variant="body2" color="text.secondary" align="center">
              {label}
            </Typography>

            {loading ? (
              <Skeleton variant="text" width="60%" height={42} />
            ) : (
              <Typography
                variant="h4"
                fontWeight="bold"
                align="center"
                sx={{
                  wordBreak: "break-word",
                  fontVariantNumeric: "tabular-nums",
                  color: tone ? role.main : "text.primary",
                }}
              >
                {value}
              </Typography>
            )}

            {subtitle && (
              <Typography
                variant="caption"
                color="text.secondary"
                align="center"
              >
                {subtitle}
              </Typography>
            )}

            {delta && !loading && (
              <Stack
                direction="row"
                spacing={0.5}
                alignItems="center"
                sx={{
                  color:
                    theme.palette.semantic.hue[deltaTone(delta.value)].main,
                  fontSize: "0.875rem",
                }}
              >
                <DeltaIcon value={delta.value} />
                <Typography variant="caption" color="inherit" fontWeight="bold">
                  {delta.value > 0 ? "+" : ""}
                  {delta.value.toFixed(1)}%
                </Typography>
                {delta.label && (
                  <Typography variant="caption" color="text.secondary">
                    {delta.label}
                  </Typography>
                )}
              </Stack>
            )}
          </Stack>
        </CardContent>
      </Card>
    );
  }

  // `tile`
  const chip = isMobile ? 40 : 48;
  return (
    <Card sx={{ height: "100%" }}>
      <CardContent sx={{ p: isMobile ? 1.5 : 3 }}>
        <Stack direction="row" alignItems="center" spacing={isMobile ? 1 : 2}>
          {icon && (
            <Box
              sx={{
                borderRadius: 2,
                bgcolor: role.main,
                color: role.contrast,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                flex: `0 0 ${chip}px`,
                width: chip,
                height: chip,
              }}
            >
              {icon}
            </Box>
          )}
          <Box sx={{ minWidth: 0, flex: 1 }}>
            {loading ? (
              <Skeleton variant="text" width="70%" height={34} />
            ) : (
              <Typography
                variant={isMobile ? "h6" : "h5"}
                fontWeight={700}
                lineHeight={1.2}
                sx={{
                  wordBreak: "break-word",
                  fontVariantNumeric: "tabular-nums",
                }}
              >
                {value}
              </Typography>
            )}
            <Typography variant="body2" color="text.secondary" noWrap>
              {label}
            </Typography>
            {subtitle && (
              <Typography variant="caption" color="text.secondary" noWrap>
                {subtitle}
              </Typography>
            )}
          </Box>
        </Stack>
      </CardContent>
    </Card>
  );
}

export default StatCard;
