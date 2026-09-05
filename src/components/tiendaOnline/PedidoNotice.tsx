"use client";

import { Box, Typography } from "@mui/material";
import type { ReactNode } from "react";

import { shape } from "@/theme/tokens";

/** The three hues this block is painted in. `accent` is never one of them. */
export type PedidoNoticeHue = "caution" | "positive" | "negative";

export interface PedidoNoticeProps {
  /** Bold first line. Omitted when the notice is a single sentence. */
  title?: string;
  /**
   * `caution` by default, which is what the four F-011 notices ask for and why
   * their look does not change. F-012 needs `positive` for an accepted report
   * and `negative` for one that did not reach the online store.
   */
  hue?: PedidoNoticeHue;
  /**
   * A list rendered as a SIBLING of the body paragraph, inside the same tinted
   * box. Optional and additive: nothing that existed before F-014 passes it, so
   * no current call site changes its DOM.
   *
   * It is a `ul` and not more `children` because `children` goes inside a
   * `Typography`, i.e. inside a `<p>`: a list nested there is invalid HTML, and
   * the browser repairs it by moving the list OUT of the paragraph — which is
   * how a tinted box ends up broken in half.
   */
  items?: readonly string[];
  children: ReactNode;
}

/**
 * The tinted block the two order screens use for a fact worth noticing.
 *
 * It was `PedidoCautionNotice` until F-012 needed the other two hues: a
 * component named after one of them while painting green is a name that lies.
 * The shape is unchanged, and so is every existing call site, which takes the
 * default.
 *
 * It carries NO dismiss control, on purpose: every fact it states is still true
 * after somebody closes it, and it disappears when the fact does.
 */
export function PedidoNotice({
  title,
  hue = "caution",
  items,
  children,
}: Readonly<PedidoNoticeProps>) {
  return (
    <Box
      sx={{
        p: 1.5,
        borderRadius: `${shape.radius.md}px`,
        bgcolor: `semantic.hue.${hue}.surface`,
        color: `semantic.hue.${hue}.main`,
      }}
    >
      {title && (
        <Typography variant="body2" sx={{ fontWeight: 700 }}>
          {title}
        </Typography>
      )}
      <Typography variant="body2">{children}</Typography>
      {items !== undefined && items.length > 0 && (
        <Box component="ul" sx={{ m: 0, mt: 0.75, pl: 2.5 }}>
          {items.map((item) => (
            // Product names are written by the merchant, and nothing stops one
            // without a single space: at 296 px it would take the box with it.
            <Typography
              key={item}
              component="li"
              variant="body2"
              sx={{ overflowWrap: "anywhere" }}
            >
              {item}
            </Typography>
          ))}
        </Box>
      )}
    </Box>
  );
}

export default PedidoNotice;
