import { prisma } from "@/lib/prisma";
import type { DiscountRule as DiscountRuleModel, Prisma } from "@prisma/client";

// Tipos mínimos para el motor de descuentos (MVP)
export interface DiscountApplicationInputProduct {
  productoTiendaId: string;
  cantidad: number;
  precio: number; // precio unitario
}

export interface DiscountApplicationResultItem {
  discountRuleId: string;
  amount: number;
  productsAffected?: { productoTiendaId: string; cantidad: number }[];
  ruleName?: string;
}

export interface DiscountApplicationResult {
  discountTotal: number;
  applied: DiscountApplicationResultItem[];
  baseTotal: number;
  finalTotal: number;
}

function isWithin(date: Date, start?: Date | null, end?: Date | null) {
  if (start && date < start) return false;
  if (end && date > end) return false;
  return true;
}

// Condiciones soportadas por el MVP
type DiscountConditions = {
  code?: string;
  minTotal?: number;
  productIds?: string[];
  categoryIds?: string[];
  customerIds?: string[];
};

function parseConditions(json: Prisma.JsonValue | null | undefined): DiscountConditions {
  const c = (json ?? {}) as Prisma.JsonObject;
  const out: DiscountConditions = {};
  if (typeof c.code === "string") out.code = c.code;
  if (typeof c.minTotal === "number") out.minTotal = c.minTotal;
  if (Array.isArray(c.productIds)) out.productIds = (c.productIds as unknown[]).map(String);
  if (Array.isArray(c.categoryIds)) out.categoryIds = (c.categoryIds as unknown[]).map(String);
  if (Array.isArray(c.customerIds)) out.customerIds = (c.customerIds as unknown[]).map(String);
  return out;
}

// Regresa las reglas activas del negocio, separando con/sin código
async function fetchActiveRules(codes: string[] | undefined, negocioId?: string | null) {
  const now = new Date();
  const where: Prisma.DiscountRuleWhereInput = { isActive: true, ...(negocioId ? { negocioId } : {}) };
  // Traer todas y filtrar por vigencia en memoria
  const rules = await prisma.discountRule.findMany({ where });
  return rules
    .filter((r) => isWithin(now, r.startDate ?? undefined, r.endDate ?? undefined))
    .filter((r) => {
      const c = parseConditions(r.conditions);
      if (c.code) {
        // Si la regla exige código, solo aplica si el código está en la lista
        return Array.isArray(codes) && codes.some(code => String(code).toLowerCase() === String(c.code).toLowerCase());
      }
      // Sin código: aplica automáticamente si está activa
      return true;
    });
}

export async function applyDiscountsForSale(params: {
  tiendaId: string;
  products: DiscountApplicationInputProduct[];
  discountCodes?: string[];
}): Promise<DiscountApplicationResult> {
  const { tiendaId, products, discountCodes } = params;

  // Obtener negocioId de la tienda (si aplica)
  const tienda = await prisma.tienda.findUnique({ where: { id: tiendaId }, select: { negocioId: true } });
  const negocioId = tienda?.negocioId;

  const baseTotal = products.reduce((acc, p) => acc + (Number(p.precio) || 0) * (Number(p.cantidad) || 0), 0);

  const rules = await fetchActiveRules(discountCodes, negocioId);

  let discountTotal = 0;
  const applied: DiscountApplicationResultItem[] = [];
  const now = new Date();

  // Mapear productoTiendaId -> { productoId, categoriaId }
  const ids = Array.from(new Set(products.map(p => p.productoTiendaId))).filter(Boolean);
  const ptMap: Record<string, { productoId: string; categoriaId: string | null }> = {};
  if (ids.length > 0) {
    const pts = await prisma.productoTienda.findMany({
      where: { id: { in: ids } },
      select: { id: true, producto: { select: { id: true, categoriaId: true } } }
    });
    for (const pt of pts) {
      ptMap[pt.id] = { productoId: pt.producto.id, categoriaId: pt.producto.categoriaId };
    }
  }

  // Helpers de subtotal por ámbito
  const computeSubtotal = (rule: DiscountRuleModel) => {
    const conditions = parseConditions(rule.conditions);
    if (rule.appliesTo === 'TICKET') {
      return {
        subtotal: baseTotal,
        affectedItems: products.map((p) => ({ ...p }))
      };
    }
    if (rule.appliesTo === 'PRODUCT') {
      const productIds: string[] = Array.isArray(conditions.productIds) ? conditions.productIds.map(String) : [];
      if (productIds.length === 0) return { subtotal: 0, affectedItems: [] as DiscountApplicationInputProduct[] };
      const affected = products.filter((p) => {
        const map = ptMap[p.productoTiendaId];
        return map && productIds.includes(map.productoId);
      });
      const sub = affected.reduce((acc, p) => acc + (Number(p.precio) || 0) * (Number(p.cantidad) || 0), 0);
      return { subtotal: sub, affectedItems: affected };
    }
    if (rule.appliesTo === 'CATEGORY') {
      const categoryIds: string[] = Array.isArray(conditions.categoryIds) ? conditions.categoryIds.map(String) : [];
      if (categoryIds.length === 0) return { subtotal: 0, affectedItems: [] as DiscountApplicationInputProduct[] };
      const affected = products.filter((p) => {
        const map = ptMap[p.productoTiendaId];
        return map && map.categoriaId && categoryIds.includes(map.categoriaId);
      });
      const sub = affected.reduce((acc, p) => acc + (Number(p.precio) || 0) * (Number(p.cantidad) || 0), 0);
      return { subtotal: sub, affectedItems: affected };
    }
    // Otros ámbitos no implementados
    return { subtotal: 0, affectedItems: [] as DiscountApplicationInputProduct[] };
  };

  for (const rule of rules) {
    // Validaciones básicas
    if (!rule.isActive) continue;
    if (!isWithin(now, rule.startDate ?? undefined, rule.endDate ?? undefined)) continue;

    const conditions = parseConditions(rule.conditions);
    // mínimo aplicado sobre el ámbito correspondiente
    const { subtotal, affectedItems } = computeSubtotal(rule);
    if (typeof conditions.minTotal === 'number' && subtotal < conditions.minTotal) {
      continue;
    }

    let amount = 0;
    if (rule.type === 'PERCENTAGE') {
      const pct = Math.max(0, Math.min(100, Number(rule.value) || 0));
      amount = (subtotal * pct) / 100;
    } else if (rule.type === 'FIXED') {
      amount = Math.max(0, Number(rule.value) || 0);
      // El descuento fijo no puede exceder el subtotal afectado
      amount = Math.min(amount, subtotal);
    } else {
      // Otros tipos no implementados en MVP
      continue;
    }

    // No permitir exceder el total
    const remaining = Math.max(0, baseTotal - discountTotal);
    amount = Math.min(amount, remaining);

    if (amount <= 0) continue;

    discountTotal += amount;
    applied.push({
      discountRuleId: rule.id,
      amount,
      productsAffected: affectedItems.map(ai => ({ productoTiendaId: ai.productoTiendaId, cantidad: ai.cantidad })),
      ruleName: rule.name
    });
  }

  const finalTotal = Math.max(0, baseTotal - discountTotal);
  return { baseTotal, discountTotal, finalTotal, applied };
}
