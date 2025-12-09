import { prisma } from "@/lib/prisma";

export async function logDatabaseInfo() {
  console.log('=== DATABASE CONNECTION INFO ===');
  console.log('Database URL:', process.env.DATABASE_URL);
  console.log('Database Provider:', process.env.DATABASE_PROVIDER || 'Not specified');

  try {
    // Para PostgreSQL
    if (process.env.DATABASE_URL?.includes('postgresql')) {
      const result = await prisma.$queryRaw`SELECT version() as version, current_database() as database_name`;
      console.log('PostgreSQL Info:', result);
    }
    // Para MySQL
    else if (process.env.DATABASE_URL?.includes('mysql')) {
      const result = await prisma.$queryRaw`SELECT version() as version, database() as database_name`;
      console.log('MySQL Info:', result);
    }
    // Para SQLite
    else if (process.env.DATABASE_URL?.includes('sqlite')) {
      console.log('SQLite database detected');
      const result = await prisma.$queryRaw`SELECT sqlite_version() as version`;
      console.log('SQLite Info:', result);
    }

    // Información general de conexión
    console.log('Connection status: Connected');

  } catch (error) {
    console.error('Database connection error:', error);
  }

  console.log('================================');
}

export function logDatabaseUrl() {
  const dbUrl = process.env.DATABASE_URL;
  if (dbUrl) {
    // Ocultar password por seguridad
    const safeUrl = dbUrl.replace(/:[^:@]*@/, ':****@');
    console.log('Database URL (safe):', safeUrl);
  } else {
    console.log('DATABASE_URL not found in environment variables');
  }
}
