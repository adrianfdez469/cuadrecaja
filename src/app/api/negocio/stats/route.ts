import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import getUserFromRequest from "@/utils/getUserFromRequest";

export interface NegocioStats {
  tiendas: {
    actual: number;
    limite: number;
    porcentaje: number;
  };
  usuarios: {
    actual: number;
    limite: number;
    porcentaje: number;
  };
  productos: {
    actual: number;
    limite: number;
    porcentaje: number;
  };
  fechaVencimiento: Date;
  diasRestantes: number;
}

export async function GET(req: Request): Promise<NextResponse<NegocioStats | { error: string }>> {
  try {
    const user = await getUserFromRequest(req);
    
    if (!user?.negocio) {
      return NextResponse.json({ error: "Negocio no encontrado" }, { status: 404 });
    }

    // Obtener conteos actuales y límites del plan desde la BD
    const negocio = await prisma.negocio.findUnique({
      where: { id: user.negocio.id },
      select: {
        usuarios: {
          select: {
            rol: true
          }
        },
        _count: {
          select: {
            tiendas: true,
            productos: true
          }
        },
        plan: {
          select: {
            limiteLocales: true,
            limiteUsuarios: true,
            limiteProductos: true
          }
        }
      },
    });

    const locallimit = negocio.plan?.limiteLocales ?? -1;
    const userlimit = negocio.plan?.limiteUsuarios ?? -1;
    const productlimit = negocio.plan?.limiteProductos ?? -1;

    // Calcular días restantes
    const now = new Date();
    const limitTime = new Date(user.negocio.limitTime);
    const diffTime = limitTime.getTime() - now.getTime();
    const diasRestantes = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    // Calcular porcentajes de uso
    const calcularPorcentaje = (actual: number, limite: number): number => {
      if (limite === -1) return 0; // Ilimitado
      return limite === 0 ? 100 : Math.round((actual / limite) * 100);
    };

    const tiendasCount = negocio._count.tiendas;
    const usuariosCount = negocio.usuarios.filter((usuario) => usuario.rol !== "SUPER_ADMIN").length;
    const productosCount = negocio._count.productos;

    const stats: NegocioStats = {
      tiendas: {
        actual: tiendasCount,
        limite: locallimit,
        porcentaje: calcularPorcentaje(tiendasCount, locallimit)
      },
      usuarios: {
        actual: usuariosCount,
        limite: userlimit,
        porcentaje: calcularPorcentaje(usuariosCount, userlimit)
      },
      productos: {
        actual: productosCount,
        limite: productlimit,
        porcentaje: calcularPorcentaje(productosCount, productlimit)
      },
      fechaVencimiento: limitTime,
      diasRestantes
    };

    return NextResponse.json(stats);
  } catch (error) {
    console.error("Error al obtener estadísticas del negocio:", error);
    return NextResponse.json(
      { error: "Error al obtener estadísticas del negocio" },
      { status: 500 }
    );
  }
} 