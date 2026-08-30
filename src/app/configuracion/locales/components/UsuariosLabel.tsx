import { Box, Typography } from "@mui/material";
import type { ILocal } from "@/schemas/tienda";

/**
 * Who works in a local, as a sentence.
 *
 * Each name used to be an outlined chip with an icon, so a store with four
 * people produced four bordered badges inside one table cell — more furniture
 * than the local's own name carried. A list of names is prose; the design sets
 * it as prose, and greys the empty case rather than drawing a box around it.
 */
export function UsuariosLabel({
  local,
  direction = "row",
}: {
  local: ILocal;
  /** `row` joins the names into one line for the desktop table; `column`
   * gives each name its own line, matching the mobile card. */
  direction?: "row" | "column";
}) {
  const nombres =
    local.usuariosTiendas && local.usuariosTiendas.length > 0
      ? local.usuariosTiendas.map(
          (ut) => `${ut.usuario.nombre}${ut.rol ? ` (${ut.rol.nombre})` : ""}`,
        )
      : (local.usuarios ?? []).map((u) => u.nombre);

  if (nombres.length === 0) {
    return (
      <Typography variant="body2" color="text.disabled">
        Sin usuarios asignados
      </Typography>
    );
  }

  if (direction === "column") {
    return (
      <Box sx={{ display: "flex", flexDirection: "column", gap: 0.25 }}>
        {nombres.map((nombre) => (
          <Typography key={nombre} variant="body2">
            {nombre}
          </Typography>
        ))}
      </Box>
    );
  }

  return (
    <Typography variant="body2" color="text.secondary">
      {nombres.join(" · ")}
    </Typography>
  );
}
