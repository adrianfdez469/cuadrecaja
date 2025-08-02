import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/utils/auth";
import generateEAN13 from "@/utils/generateProductCode";
import { verificarPermisoUsuario } from "@/utils/permisos_back";

export async function POST(req: NextRequest) {
  try {
    const session = await getSession();
    const user = session.user;

    if (!verificarPermisoUsuario(user.permisos, "configuracion.productos.generar_codigo", user.rol)) {
      return NextResponse.json(
        { error: "Acceso no autorizado" },
        { status: 403 }
      );
    }
    const { codes } = await req.json();

    if (!codes || !Array.isArray(codes) || codes.length === 0) {
      return NextResponse.json({ error: "Entrada inválida" }, { status: 400 });
    }

    // Obtener todos los códigos existentes para evitar duplicados
    const existingCodes = await prisma.codigoProducto.findMany({
      select: { codigo: true }
    });
    const codesSet = new Set(existingCodes.map(c => c.codigo));

    const results = [];
    const errors = [];

    // Procesar cada producto
    for (const item of codes) {
      const { productoId, codigo } = item;

      try {
        // Verificar que el producto existe y pertenece al negocio
        const producto = await prisma.producto.findFirst({
          where: {
            id: productoId,
            negocioId: user.negocio.id
          }
        });

        if (!producto) {
          errors.push({
            productoId,
            error: "Producto no encontrado"
          });
          continue;
        }

        let codigoToSave = codigo;

        // Si no se proporciona código, generar uno automáticamente
        if (!codigoToSave) {
          try {
            codigoToSave = generateEAN13(codesSet);
            codesSet.add(codigoToSave); // Agregar al set para evitar duplicados en la misma operación
          } catch (error) {
            console.error("Error al generar código:", error);
            errors.push({
              productoId,
              error: "No se pudo generar un código único"
            });
            continue;
          }
        }

        // Crear el código
        const nuevoCodigo = await prisma.codigoProducto.create({
          data: {
            codigo: codigoToSave,
            productoId
          }
        });

        results.push({
          productoId,
          codigo: nuevoCodigo
        });

      } catch (error) {
        console.error(`Error procesando producto ${productoId}:`, error);
        
        // Manejar error de código duplicado
        if (error.code === 'P2002') {
          errors.push({
            productoId,
            error: "El código ya existe"
          });
        } else {
          errors.push({
            productoId,
            error: "Error al generar el código"
          });
        }
      }
    }

    return NextResponse.json({
      success: results,
      errors: errors,
      summary: {
        total: codes.length,
        success: results.length,
        errors: errors.length
      }
    }, { status: 200 });

  } catch (error) {
    console.error("Error al generar códigos:", error);
    return NextResponse.json(
      { error: "Error interno del servidor" },
      { status: 500 }
    );
  }
} 