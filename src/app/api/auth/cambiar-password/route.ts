import { getServerSession } from "next-auth";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { authOptions } from "@/utils/authOptions";
import bcrypt from "bcrypt";

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);

  if (!session || !session.user?.id) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  try {
    const body = await req.json();
    const { currentPassword, newPassword } = body;

    // Validaciones básicas
    if (!currentPassword || !newPassword) {
      return NextResponse.json(
        { error: "Contraseña actual y nueva contraseña son requeridas" },
        { status: 400 }
      );
    }

    // Validar que la nueva contraseña cumpla con los requisitos
    if (newPassword.length < 8) {
      return NextResponse.json(
        { error: "La nueva contraseña debe tener al menos 8 caracteres" },
        { status: 400 }
      );
    }

    if (!/[A-Z]/.test(newPassword) || !/[a-z]/.test(newPassword) || !/[0-9]/.test(newPassword)) {
      return NextResponse.json(
        { error: "La nueva contraseña debe contener mayúsculas, minúsculas y números" },
        { status: 400 }
      );
    }

    // Obtener el usuario actual
    const user = await prisma.usuario.findUnique({
      where: { id: session.user.id },
      select: { id: true, password: true }
    });

    if (!user) {
      return NextResponse.json({ error: "Usuario no encontrado" }, { status: 404 });
    }

    // Verificar la contraseña actual
    const isCurrentPasswordValid = await bcrypt.compare(currentPassword, user.password);
    if (!isCurrentPasswordValid) {
      return NextResponse.json(
        { error: "La contraseña actual es incorrecta" },
        { status: 400 }
      );
    }

    // Verificar que la nueva contraseña sea diferente
    const isSamePassword = await bcrypt.compare(newPassword, user.password);
    if (isSamePassword) {
      return NextResponse.json(
        { error: "La nueva contraseña debe ser diferente a la actual" },
        { status: 400 }
      );
    }

    // Encriptar la nueva contraseña
    const saltRounds = 12;
    const hashedNewPassword = await bcrypt.hash(newPassword, saltRounds);

    // Actualizar la contraseña en la base de datos
    await prisma.usuario.update({
      where: { id: session.user.id },
      data: { password: hashedNewPassword }
    });

    return NextResponse.json(
      { message: "Contraseña actualizada exitosamente" },
      { status: 200 }
    );

  } catch (error) {
    console.error("Error al cambiar contraseña:", error);
    return NextResponse.json(
      { error: "Error interno del servidor" },
      { status: 500 }
    );
  }
} 