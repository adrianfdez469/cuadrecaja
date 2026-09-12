import React from "react";
import { Button } from "@mui/material";
import { FilterAlt } from "@mui/icons-material";

interface SyncTraceFilterToggleProps {
  /** Whether the filter is currently on. */
  active: boolean;
  /** Called with the state the control should move to. */
  onToggle: (next: boolean) => void;
}

/**
 * The sales-history filter control: a toggling outlined button.
 *
 * It owns NO state and reads NO sale. It takes the boolean and hands back the
 * boolean, so the page stays the single place where the two list filters are
 * composed.
 *
 * Three things here are contract, not styling:
 *
 * - `aria-pressed` is written explicitly. MuiButton does not emit it on its
 *   own the way ToggleButton does, and it is the only cue that does not depend
 *   on colour: without it the two states are indistinguishable to a screen
 *   reader, and there is nothing stable to assert against either.
 * - The button is NEVER disabled, not even in a period where it would select
 *   nothing. A "helpful" disabled state makes the acceptance criterion about
 *   that exact period impossible to execute.
 * - The on state changes COLOUR ONLY. Same size, same padding, same border
 *   width, same label, so the header does not reflow between presses.
 */
const SyncTraceFilterToggle: React.FC<SyncTraceFilterToggleProps> = ({
  active,
  onToggle,
}) => {
  return (
    <Button
      variant="outlined"
      startIcon={<FilterAlt />}
      aria-pressed={active}
      onClick={() => onToggle(!active)}
      sx={{
        flexShrink: 0,
        bgcolor: active
          ? "semantic.hue.accent.surface"
          : "semantic.surface.raised",
        borderColor: active
          ? "semantic.hue.accent.main"
          : "semantic.surface.border",
        color: active ? "semantic.hue.accent.main" : "semantic.text.secondary",
        "&:hover": {
          bgcolor: active
            ? "semantic.hue.accent.surface"
            : "semantic.surface.sunken",
          borderColor: active
            ? "semantic.hue.accent.main"
            : "semantic.surface.borderStrong",
        },
      }}
    >
      Con rastro de sincronización
    </Button>
  );
};

export default SyncTraceFilterToggle;
