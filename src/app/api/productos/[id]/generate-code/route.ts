import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { hasAdminPrivileges } from "@/utils/auth";
import getUserFromRequest from "@/utils/getUserFromRequest";
import generateEAN13 from "@/utils/generateProductCode";

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    if (!(await hasAdminPrivileges())) {
      return NextResponse.json({ error: "Acceso no autorizado" }, { status: 403 });
    }

    const user = await getUserFromRequest(req);
    const { id } = await params;
    const { codigo } = await req.json();

    // Verificar que el producto existe y pertenece al negocio
    const producto = await prisma.producto.findFirst({
      where: {
        id,
        negocioId: user.negocio.id
      }
    });

    if (!producto) {
      return NextResponse.json({ error: "Producto no encontrado" }, { status: 404 });
    }

    let codigoToSave = codigo;

    // Si no se proporciona código, generar uno automáticamente
    if (!codigoToSave) {
      // Obtener todos los códigos existentes
      const existingCodes = await prisma.codigoProducto.findMany({
        select: { codigo: true }
      });
      const codesSet = new Set(existingCodes.map(c => c.codigo));
      
      try {
        codigoToSave = generateEAN13(codesSet);
      } catch (error) {
        console.error("Error al generar código:", error);
        return NextResponse.json(
          { error: "No se pudo generar un código único" },
          { status: 500 }
        );
      }
    }

    // Crear el código
    const nuevoCodigo = await prisma.codigoProducto.create({
      data: {
        codigo: codigoToSave,
        productoId: id
      }
    });

    return NextResponse.json(nuevoCodigo, { status: 201 });
  } catch (error) {
    console.error("Error al generar código:", error);
    
    // Manejar error de código duplicado
    if (error.code === 'P2002') {
      return NextResponse.json(
        { error: "El código ya existe" },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { error: "Error al generar el código" },
      { status: 500 }
    );
  }
} 