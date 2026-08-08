"use client";

import { ReactNode } from "react";
import {
  Card,
  CardContent,
  Skeleton,
  Stack,
  Typography,
  Box,
} from "@mui/material";
import { TrendingDown, TrendingUp, TrendingFlat } from "@mui/icons-material";

export type StatCardProps = {
  title: string;
  value: ReactNode;
  subtitle?: string;
  icon?: ReactNode;
  color?: string;
  /** Period-over-period change, as a percentage. */
  delta?: { value: number; label?: string };
  loading?: boolean;
  /** Centered layout matches the current dashboard; `left` suits dense rows. */
  align?: "center" | "left";
};

/** Direction colouring is semantic, so a drop in expenses can still read green. */
function deltaColor(value: number): string {
  if (value > 0) return "success.main";
  if (value < 0) return "error.main";
  return "text.secondary";
}

function DeltaIcon({ value }: { value: number }) {
  if (value > 0) return <TrendingUp fontSize="inherit" />;
  if (value < 0) return <TrendingDown fontSize="inherit" />;
  return <TrendingFlat fontSize="inherit" />;
}

/**
 * The single stat tile for the whole app. Replaces the three near-identical
 * inline copies that had drifted apart across the dashboard, the closings
 * summary and the inventory stats row.
 */
export function StatCard({
  title,
  value,
  subtitle,
  icon,
  color,
  delta,
  loading = false,
  align = "center",
}: StatCardProps) {
  return (
    <Card sx={{ height: "100%", position: "relative", overflow: "visible" }}>
      <CardContent sx={{ p: 2 }}>
        <Stack
          spacing={1.5}
          alignItems={align === "center" ? "center" : "flex-start"}
        >
          {icon && (
            <Box sx={{ color: color ?? "primary.main", display: "flex" }}>
              {icon}
            </Box>
          )}

          {loading ? (
            <Skeleton variant="text" width="60%" height={42} />
          ) : (
            <Typography
              variant="h4"
              fontWeight="bold"
              color={color ?? "text.primary"}
              align={align === "center" ? "center" : "left"}
              sx={{ wordBreak: "break-word" }}
            >
              {value}
            </Typography>
          )}

          <Typography
            variant="body1"
            color="text.secondary"
            align={align === "center" ? "center" : "left"}
          >
            {title}
          </Typography>

          {subtitle && (
            <Typography
              variant="caption"
              color="text.secondary"
              align={align === "center" ? "center" : "left"}
            >
              {subtitle}
            </Typography>
          )}

          {delta && !loading && (
            <Stack
              direction="row"
              spacing={0.5}
              alignItems="center"
              sx={{ color: deltaColor(delta.value), fontSize: "0.875rem" }}
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
