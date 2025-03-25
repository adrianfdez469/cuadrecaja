import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { isAdmin } from "@/utils/auth";

// Obtener todas las categorías
export async function GET() {
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
    });
    console.log(tiendas);
    const tiendasFormateadas = tiendas.map(tienda => ({
      ...tienda,
      usuarios: tienda.usuarios.map(u => u.usuario)
    }));
    
    return NextResponse.json(tiendasFormateadas);
  } catch (error) {
    return NextResponse.json(
      { error: "Error al obtener tiendas" },
      { status: 500 }
    );
  }
}

// Crear una nueva tienda
export async function POST(request: Request) {
  try {
    if (!(await isAdmin())) {
      return NextResponse.json(
        { error: "Acceso no autorizado" },
        { status: 403 }
      );
    }

    const { nombre, idusuarios } = await request.json();
    console.log(idusuarios);
    
    const newTienda = await prisma.tienda.create({
      data: {
        nombre,
        usuarios: {
          create: idusuarios.map((usuarioId: string) => ({
            usuario: { connect: { id: usuarioId } },
          })),
        },
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
