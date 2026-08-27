"use client";

import { SvgIcon } from "@mui/material";
import type { SvgIconProps } from "@mui/material";

/**
 * The landing's own icons, drawn in the design rather than picked from a set.
 *
 * They are here because the three claims the page makes are specific — selling
 * with the connection down, charging in several currencies, knowing the
 * margin — and Material's catalogue has no honest glyph for any of them. Each
 * is a 24-grid line drawing on `currentColor`, so they inherit whatever ink
 * the block around them uses.
 */

/** Signal bars struck through: the sale that goes on without the network. */
export function OfflineSalesIcon(props: SvgIconProps) {
  return (
    <SvgIcon
      viewBox="0 0 24 24"
      {...props}
      sx={{ fill: "none", stroke: "currentColor", ...props.sx }}
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M2 8.5a15 15 0 0 1 20 0" />
      <path d="M5.5 12a10 10 0 0 1 13 0" />
      <path d="M9 15.4a5 5 0 0 1 6 0" />
      <path d="M12 19v.2" />
      <path d="M3 3l18 18" />
    </SvgIcon>
  );
}

/** A currency symbol: the same sale settled in more than one money. */
export function MultiCurrencyIcon(props: SvgIconProps) {
  return (
    <SvgIcon
      viewBox="0 0 24 24"
      {...props}
      sx={{ fill: "none", stroke: "currentColor", ...props.sx }}
      strokeWidth={1.9}
      strokeLinecap="round"
    >
      <path d="M12 3v18" />
      <path d="M16 7.5c0-1.9-1.8-3-4-3s-4 1.1-4 3 1.8 2.7 4 3.3 4 1.4 4 3.3-1.8 3-4 3-4-1.1-4-3" />
    </SvgIcon>
  );
}

/** A ledger card: what the period left once the cost is taken out. */
export function MarginIcon(props: SvgIconProps) {
  return (
    <SvgIcon
      viewBox="0 0 24 24"
      {...props}
      sx={{ fill: "none", stroke: "currentColor", ...props.sx }}
      strokeWidth={1.8}
      strokeLinejoin="round"
    >
      <rect x="3" y="5" width="18" height="14" rx="2" />
      <path d="M3 10h18" />
      <path d="M8 14.5h4" />
    </SvgIcon>
  );
}

/** The filled tick that opens each line of the «Además» list. */
export function CheckBadgeIcon(props: SvgIconProps) {
  return (
    <SvgIcon viewBox="0 0 24 24" {...props}>
      <circle cx="12" cy="12" r="9.5" fill="currentColor" />
      <path
        d="m8 12.2 2.7 2.7 5.3-5.4"
        fill="none"
        stroke="#FFFFFF"
        strokeWidth={2}
      />
    </SvgIcon>
  );
}

/** The app, as something you install. */
export function InstallAppIcon(props: SvgIconProps) {
  return (
    <SvgIcon
      viewBox="0 0 24 24"
      {...props}
      sx={{ fill: "none", stroke: "currentColor", ...props.sx }}
      strokeWidth={1.7}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M5 10h14v7a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2z" />
      <path d="M5 10a7 7 0 0 1 14 0" />
      <path d="M8 6 6.8 4M16 6l1.2-2" />
    </SvgIcon>
  );
}
