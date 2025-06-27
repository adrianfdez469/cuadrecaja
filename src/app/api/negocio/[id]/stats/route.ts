import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { hasSuperAdminPrivileges } from "@/utils/auth";

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

export async function GET(
  req: NextRequest, 
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse<NegocioStats | { error: string }>> {
  try {
    // Verificar permisos de super admin
    if (!(await hasSuperAdminPrivileges())) {
      return NextResponse.json({ error: "Acceso denegado" }, { status: 403 });
    }

    const { id } = await params;
    
    // Verificar que el negocio existe
    const negocio = await prisma.negocio.findUnique({
      where: { id }
    });

    if (!negocio) {
      return NextResponse.json({ error: "Negocio no encontrado" }, { status: 404 });
    }

    // Obtener conteos actuales del negocio específico
    const [tiendasCount, usuariosCount, productosCount] = await Promise.all([
      // Contar tiendas del negocio
      prisma.tienda.count({
        where: { negocioId: id }
      }),
      
      // Contar usuarios del negocio (excluyendo SUPER_ADMIN)
      prisma.usuario.count({
        where: {
          negocioId: id,
          rol: { not: "SUPER_ADMIN" }
        }
      }),
      
      // Contar productos del negocio
      prisma.producto.count({
        where: { negocioId: id }
      })
    ]);

    // Calcular días restantes
    const now = new Date();
    const limitTime = new Date(negocio.limitTime);
    const diffTime = limitTime.getTime() - now.getTime();
    const diasRestantes = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    // Calcular porcentajes de uso
    const calcularPorcentaje = (actual: number, limite: number): number => {
      if (limite === -1) return 0; // Ilimitado
      return limite === 0 ? 100 : Math.round((actual / limite) * 100);
    };

    const stats: NegocioStats = {
      tiendas: {
        actual: tiendasCount,
        limite: negocio.locallimit,
        porcentaje: calcularPorcentaje(tiendasCount, negocio.locallimit)
      },
      usuarios: {
        actual: usuariosCount,
        limite: negocio.userlimit,
        porcentaje: calcularPorcentaje(usuariosCount, negocio.userlimit)
      },
      productos: {
        actual: productosCount,
        limite: negocio.productlimit,
        porcentaje: calcularPorcentaje(productosCount, negocio.productlimit)
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