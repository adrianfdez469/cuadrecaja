import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcrypt";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const secret = searchParams.get("secret");

  if (secret !== process.env.INIT_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
  }

  try {
    console.log("⏳ Verificando usuario superadmin en la base de datos...");

    const superAdminPass = process.env.SUPER_ADMIN_PASS;
    if (!superAdminPass) throw new Error("⚠️ No se encontró SUPER_ADMIN_PASS en el .env");

    const existingSuperAdmin = await prisma.usuario.findUnique({
      where: { usuario: "superadmin" },
    });

    if (!existingSuperAdmin) {
      console.log("🔹 Creando usuario superadmin...");
      await prisma.usuario.create({
        data: {
          usuario: "superadmin",
          password: await bcrypt.hash(superAdminPass, 10),
          rol: "SUPER_ADMIN",
          nombre: "Super Admin",
        },
      });
      console.log("✅ Usuario superadmin creado.");
      return NextResponse.json({ message: "Superadmin creado correctamente." });
    }

    console.log("⚠️ El usuario superadmin ya existe.");
    return NextResponse.json({ message: "Superadmin ya creado." });

  } catch (error) {
    console.error("❌ Error al inicializar el usuario superadmin:", error);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}
