import { NextRequest, NextResponse } from "next/server";
import getUserFromRequest from "@/utils/getUserFromRequest";
import permisos from "@/constants/permisos.json";

// GET - Obtener todos los permisos disponibles del sistema
export async function GET(request: NextRequest) {
  try {
    const user = await getUserFromRequest(request);
    if (!user) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    return NextResponse.json(permisos);
  } catch (error) {
    console.error("Error al obtener permisos:", error);
    return NextResponse.json(
      { error: "Error interno del servidor" },
      { status: 500 }
    );
  }
} 