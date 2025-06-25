import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import getUserFromRequest from "@/utils/getUserFromRequest";

// Obtener tiendas disponibles para el usuario actual
export async function GET(req: Request) {
  try {
    const user = await getUserFromRequest(req);

    let tiendas;
    
    if (user.rol === "SUPER_ADMIN") {
      // Los SUPER_ADMIN pueden acceder a todas las tiendas del negocio
      tiendas = await prisma.tienda.findMany({
        where: {
          negocioId: user.negocio.id
        },
        select: {
          id: true,
          nombre: true,
          negocioId: true,
          tipo: true
        },
        orderBy: {
          nombre: 'asc'
        }
      });
    } else {
      // Otros usuarios solo pueden acceder a sus tiendas asociadas
      const usuarioConTiendas = await prisma.usuario.findUnique({
        where: { id: user.id },
        include: {
          tiendas: {
            include: {
              tienda: {
                select: {
                  id: true,
                  nombre: true,
                  negocioId: true,
                  tipo: true
                }
              }
            }
          }
        }
      });

      tiendas = usuarioConTiendas?.tiendas.map(ut => ut.tienda) || [];
    }

    return NextResponse.json(tiendas);
  } catch (error) {
    console.log(error);
    return NextResponse.json(
      { error: "Error al obtener tiendas disponibles" },
      { status: 500 }
    );
  }
} 