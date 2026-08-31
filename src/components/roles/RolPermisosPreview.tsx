import { Box, Typography } from "@mui/material";
import { RolPermisoPill } from "./RolPermisoPill";

interface Props {
  permisos: string[];
  /** `row` for the desktop table cell, `column` for the mobile card. */
  direction?: "row" | "column";
  limit?: number;
}

/** The first few permission keys of a role, plus a "+N más" count — shared by the desktop table and the mobile card so the two never drift. */
export function RolPermisosPreview({
  permisos,
  direction = "row",
  limit = 3,
}: Props) {
  const visibles = permisos.slice(0, limit);
  const restantes = permisos.length - visibles.length;

  return (
    <Box
      sx={{
        display: "flex",
        flexDirection: direction,
        flexWrap: direction === "row" ? "wrap" : undefined,
        alignItems: direction === "row" ? "center" : "flex-start",
        gap: 0.75,
      }}
    >
      {visibles.map((permiso) => (
        <RolPermisoPill key={permiso} permiso={permiso} />
      ))}
      {restantes > 0 && (
        <Typography
          variant="caption"
          sx={{ color: "primary.main", fontWeight: 700 }}
        >
          +{restantes} más
        </Typography>
      )}
    </Box>
  );
}
