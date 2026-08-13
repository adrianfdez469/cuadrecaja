import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();

const ventas = await prisma.venta.findMany({
  where: {},
  select: {
    id: true,
    createdAt: true,
    total: true,
    tipTotal: true,
    vueltoDetalle: true,
    tiendaId: true,
  },
  orderBy: { createdAt: "desc" },
  take: 8,
});

for (const v of ventas) {
  console.log(
    v.id.slice(0, 8),
    v.createdAt.toISOString().slice(0, 16),
    "total",
    v.total,
    "| propina",
    v.tipTotal,
    "| vuelto",
    JSON.stringify(v.vueltoDetalle),
  );
}
console.log("total con vuelto o propina:", ventas.length);

await prisma.$disconnect();
