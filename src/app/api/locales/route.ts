import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { hasAdminPrivileges } from "@/utils/auth";
import getUserFromRequest from "@/utils/getUserFromRequest";

// Obtener todas las tiendas con usuarios y roles
export async function GET(req: Request) {
  const user = await getUserFromRequest(req);

  try {
    const tiendas = await prisma.tienda.findMany({
      include: {
        usuarios: {
          include: {
            usuario: {
              select: {
                id: true,
                nombre: true,
                usuario: true,
                rol: true
              }
            },
            rol: {
              select: {
                id: true,
                nombre: true,
                descripcion: true
              }
            }
          }
        }
      },
      where: {
        negocioId: user.negocio.id
      }
    });
    
    const tiendasFormateadas = tiendas.map(tienda => ({
      ...tienda,
      usuarios: tienda.usuarios.map(u => u.usuario), // Mantener compatibilidad
      usuariosTiendas: tienda.usuarios // Nueva estructura con roles
    }));
    
    return NextResponse.json(tiendasFormateadas);
  } catch (error) {
    console.log(error);
    return NextResponse.json(
      { error: "Error al obtener tiendas" },
      { status: 500 }
    );
  }
}

// Crear una nueva tienda
export async function POST(request: Request) {
  try {
    if (!(await hasAdminPrivileges())) {
      return NextResponse.json(
        { error: "Acceso no autorizado" },
        { status: 403 }
      );
    }

    const user = await getUserFromRequest(request);

    const tiendasCounter = await prisma.tienda.count({
      where: {
        negocioId: user.negocio.id
      }
    })

    if(user.negocio.locallimit <= tiendasCounter ) {
      return NextResponse.json(
        { error: "Limite de tiendas exedido" },
        { status: 400 }
      );
    }

    const { nombre, tipo, usuariosRoles } = await request.json();
    console.log('usuariosRoles:', usuariosRoles);
    
    const newLocal = await prisma.tienda.create({
      data: {
        nombre: nombre.trim(),
        tipo: tipo || "TIENDA",
        usuarios: {
          create: usuariosRoles.map((item: { usuarioId: string, rolId?: string }) => ({
            usuario: { connect: { id: item.usuarioId } },
            ...(item.rolId && { rol: { connect: { id: item.rolId } } })
          })),
        },
        negocioId: user.negocio.id
      }
    });

    return NextResponse.json(newLocal, { status: 201 });
  } catch (error) {
    console.log(error);
    return NextResponse.json(
      { error: "Error al crear la tienda" },
      { status: 500 }
    );
  }
}
