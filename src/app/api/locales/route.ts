import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { hasAdminPrivileges } from "@/utils/auth";
import getUserFromRequest from "@/utils/getUserFromRequest";

// Obtener todas las categorías
export async function GET(req: Request) {

  const user = await getUserFromRequest(req);

  try {
    const tiendas = await prisma.tienda.findMany({
      include: {
        usuarios: {
           select: {
            usuario: {
              select: {
                id: true,
                nombre: true,
                usuario: true,
                rol: true
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
      usuarios: tienda.usuarios.map(u => u.usuario)
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

    const { nombre, tipo, idusuarios } = await request.json();
    console.log(idusuarios);
    
    const newTienda = await prisma.tienda.create({
      data: {
        nombre,
        tipo: tipo || "TIENDA",
        usuarios: {
          create: idusuarios.map((usuarioId: string) => ({
            usuario: { connect: { id: usuarioId } },
          })),
        },
        negocioId: user.negocio.id
      }
    });


    return NextResponse.json(newTienda, { status: 201 });
  } catch (error) {
    console.log(error);
    return NextResponse.json(
      { error: "Error al crear la tienda" },
      { status: 500 }
    );
  }
}
