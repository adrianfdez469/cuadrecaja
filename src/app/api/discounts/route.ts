import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/utils/authOptions";
import type { Prisma, DiscountType, DiscountAppliesTo } from "@prisma/client";

// Parseador seguro para fechas tipo "YYYY-MM-DD" evitando desfases por zona horaria.
// new Date('YYYY-MM-DD') interpreta en UTC y puede restar un día al mostrarse en local.
// Construimos una fecha local a las 12:00 para esquivar cambios por DST.
function parseDateOnly(value?: string | Date | null): Date | null {
  if (!value) return null;
  // Aceptar también Date y otros formatos, pero priorizar cadena YYYY-MM-DD
  if (value instanceof Date) return value;
  const m = String(value).match(/^\s*(\d{4})-(\d{2})-(\d{2})\s*$/);
  if (m) {
    const y = Number(m[1]);
    const mo = Number(m[2]) - 1;
    const d = Number(m[3]);
    return new Date(y, mo, d, 12, 0, 0, 0); // mediodía local
  }
  // Fallback: intentar parseo estándar
  const dt = new Date(value);
  return isNaN(dt.getTime()) ? null : dt;
}

// Listar reglas de descuento
export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.negocio?.id) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }
    const rules = await prisma.discountRule.findMany({
      where: { negocioId: session.user.negocio.id },
      orderBy: { createdAt: "desc" },
    });
    return NextResponse.json(rules);
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : "Error al listar descuentos";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// Crear una nueva regla de descuento
export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id || !session?.user?.negocio?.id) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }
    const body: unknown = await req.json();
    const {
      name,
      type,
      value,
      appliesTo = "TICKET",
      conditions,
      startDate,
      endDate,
      isActive = true,
    } = (body as Record<string, unknown>) || {};

    if (!name || typeof value !== "number" || !type) {
      return NextResponse.json({ error: "Datos insuficientes para crear la regla" }, { status: 400 });
    }

    const data: Omit<Prisma.DiscountRuleUncheckedCreateInput, "id" | "createdAt" | "updatedAt"> = {
      name: String(name),
      type: String(type) as DiscountType,
      value: Number(value),
      appliesTo: String(appliesTo) as DiscountAppliesTo,
      isActive: Boolean(isActive),
      negocioId: session.user.negocio.id,
      createdBy: session.user.id,
      conditions: undefined,
      startDate: null,
      endDate: null,
    };

    if (conditions && typeof conditions === "object") data.conditions = conditions as Prisma.InputJsonValue;
    if (startDate !== undefined) data.startDate = parseDateOnly(startDate as string | Date);
    if (endDate !== undefined) data.endDate = parseDateOnly(endDate as string | Date);

    const created = await prisma.discountRule.create({ data });
    return NextResponse.json(created, { status: 201 });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : "Error al crear la regla";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// Actualizar una regla de descuento (campos simples)
export async function PATCH(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.negocio?.id) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }
    const body: unknown = await req.json();
    const { id, ...patch } = (body as Record<string, unknown>) || {};
    if (!id || typeof id !== "string") {
      return NextResponse.json({ error: "Falta id válido" }, { status: 400 });
    }
    const idStr = id as string;

    // Verificar pertenencia al negocio
    const exists = await prisma.discountRule.findFirst({ where: { id: idStr, negocioId: session.user.negocio.id } });
    if (!exists) return NextResponse.json({ error: "Regla no encontrada" }, { status: 404 });

    const data: Prisma.DiscountRuleUncheckedUpdateInput = {};
    if (Object.prototype.hasOwnProperty.call(patch, "name")) data.name = patch.name as string;
    if (Object.prototype.hasOwnProperty.call(patch, "type")) data.type = patch.type as DiscountType;
    if (Object.prototype.hasOwnProperty.call(patch, "value")) data.value = Number(patch.value as number);
    if (Object.prototype.hasOwnProperty.call(patch, "appliesTo")) data.appliesTo = patch.appliesTo as DiscountAppliesTo;
    if (Object.prototype.hasOwnProperty.call(patch, "isActive")) data.isActive = Boolean(patch.isActive);
    if (Object.prototype.hasOwnProperty.call(patch, "conditions")) data.conditions = patch.conditions as Prisma.InputJsonValue;
    if (Object.prototype.hasOwnProperty.call(patch, "startDate")) data.startDate = patch.startDate ? parseDateOnly(patch.startDate as string | Date) : null;
    if (Object.prototype.hasOwnProperty.call(patch, "endDate")) data.endDate = patch.endDate ? parseDateOnly(patch.endDate as string | Date) : null;

    const updated = await prisma.discountRule.update({ where: { id: idStr }, data });
    return NextResponse.json(updated);
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : "Error al actualizar la regla";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// Eliminar una regla de descuento
export async function DELETE(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.negocio?.id) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }
    const { searchParams } = new URL(req.url);
    const idFromQuery = searchParams.get("id");
    let id = idFromQuery;
    if (!id) {
      try {
        const body: unknown = await req.json();
        id = (body as { id?: string })?.id;
      } catch {}
    }
    if (!id) return NextResponse.json({ error: "Falta id" }, { status: 400 });

    // Verificar pertenencia al negocio
    const exists = await prisma.discountRule.findFirst({ where: { id, negocioId: session.user.negocio.id } });
    if (!exists) return NextResponse.json({ error: "Regla no encontrada" }, { status: 404 });

    // Borrar primero aplicaciones relacionadas (si las hay) para evitar restricciones
    await prisma.$transaction([
      prisma.appliedDiscount.deleteMany({ where: { discountRuleId: id } }),
      prisma.discountRule.delete({ where: { id } })
    ]);
    return NextResponse.json({ ok: true });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : "Error al eliminar la regla";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
