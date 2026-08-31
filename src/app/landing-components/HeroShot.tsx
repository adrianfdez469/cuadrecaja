"use client";

import Image from "next/image";
import { Box } from "@mui/material";

import { shape } from "@/theme/tokens";

/**
 * The product, in a frame that is cut off at the bottom.
 *
 * Two files rather than one responsive image: the phone gets the POS as it
 * actually looks on a phone — one column and the charge bar across the
 * bottom — instead of a wide screenshot shrunk until its prices are unreadable.
 * Only one of the two is ever fetched, because the other's `sizes` resolves
 * to `0px` at that breakpoint.
 *
 * `objectPosition: top` matters: the captures are taller in proportion than
 * the frame, so `cover` has to drop something, and what the page is arguing
 * about — the catalogue and the total — lives at the top.
 */
export function HeroShot() {
  return (
    <Box
      sx={{
        mt: { xs: 4, md: 7 },
        p: { xs: 1.5, md: 2.5 },
        pb: 0,
        bgcolor: "semantic.surface.sunken",
        border: "1px solid",
        borderColor: "semantic.surface.border",
        borderBottom: "none",
        borderRadius: `${shape.radius.lg}px ${shape.radius.lg}px 0 0`,
      }}
    >
      <Box
        sx={{
          position: "relative",
          height: { xs: 420, md: 560 },
          borderRadius: `${shape.radius.md}px ${shape.radius.md}px 0 0`,
          overflow: "hidden",
        }}
      >
        <Box
          sx={{
            position: "absolute",
            inset: 0,
            display: { xs: "block", md: "none" },
          }}
        >
          <Image
            src="/landing/pos-mobile.png"
            alt="El punto de venta en un teléfono: catálogo, carrito y el total a cobrar"
            fill
            priority
            sizes="(max-width: 899px) 100vw, 0px"
            style={{ objectFit: "cover", objectPosition: "top" }}
          />
        </Box>

        <Box
          sx={{
            position: "absolute",
            inset: 0,
            display: { xs: "none", md: "block" },
          }}
        >
          <Image
            src="/landing/pos-desktop.png"
            alt="El punto de venta: catálogo, carrito y el total a cobrar con sus conversiones"
            fill
            priority
            sizes="(max-width: 899px) 0px, 1200px"
            style={{ objectFit: "cover", objectPosition: "top" }}
          />
        </Box>
      </Box>
    </Box>
  );
}
