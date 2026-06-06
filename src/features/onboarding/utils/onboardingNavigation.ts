/** Atributo data-tour del ítem de menú asociado a una ruta de avance del tour */
export function getMenuDataTourForAdvancePath(path: string): string | undefined {
  if (path.startsWith("/pos")) return "nav-pos";
  if (path.startsWith("/configuracion/gestion-inventario")) {
    return "nav-gestion-inventario";
  }
  return undefined;
}
