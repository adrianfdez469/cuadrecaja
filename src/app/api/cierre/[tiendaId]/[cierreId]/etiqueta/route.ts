import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/utils/auth";
import { assertTiendaTenant } from "@/lib/tenantScope";
import { updateCierreEtiquetaSchema } from "@/schemas/cierre";
import { normalizeCierreEtiqueta } from "@/utils/cierreLabel";

/**
 * PATCH /api/cierre/[tiendaId]/[cierreId]/etiqueta
 *
 * Renames a closing period. The label is a display name and nothing else: it
 * never enters a computation, and `fechaInicio`/`fechaFin` — which drive the
 * open-period detection, the window of cash movements and the exchange rate at
 * the close — are not touched here on purpose.
 *
 * Editable after the period is closed, which is the whole point: a closing
 * registered days late is only recognised as such afterwards.
 */
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ tiendaId: string; cierreId: string }> },
) {
  try {
    const { tiendaId, cierreId } = await params;

    const session = await getSession();
    const { scope, response } = await assertTiendaTenant({
      session,
      tiendaId,
      permisoRequerido: "operaciones.cierre.cerrar",
    });
    if (!scope) return response;

    const parsed = updateCierreEtiquetaSchema.safeParse(await req.json());
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Etiqueta no válida" },
        { status: 400 },
      );
    }

    const etiqueta = normalizeCierreEtiqueta(parsed.data.etiqueta);

    // `updateMany` with the store in the `where`: the period id arrives from the
    // request, so it is only ever renamed when it belongs to the store this
    // session was already cleared for. A count of 0 is "not yours or not there",
    // and both answer the same 404.
    const { count } = await prisma.cierrePeriodo.updateMany({
      where: { id: cierreId, tiendaId: scope.tiendaId },
      data: { etiqueta },
    });

    if (count === 0) {
      return NextResponse.json(
        { error: "Cierre no encontrado" },
        { status: 404 },
      );
    }

    return NextResponse.json({ etiqueta });
  } catch (_error: unknown) {
    return NextResponse.json(
      { error: "Error al guardar la etiqueta del cierre" },
      { status: 500 },
    );
  }
}
