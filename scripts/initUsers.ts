import { PrismaClient } from "@prisma/client";
import bcrypt from "bcrypt";
import dotenv from 'dotenv';

dotenv.config();

const prisma = new PrismaClient();

async function initializeUsers() {
  try {
    console.log("⏳ Verificando usuarios en la base de datos...");

    // Obtener las contraseñas desde las variables de entorno
    const alePassword = process.env.ALE_PASSWORD;
    const olquitaPassword = process.env.OLGRUITA_PASSWORD;
    const dislyPassword = process.env.DISLY_PASSWORD;
    const yoendryPassword = process.env.YOENDRY_PASSWORD;

    if (!alePassword || !olquitaPassword || !dislyPassword || !yoendryPassword) {
      throw new Error("⚠️ Las contraseñas no están definidas en el archivo .env");
    }

    // Verificar si los usuarios ya existen
    const existingAlejandro = await prisma.usuario.findUnique({
      where: { usuario: "alejandro" },
    });

    const existingOlguita = await prisma.usuario.findUnique({
      where: { usuario: "olguita" },
    });

    const existingDisly = await prisma.usuario.findUnique({
      where: { usuario: "disly" },
    });

    const existingYoendry = await prisma.usuario.findUnique({
      where: { usuario: "yoendry" },
    });

    // Si el admin no existe, crearlo
    if (!existingAlejandro) {
      console.log("🔹 Creando usuario alejandro...");
      await prisma.usuario.create({
        data: {
          usuario: "alejandro",
          password: await bcrypt.hash(alePassword, 10), // Cambia esto por una mejor clave en producción
          rol: "ADMIN",
          nombre: "Alejandro"
        },
      });
      console.log("✅ Usuario alejandro creado.");
    } else {
      console.log("⚠️ El usuario alejandro ya existe.");
    }

    // Si el vendedor olguita no existe, crearlo
    if (!existingOlguita) {
      console.log("🔹 Creando usuario olguita...");
      await prisma.usuario.create({
        data: {
          usuario: "olguita",
          password: await bcrypt.hash(olquitaPassword, 10), // Cambia esto en producción
          rol: "VENDEDOR",
          nombre: "olguita"
        },
      });
      console.log("✅ Usuario olguita creado.");
    } else {
      console.log("⚠️ El usuario olguita ya existe.");
    }

    // Si el vendedor disly no existe, crearlo
    if (!existingDisly) {
      console.log("🔹 Creando usuario disly...");
      await prisma.usuario.create({
        data: {
          usuario: "disly",
          password: await bcrypt.hash(dislyPassword, 10), // Cambia esto en producción
          rol: "VENDEDOR",
          nombre: "disly"
        },
      });
      console.log("✅ Usuario disly creado.");
    } else {
      console.log("⚠️ El usuario disly ya existe.");
    }

    // Si el vendedor yoendry no existe, crearlo
    if (!existingYoendry) {
      console.log("🔹 Creando usuario yoendry...");
      await prisma.usuario.create({
        data: {
          usuario: "yoendry",
          password: await bcrypt.hash(yoendryPassword, 10), // Cambia esto en producción
          rol: "VENDEDOR",
          nombre: "yoendry"
        },
      });
      console.log("✅ Usuario yoendry creado.");
    } else {
      console.log("⚠️ El usuario yoendry ya existe.");
    }

  } catch (error) {
    console.error("❌ Error al inicializar los usuarios:", error);
  } finally {
    await prisma.$disconnect();
  }
}

// Ejecutar la función
initializeUsers();
