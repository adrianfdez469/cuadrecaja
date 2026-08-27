"use client";

import { Box, ButtonBase, Typography } from "@mui/material";
import ChevronRightIcon from "@mui/icons-material/ChevronRight";
import type { SvgIconComponent } from "@mui/icons-material";

import { shape, touch } from "@/theme/tokens";

interface ReportRowProps {
  title: string;
  description: string;
  icon: SvgIconComponent;
  onClick: () => void;
  /** Draws the hairline above. The first row in a panel has none. */
  divider: boolean;
}

/**
 * One report, as a row.
 *
 * The hub used to lay the five out as cards three across, which left a hole in
 * the second line and made each description wrap at about thirty characters —
 * so the sentence explaining what the report is for took four lines and still
 * got cut. As rows they read at full width, and adding a sixth report costs
 * nothing to the layout.
 */
export function ReportRow({
  title,
  description,
  icon: Icon,
  onClick,
  divider,
}: ReportRowProps) {
  return (
    <ButtonBase
      onClick={onClick}
      sx={{
        display: "flex",
        alignItems: "center",
        gap: { xs: 2, md: 2.5 },
        width: "100%",
        minHeight: touch.rowLarge,
        px: { xs: 2, md: 3 },
        py: { xs: 2, md: 2.75 },
        textAlign: "left",
        ...(divider && {
          borderTop: "1px solid",
          borderColor: "semantic.surface.border",
        }),
        "@media (hover: hover)": {
          "&:hover": { bgcolor: "semantic.surface.sunken" },
        },
      }}
    >
      <Box
        sx={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          flex: "0 0 48px",
          width: 48,
          height: 48,
          borderRadius: `${shape.radius.md}px`,
          bgcolor: "semantic.hue.accent.surface",
          color: "semantic.hue.accent.main",
        }}
      >
        <Icon sx={{ fontSize: 26 }} />
      </Box>

      <Box sx={{ flex: 1, minWidth: 0 }}>
        <Typography
          sx={{ fontSize: "1.0625rem", fontWeight: 700, lineHeight: 1.35 }}
        >
          {title}
        </Typography>
        <Typography
          sx={{
            mt: "3px",
            maxWidth: "78ch",
            fontSize: "0.875rem",
            lineHeight: 1.5,
            color: "text.secondary",
          }}
        >
          {description}
        </Typography>
      </Box>

      <ChevronRightIcon sx={{ flex: "0 0 20px", color: "text.disabled" }} />
    </ButtonBase>
  );
}
