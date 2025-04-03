import { roles } from "@/utils/roles";
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcrypt";
import dotenv from 'dotenv';

dotenv.config();

const prisma = new PrismaClient();

async function initializeUsers() {
  try {
    console.log("⏳ Verificando usuarios en la base de datos...");

    // Obtener las contraseñas desde las variables de entorno
    const superAdminPass = process.env.SUPER_ADMIN_PASS;
    

    if (!superAdminPass) {
      throw new Error("⚠️ La contraseña de superadmin no está definida en el archivo .env");
    }

    // Verificar si el usuario ya existe
    const existingSuperAdmin = await prisma.usuario.findUnique({
      where: { usuario: "superadmin" },
    });

    // Si el superadmin no existe, crearlo
    if (!existingSuperAdmin) {
      console.log("🔹 Creando usuario superadmin...");
      await prisma.usuario.create({
        data: {
          usuario: "superadmin",
          password: await bcrypt.hash(superAdminPass, 10),
          rol: roles.SUPER_ADMIN,
          nombre: "Super Admin"
        },
      });
      console.log("✅ Usuario superadmin creado.");
    } else {
      console.log("⚠️ El usuario superadmin ya existe.");
    }

  } catch (error) {
    console.error("❌ Error al inicializar los usuarios:", error);
  } finally {
    await prisma.$disconnect();
  }
}

// Ejecutar la función
initializeUsers();
