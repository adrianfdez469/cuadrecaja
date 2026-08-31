import { Chip } from "@mui/material";

interface Props {
  permiso: string;
}

/**
 * A permission key as code — the redesign's replacement for the old
 * lilac pill (`rediseno/roles.html`: "las claves de permiso como código,
 * no como píldoras lila"). A rectangular radius on purpose, so it never
 * reads as the same shape as `RolGlobalBadge`'s pill.
 */
export function RolPermisoPill({ permiso }: Props) {
  return (
    <Chip
      label={permiso}
      size="small"
      sx={{
        height: 22,
        borderRadius: "6px",
        bgcolor: "semantic.hue.neutral.surface",
        color: "text.secondary",
        fontFamily: "monospace",
        fontSize: "0.75rem",
        fontWeight: 500,
      }}
    />
  );
}
