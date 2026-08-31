import { Box, Stack, Typography } from "@mui/material";
import type { ReactNode } from "react";

interface Row {
  label: string;
  value: ReactNode;
  valueColor?: string;
}

interface Props {
  title: string;
  subtitle?: string;
  headerRight?: ReactNode;
  rows: Row[];
}

/** One product, as a card — the mobile layout `rediseno/cpp-analysis-movil.html` gives the CPP tables instead of a cropped desktop table. */
export function CppProductCard({ title, subtitle, headerRight, rows }: Props) {
  return (
    <Box
      sx={{
        bgcolor: "background.paper",
        border: 1,
        borderColor: "divider",
        borderRadius: 3,
        p: 2,
      }}
    >
      <Stack
        direction="row"
        alignItems="flex-start"
        justifyContent="space-between"
        gap={1.5}
      >
        <Box sx={{ minWidth: 0 }}>
          <Typography
            variant="subtitle1"
            fontWeight={700}
            sx={{ lineHeight: 1.35 }}
          >
            {title}
          </Typography>
          {subtitle && (
            <Typography
              variant="body2"
              color="text.secondary"
              sx={{ mt: 0.375, fontVariantNumeric: "tabular-nums" }}
            >
              {subtitle}
            </Typography>
          )}
        </Box>
        {headerRight && <Box sx={{ flexShrink: 0 }}>{headerRight}</Box>}
      </Stack>

      {rows.length > 0 && (
        <Stack
          spacing={0.75}
          sx={{ mt: 1.5, pt: 1.5, borderTop: 1, borderColor: "divider" }}
        >
          {rows.map((row) => (
            <Box
              key={row.label}
              sx={{
                display: "flex",
                alignItems: "baseline",
                justifyContent: "space-between",
                gap: 1.5,
              }}
            >
              <Typography variant="body2" color="text.secondary">
                {row.label}
              </Typography>
              {typeof row.value === "string" ||
              typeof row.value === "number" ? (
                <Typography
                  variant="body2"
                  sx={{
                    fontVariantNumeric: "tabular-nums",
                    color: row.valueColor ?? "text.primary",
                  }}
                >
                  {row.value}
                </Typography>
              ) : (
                // A ready-made node (a Chip, an icon+amount) brings its own
                // element — wrapping it in `<Typography>` (a `<p>`) breaks
                // when the node renders a `<div>`, e.g. MUI's `Chip`.
                <Box
                  sx={{
                    fontVariantNumeric: "tabular-nums",
                    color: row.valueColor ?? "text.primary",
                  }}
                >
                  {row.value}
                </Box>
              )}
            </Box>
          ))}
        </Stack>
      )}
    </Box>
  );
}
