"use client";

import { Box, LinearProgress } from "@mui/material";
import { BrandMark } from "@/components/brand";

/**
 * A loading/transition screen shown while the app is switching states or loading pages.
 *
 * The center displays the app's brand mark, closing itself in the same
 * stroke-dash animation the splash screen uses (`BrandMark`'s `animated`
 * prop), and below it a 120px indeterminate progress bar in the app's
 * accent hue.
 *
 * Skeletal content blocks render in the background to suggest what's loading.
 */
export function TransitionScreen() {
  return (
    <Box
      sx={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        minHeight: "100vh",
        px: 2,
        py: 4,
        backgroundColor: "semantic.surface.page",
      }}
    >
      <Box sx={{ mb: 4 }}>
        <BrandMark size={72} tone="accent" animated />
      </Box>

      {/* Progress bar: 120px wide, indeterminate, accent color */}
      <Box sx={{ width: 120, mb: 6 }}>
        <LinearProgress
          sx={{
            height: 3,
            borderRadius: 1.5,
            backgroundColor: "semantic.hue.accent.surface",
            "& .MuiLinearProgress-bar": {
              backgroundColor: "semantic.hue.accent.main",
              borderRadius: 1.5,
            },
          }}
        />
      </Box>

      {/* Background skeleton blocks suggesting page content loading */}
      <Box
        sx={{
          width: "100%",
          maxWidth: 600,
          display: "flex",
          flexDirection: "column",
          gap: 2,
          px: 2,
          opacity: 0.3,
        }}
      >
        {/* Header skeleton */}
        <Box
          sx={{
            height: 32,
            backgroundColor: "semantic.surface.sunken",
            borderRadius: `8px`,
          }}
        />
        {/* Content blocks */}
        {Array.from({ length: 3 }).map((_, i) => (
          <Box
            key={i}
            sx={{
              height: i === 1 ? 24 : 20,
              backgroundColor: "semantic.surface.sunken",
              borderRadius: `8px`,
            }}
          />
        ))}
      </Box>
    </Box>
  );
}
