import { prisma } from '@/lib/prisma';
import { emitQabCurrencyFanout } from '@/lib/qab/qabCatalogEmitters';
import { monedaAdminUpdateSchema } from '@/schemas/moneda';
import { hasSuperAdminPrivileges } from '@/utils/auth';
import { NextRequest, NextResponse } from 'next/server';

/**
 * The global `Moneda` catalog, as a SUPER_ADMIN edits it.
 *
 * Since F-006 this row is mirrored into queandabuscando's CURRENCY table, which
 * is GLOBAL to that platform and shows in the public storefront of OTHER
 * businesses. Two consequences, and the order of the steps IS the contract:
 *
 *  1. `hasSuperAdminPrivileges()` — the write barrier, unchanged.
 *  2. `monedaAdminUpdateSchema.safeParse(body)` — capped and charset-restricted
 *     text, answered BEFORE any transaction is opened. Nothing is written and
 *     nothing is enqueued.
 *  3. ONE transaction: the `update`, and with the row ALREADY PERSISTED the
 *     fan-out. Enqueueing first would announce a change that never landed, and
 *     a rollback takes the events with it.
 */
export async function PUT(req: NextRequest, { params }: { params: Promise<{ code: string }> }) {
  try {
    if (!(await hasSuperAdminPrivileges())) {
      return NextResponse.json({ error: 'Acceso denegado' }, { status: 403 });
    }
    const { code } = await params;
    const body = await req.json();
    const result = monedaAdminUpdateSchema.safeParse(body);
    if (!result.success) {
      return NextResponse.json({ error: result.error.flatten() }, { status: 400 });
    }

    const occurredAt = new Date();

    const moneda = await prisma.$transaction(async (tx) => {
      const updated = await tx.moneda.update({ where: { code }, data: result.data });

      // The payload is built from the row the write returned, never from the
      // body. One event per carrier business: the table is global on the other
      // side, but the transport is per business (ADR 0044).
      await emitQabCurrencyFanout(tx, {
        moneda: {
          code: updated.code,
          nombre: updated.nombre,
          simbolo: updated.simbolo,
          activo: updated.activo,
        },
        occurredAt,
      });

      return updated;
    });

    return NextResponse.json(moneda);
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: 'Error al actualizar moneda' }, { status: 500 });
  }
}

/**
 * Retiring a currency. It validates no text — it receives none — but follows the
 * same order: `update` first, fan-out second, in one transaction.
 *
 * The wire has NO way to delete a currency: `active: false` IS the retirement,
 * and a CURRENCY event with `operation: DELETE` is never emitted.
 */
export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ code: string }> }) {
  try {
    if (!(await hasSuperAdminPrivileges())) {
      return NextResponse.json({ error: 'Acceso denegado' }, { status: 403 });
    }
    const { code } = await params;

    const occurredAt = new Date();

    // Desactivar en lugar de eliminar (puede estar referenciada en NegocioMoneda)
    const moneda = await prisma.$transaction(async (tx) => {
      const updated = await tx.moneda.update({ where: { code }, data: { activo: false } });

      await emitQabCurrencyFanout(tx, {
        moneda: {
          code: updated.code,
          nombre: updated.nombre,
          simbolo: updated.simbolo,
          activo: updated.activo,
        },
        occurredAt,
      });

      return updated;
    });

    return NextResponse.json(moneda);
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: 'Error al desactivar moneda' }, { status: 500 });
  }
}
