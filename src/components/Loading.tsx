"use client";

import { Box, keyframes } from "@mui/material";

import { BrandMark } from "@/components/brand";

/**
 * The wait, as one mark and one bar.
 *
 * This is the splash and the transition between screens. It used to set the
 * name in uppercase at weight 900 under a black-to-violet gradient, plus a
 * spinning ring, a pulsing glow and the line «Gestionando tu Negocio» — five
 * things moving to say one thing. The brand's own animation says it: the two
 * halves closing the square, which is what the product is called.
 *
 * No text. A loading screen that has to explain itself is loading too slowly.
 */

/** Indeterminate: the fill crosses and leaves, it never reports a percentage. */
const sweep = keyframes`
  0% { transform: translateX(-100%); }
  100% { transform: translateX(300%); }
`;

const Loading = () => (
  <Box
    role="status"
    aria-label="Cargando"
    sx={{
      display: "flex",
      flexDirection: "column",
      justifyContent: "center",
      alignItems: "center",
      gap: 2.75,
      minHeight: "75vh",
      width: "100%",
    }}
  >
    <BrandMark size={72} boxed animated />

    <Box
      sx={{
        position: "relative",
        width: 120,
        height: 3,
        borderRadius: "2px",
        bgcolor: "semantic.surface.border",
        overflow: "hidden",
      }}
    >
      <Box
        sx={{
          position: "absolute",
          top: 0,
          left: 0,
          width: "33%",
          height: 3,
          borderRadius: "2px",
          bgcolor: "semantic.hue.accent.main",
          animation: `${sweep} 1.4s ease-in-out infinite`,
          "@media (prefers-reduced-motion: reduce)": {
            animation: "none",
            width: "100%",
            opacity: 0.4,
          },
        }}
      />
    </Box>
  </Box>
);

export default Loading;
