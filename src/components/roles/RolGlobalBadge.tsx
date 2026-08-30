import { Chip } from "@mui/material";
import LockOutlined from "@mui/icons-material/LockOutlined";

/**
 * A role shared across every business, not one scoped to this negocio.
 * Neutral pill — the redesign drops the "secondary"-hued outlined ring
 * the old chip used, which read as a warning rather than a fact.
 */
export function RolGlobalBadge() {
  return (
    <Chip
      icon={<LockOutlined sx={{ fontSize: "14px !important" }} />}
      label="Global"
      size="small"
      sx={{
        bgcolor: "semantic.hue.neutral.surface",
        color: "semantic.hue.neutral.main",
        "& .MuiChip-icon": { color: "semantic.hue.neutral.main" },
      }}
    />
  );
}
