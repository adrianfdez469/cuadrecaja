"use client";

import { Box, Skeleton, Stack } from "@mui/material";

/**
 * Skeleton placeholders shaped like the content that is coming.
 *
 * The app reaches for `CircularProgress` in 71 files and a skeleton in 3. A
 * spinner says only "wait": it does not say how much is coming or reserve the
 * space for it, so tables of two thousand rows jump the page when they land.
 *
 * This is not `Loading` — that one is the branded full-screen splash for boot
 * and route transitions. This fills a region that already has a layout.
 */
export type LoadingStateProps = {
  /** Match this to whatever is loading, so the page does not reflow on arrival. */
  variant?: "table" | "cards" | "list" | "text";
  /** Rows, cards or lines to draw. */
  count?: number;
  /** `table` only: keeps the placeholder aligned to the real column count. */
  columns?: number;
};

export function LoadingState({
  variant = "text",
  count = 5,
  columns = 4,
}: LoadingStateProps) {
  const items = Array.from({ length: count }, (_, i) => i);

  if (variant === "table") {
    return (
      <Box role="status" aria-busy="true" aria-label="Cargando">
        <Stack direction="row" spacing={2} sx={{ mb: 1.5 }}>
          {Array.from({ length: columns }, (_, i) => (
            <Skeleton key={i} variant="text" height={22} sx={{ flex: 1 }} />
          ))}
        </Stack>
        {items.map((row) => (
          <Stack key={row} direction="row" spacing={2} sx={{ mb: 1 }}>
            {Array.from({ length: columns }, (_, i) => (
              <Skeleton key={i} variant="text" height={32} sx={{ flex: 1 }} />
            ))}
          </Stack>
        ))}
      </Box>
    );
  }

  if (variant === "cards") {
    return (
      <Box
        role="status"
        aria-busy="true"
        aria-label="Cargando"
        sx={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))",
          gap: 2,
        }}
      >
        {items.map((card) => (
          <Skeleton
            key={card}
            variant="rounded"
            height={112}
            sx={{ borderRadius: 3 }}
          />
        ))}
      </Box>
    );
  }

  if (variant === "list") {
    return (
      <Stack spacing={1.5} role="status" aria-busy="true" aria-label="Cargando">
        {items.map((row) => (
          <Stack key={row} direction="row" spacing={1.5} alignItems="center">
            <Skeleton variant="circular" width={36} height={36} />
            <Box sx={{ flex: 1 }}>
              <Skeleton variant="text" height={20} width="45%" />
              <Skeleton variant="text" height={16} width="70%" />
            </Box>
          </Stack>
        ))}
      </Stack>
    );
  }

  return (
    <Stack spacing={0.5} role="status" aria-busy="true" aria-label="Cargando">
      {items.map((line, i) => (
        <Skeleton
          key={line}
          variant="text"
          height={20}
          // A ragged last line reads as text rather than as a grey block.
          width={i === items.length - 1 ? "60%" : "100%"}
        />
      ))}
    </Stack>
  );
}

export default LoadingState;
