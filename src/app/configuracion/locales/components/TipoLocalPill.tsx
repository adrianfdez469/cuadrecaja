import { StatusPill } from "@/components/StatusPill";
import { TipoLocal } from "@/schemas/tienda";

/**
 * A local's kind, set as a small caps pill.
 *
 * It was an outlined chip carrying an icon — a shopfront or a warehouse — next
 * to a name that already said which was which. The design keeps only the word,
 * spaced and uppercased so it reads as a category rather than a label, and
 * tints it: the accent's wash for a shop, info's for a warehouse. Tinted, not
 * filled, because it is a state and not something you can press.
 */
export function TipoLocalPill({ tipo }: { tipo?: string }) {
  return (
    <StatusPill
      label={tipo ?? ""}
      hue={tipo === TipoLocal.ALMACEN ? "info" : "accent"}
      caps
    />
  );
}
