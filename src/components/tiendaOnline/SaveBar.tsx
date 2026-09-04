"use client";

import { Box, Button, Stack, Typography } from "@mui/material";

import { touch } from "@/theme/tokens";

export interface SaveBarProps {
  /** How many rules the calendar draft breaks. 0 when it is fine. */
  issueCount: number;
  saving: boolean;
  online: boolean;
  isMobile: boolean;
  onDiscard: () => void;
  onSave: () => void;
}

export const SAVE_BAR_HEIGHT = touch.rowLarge;

const SAVE_BUTTON_MIN_HEIGHT = 48;

/**
 * The sticky bar, drawn only while there are unsaved changes.
 *
 * «Guardar cambios» is NOT disabled when the calendar has problems: a disabled
 * primary with no reason is the most common way to leave somebody stuck, and
 * here the reason can be three screens away. Pressing it has to take you to the
 * problem. It IS disabled with no connection, and then the reason sits beside it.
 */
export function SaveBar({
  issueCount,
  saving,
  online,
  isMobile,
  onDiscard,
  onSave,
}: Readonly<SaveBarProps>) {
  const buttons = (
    <Stack direction="row" spacing={1} sx={{ width: isMobile ? "100%" : "auto" }}>
      <Button
        variant="text"
        onClick={onDiscard}
        disabled={saving}
        sx={{
          minHeight: SAVE_BUTTON_MIN_HEIGHT,
          flex: isMobile ? 1 : "0 0 auto",
        }}
      >
        Descartar
      </Button>
      <Button
        variant="contained"
        onClick={onSave}
        loading={saving}
        disabled={!online}
        sx={{
          minHeight: SAVE_BUTTON_MIN_HEIGHT,
          flex: isMobile ? 1 : "0 0 auto",
        }}
      >
        Guardar cambios
      </Button>
    </Stack>
  );

  return (
    <Box
      sx={{
        position: "sticky",
        bottom: 0,
        zIndex: 1,
        mt: 2,
        px: 1.5,
        py: 1,
        minHeight: SAVE_BAR_HEIGHT,
        display: "flex",
        alignItems: "center",
        bgcolor: "semantic.surface.raised",
        borderTop: "1px solid",
        borderColor: "semantic.surface.border",
      }}
    >
      <Stack
        direction={isMobile ? "column" : "row"}
        alignItems={isMobile ? "stretch" : "center"}
        justifyContent="space-between"
        spacing={1}
        sx={{ width: "100%" }}
      >
        <Stack spacing={0.25}>
          <Typography
            variant="body2"
            sx={{
              color:
                issueCount > 0
                  ? "semantic.hue.negative.main"
                  : "semantic.text.secondary",
            }}
          >
            {issueCount > 0
              ? `El horario tiene ${issueCount} ${issueCount === 1 ? "problema" : "problemas"}`
              : "Cambios sin guardar"}
          </Typography>
          {!online && (
            <Typography
              variant="caption"
              sx={{ color: "semantic.hue.caution.main" }}
            >
              Sin conexión: no se puede guardar ahora.
            </Typography>
          )}
        </Stack>
        {buttons}
      </Stack>
    </Box>
  );
}

export default SaveBar;
