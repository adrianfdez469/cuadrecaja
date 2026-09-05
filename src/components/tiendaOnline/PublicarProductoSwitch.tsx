"use client";

import { Switch, switchClasses } from "@mui/material";

import type { ITiendaOnlineProducto } from "@/schemas/tiendaOnline";
import { touch } from "@/theme/tokens";

/**
 * The accessible name of one switch. It ALWAYS carries the product's name, and
 * carries the reason too when the control is off: fifty disabled switches do not
 * get fifty visible reasons — they get one, at the top — but whoever cannot see
 * the screen needs it on each one.
 */
function switchAriaLabel(nombre: string, disabledReason: string): string {
  const base = `Publicar «${nombre}» en la tienda online`;
  return disabledReason.length > 0 ? `${base}. ${disabledReason}` : base;
}

/**
 * MUI's medium `Switch` paints a 34 × 14 track with a 20 px thumb, and the
 * element that actually receives the tap — the `ButtonBase` of the `switchBase`
 * slot, which carries the `<input type="checkbox">` — ends up 38 × 38: six
 * pixels short of the minimum this screen requires.
 *
 * Wrapping the switch in a 44 px box does NOT fix that. The wrapper receives no
 * event, so a tap on its edge lands on nothing and the box only LOOKS like a
 * target. What has to grow is the padding of the `switchBase` itself, and the
 * root has to grow with it: the root is `overflow: hidden`, so a `switchBase`
 * taller or wider than the root would be clipped when the switch is checked.
 *
 *   switchBase = thumb  + 2 × 12  = 44  → the tap target
 *   root       = track  + 2 × 15  = 64 × 44, with the 14 px track untouched
 *
 * With those two numbers the thumb sits at x = 22 unchecked and, after MUI's
 * `translateX(20px)`, at x = 42 — the centres of the two round caps of a 34 px
 * track inset by 15. So the visible switch is exactly the one MUI paints; only
 * the invisible hit area around it grows.
 */
const THUMB_SIZE = 20;
const TRACK_WIDTH = 34;
const TRACK_HEIGHT = 14;
const SWITCH_BASE_PADDING = (touch.min - THUMB_SIZE) / 2;
const ROOT_PADDING = (touch.min - TRACK_HEIGHT) / 2;
const ROOT_WIDTH = TRACK_WIDTH + ROOT_PADDING * 2;

export interface PublicarProductoSwitchProps {
  producto: ITiendaOnlineProducto;
  disabled: boolean;
  /** The reason a disabled switch is disabled, for whoever cannot see the notice. */
  disabledReason: string;
  onToggle: (producto: ITiendaOnlineProducto, next: boolean) => void;
}

/**
 * The publish switch of one product, identical on the card and in the table row.
 *
 * It lives in its own file because the two lists are two renderings of the same
 * control: the accessible name and the tap target are decided once here, not
 * twice in parallel.
 */
export function PublicarProductoSwitch({
  producto,
  disabled,
  disabledReason,
  onToggle,
}: Readonly<PublicarProductoSwitchProps>) {
  return (
    <Switch
      checked={producto.publicarEnTienda}
      disabled={disabled}
      inputProps={{
        "aria-label": switchAriaLabel(producto.nombre, disabledReason),
      }}
      onChange={(event) => onToggle(producto, event.target.checked)}
      sx={{
        width: ROOT_WIDTH,
        height: touch.min,
        padding: `${ROOT_PADDING}px`,
        // Two classes deep on purpose: the slot's own rule is a single class and
        // would otherwise win by source order, which is what a bare `sx` on the
        // switch cannot beat.
        [`& .${switchClasses.switchBase}`]: {
          padding: `${SWITCH_BASE_PADDING}px`,
        },
      }}
    />
  );
}

export default PublicarProductoSwitch;
