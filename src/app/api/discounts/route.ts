import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/utils/authOptions";

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
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "Error al listar descuentos" }, { status: 500 });
  }
}

// Crear una nueva regla de descuento
export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id || !session?.user?.negocio?.id) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }
    const body = await req.json();
    const {
      name,
      type,
      value,
      appliesTo = "TICKET",
      conditions,
      startDate,
      endDate,
      isActive = true,
    } = body || {};

    if (!name || typeof value !== "number" || !type) {
      return NextResponse.json({ error: "Datos insuficientes para crear la regla" }, { status: 400 });
    }

    const data: any = {
      name,
      type,
      value,
      appliesTo,
      isActive: !!isActive,
      // contexto de negocio y auditoría
      negocioId: session.user.negocio.id,
      createdBy: session.user.id,
    };

    if (conditions && typeof conditions === "object") data.conditions = conditions;
    if (startDate) data.startDate = new Date(startDate);
    if (endDate) data.endDate = new Date(endDate);

    const created = await prisma.discountRule.create({ data });
    return NextResponse.json(created, { status: 201 });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "Error al crear la regla" }, { status: 500 });
  }
}

// Actualizar una regla de descuento (campos simples)
export async function PATCH(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.negocio?.id) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }
    const body = await req.json();
    const { id, ...patch } = body || {};
    if (!id) return NextResponse.json({ error: "Falta id" }, { status: 400 });

    // Verificar pertenencia al negocio
    const exists = await prisma.discountRule.findFirst({ where: { id, negocioId: session.user.negocio.id } });
    if (!exists) return NextResponse.json({ error: "Regla no encontrada" }, { status: 404 });

    const data: any = {};
    if (patch.name !== undefined) data.name = patch.name;
    if (patch.type !== undefined) data.type = patch.type;
    if (patch.value !== undefined) data.value = Number(patch.value);
    if (patch.appliesTo !== undefined) data.appliesTo = patch.appliesTo;
    if (patch.isActive !== undefined) data.isActive = !!patch.isActive;
    if (patch.conditions !== undefined) data.conditions = patch.conditions;
    if (patch.startDate !== undefined) data.startDate = patch.startDate ? new Date(patch.startDate) : null;
    if (patch.endDate !== undefined) data.endDate = patch.endDate ? new Date(patch.endDate) : null;

    const updated = await prisma.discountRule.update({ where: { id }, data });
    return NextResponse.json(updated);
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "Error al actualizar la regla" }, { status: 500 });
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
        const body = await req.json();
        id = body?.id;
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
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "Error al eliminar la regla" }, { status: 500 });
  }
}
