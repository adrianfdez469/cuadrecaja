import { prisma } from '@/lib/prisma';
import bcrypt from 'bcrypt';

const MAX_LOCALES_ONBOARDING = 19;

export interface IOnboardingInput {
  nombre: string;
  nombreNegocio: string;
  correo: string;
  telefono: string;
  /** Cantidad de tiendas a crear (1–19). */
  numeroLocales: number;
}

export interface IOnboardingResult {
  usuario: string;
  passwordTemporal: string;
  negocio: string;
}

function generarPasswordTemporal(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789';
  return Array.from({ length: 10 }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
}

export async function initializeNegocio(input: IOnboardingInput): Promise<IOnboardingResult> {
  const { nombre, nombreNegocio, correo } = input;
  const count = Math.min(
    MAX_LOCALES_ONBOARDING,
    Math.max(1, Math.floor(Number(input.numeroLocales)) || 1)
  );

  const passwordTemporal = generarPasswordTemporal();
  const passwordHash = await bcrypt.hash(passwordTemporal, 10);

  const limitTime = new Date(Date.now() + 1000 * 60 * 60 * 24 * 7); // 7 días

  const freemiumPlan = await prisma.plan.findFirst({
    where: { activo: true },
    orderBy: { precio: 'asc' },
  });

  await prisma.$transaction(async (tx) => {
    const negocio = await tx.negocio.create({
      data: {
        nombre: nombreNegocio,
        limitTime,
        planId: freemiumPlan?.id ?? null,
        creadoPorActivacionLanding: true,
      },
    });

    const tiendas: { id: string }[] = [];
    for (let i = 0; i < count; i++) {
      const nombreTienda = i === 0 ? 'Principal' : `Local ${i + 1}`;
      const t = await tx.tienda.create({
        data: {
          nombre: nombreTienda,
          negocioId: negocio.id,
          tipo: 'tienda',
        },
      });
      tiendas.push(t);
    }

    const rol = await tx.rol.findFirst({
      where: { isGlobal: true, nombre: 'Administrador' },
    });
    if (!rol) throw new Error('Rol global Administrador no encontrado. Verifique que la migración de roles globales se haya aplicado correctamente.');

    const usuario = await tx.usuario.create({
      data: {
        nombre,
        usuario: correo,
        password: passwordHash,
        negocioId: negocio.id,
        localActualId: tiendas[0].id,
        isActive: true,
      },
    });

    for (const t of tiendas) {
      await tx.usuarioTienda.create({
        data: {
          usuarioId: usuario.id,
          tiendaId: t.id,
          rolId: rol.id,
        },
      });
    }
  });

  return {
    usuario: correo,
    passwordTemporal,
    negocio: nombreNegocio,
  };
}
