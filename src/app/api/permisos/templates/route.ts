import { NextResponse } from "next/server";
import { permisosTemplates } from "@/constants/permisos/permisos.templates";

// GET - Obtener todos los permisos disponibles del sistema
export async function GET() {
  try {

    return NextResponse.json(permisosTemplates);
  } catch (error) {
    console.error("Error al obtener permisos:", error);
    return NextResponse.json(
      { error: "Error interno del servidor" },
      { status: 500 }
    );
  }
} 