"use client";

import { Box, LinearProgress } from "@mui/material";

/**
 * A loading/transition screen shown while the app is switching states or loading pages.
 *
 * The center displays the app logo in a 72px square with stroke-dash animation
 * (two halves closing the square with staggered delay), and below it a 120px
 * indeterminate progress bar in the app's accent hue.
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
      {/* Logo with animated stroke-dash */}
      <Box
        sx={{
          position: "relative",
          width: 72,
          height: 72,
          mb: 4,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <svg
          viewBox="0 0 72 72"
          width={72}
          height={72}
          xmlns="http://www.w3.org/2000/svg"
          style={{ overflow: "visible" }}
        >
          {/* Top-left to top-right stroke (first half) */}
          <path
            d="M 12 12 L 60 12"
            stroke="#5B4CA8"
            strokeWidth={3}
            fill="none"
            strokeLinecap="round"
            style={{
              strokeDasharray: 48,
              strokeDashoffset: 48,
              animation: "drawStroke1 0.8s ease-in-out forwards 0.2s",
            }}
          />
          {/* Top-right to bottom-right stroke (second half) */}
          <path
            d="M 60 12 L 60 60"
            stroke="#5B4CA8"
            strokeWidth={3}
            fill="none"
            strokeLinecap="round"
            style={{
              strokeDasharray: 48,
              strokeDashoffset: 48,
              animation: "drawStroke2 0.8s ease-in-out forwards 0.6s",
            }}
          />
          {/* Bottom-right to bottom-left (third segment) */}
          <path
            d="M 60 60 L 12 60"
            stroke="#5B4CA8"
            strokeWidth={3}
            fill="none"
            strokeLinecap="round"
            style={{
              strokeDasharray: 48,
              strokeDashoffset: 48,
              animation: "drawStroke3 0.8s ease-in-out forwards 1s",
            }}
          />
          {/* Bottom-left to top-left (close) */}
          <path
            d="M 12 60 L 12 12"
            stroke="#5B4CA8"
            strokeWidth={3}
            fill="none"
            strokeLinecap="round"
            style={{
              strokeDasharray: 48,
              strokeDashoffset: 48,
              animation: "drawStroke4 0.8s ease-in-out forwards 1.4s",
            }}
          />

          <style>{`
            @keyframes drawStroke1 {
              from { stroke-dashoffset: 48; }
              to { stroke-dashoffset: 0; }
            }
            @keyframes drawStroke2 {
              from { stroke-dashoffset: 48; }
              to { stroke-dashoffset: 0; }
            }
            @keyframes drawStroke3 {
              from { stroke-dashoffset: 48; }
              to { stroke-dashoffset: 0; }
            }
            @keyframes drawStroke4 {
              from { stroke-dashoffset: 48; }
              to { stroke-dashoffset: 0; }
            }
          `}</style>
        </svg>
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
