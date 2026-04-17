import { prisma } from '@/lib/prisma';

export type LandingRegistrationConflict = 'email' | 'negocio' | 'both';

const LANDING_CONFLICT_MESSAGES: Record<LandingRegistrationConflict, string> = {
  email:
    'Este correo electrónico ya está registrado. Inicia sesión si ya tienes cuenta, o usa otro correo.',
  negocio: 'Ya existe un negocio con ese nombre. Elige otro nombre para tu negocio.',
  both:
    'El correo y el nombre del negocio ya están en uso. Usa otros datos o inicia sesión si ya tienes cuenta.',
};

export function landingConflictMessage(conflict: LandingRegistrationConflict): string {
  return LANDING_CONFLICT_MESSAGES[conflict];
}

/**
 * Comprueba si el correo (usuario) o el nombre del negocio ya existen en la base de datos.
 * El correo se compara en minúsculas; el nombre del negocio ignora mayúsculas/minúsculas.
 */
export async function getLandingRegistrationConflict(
  correo: string,
  nombreNegocio: string
): Promise<LandingRegistrationConflict | null> {
  const emailNorm = correo.trim().toLowerCase();
  const nombreTrim = nombreNegocio.trim();

  const [usuarioExistente, negocioExistente] = await Promise.all([
    prisma.usuario.findUnique({ where: { usuario: emailNorm } }),
    prisma.negocio.findFirst({
      where: {
        nombre: { equals: nombreTrim, mode: 'insensitive' },
      },
    }),
  ]);

  const emailTaken = Boolean(usuarioExistente);
  const negocioTaken = Boolean(negocioExistente);

  if (emailTaken && negocioTaken) return 'both';
  if (emailTaken) return 'email';
  if (negocioTaken) return 'negocio';
  return null;
}

export class LandingRegistrationConflictError extends Error {
  readonly conflict: LandingRegistrationConflict;

  constructor(conflict: LandingRegistrationConflict) {
    super(landingConflictMessage(conflict));
    this.name = 'LandingRegistrationConflictError';
    this.conflict = conflict;
  }
}
