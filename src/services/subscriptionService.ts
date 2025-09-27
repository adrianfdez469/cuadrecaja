import { prisma } from '@/lib/prisma';
import { NotificationService } from './notificationService';

export interface SubscriptionStatus {
  isActive: boolean;
  daysRemaining: number;
  isExpired: boolean;
  isSuspended: boolean;
  canRenew: boolean;
  gracePeriodDays: number;
}

export class SubscriptionService {
  /**
   * Verificar el estado de suscripción de un negocio
   */
  static async getSubscriptionStatus(negocioId: string): Promise<SubscriptionStatus> {
    const negocio = await prisma.negocio.findUnique({
      where: { id: negocioId }
    });

    if (!negocio) {
      throw new Error('Negocio no encontrado');
    }

    const now = new Date();
    const limitTime = new Date(negocio.limitTime);
    const diffTime = limitTime.getTime() - now.getTime();
    const daysRemaining = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    
    const isExpired = daysRemaining <= 0;
    const gracePeriodDays = 7; // Período de gracia de 7 días
    const isInGracePeriod = daysRemaining > -gracePeriodDays;
    const isSuspended = isExpired && !isInGracePeriod;
    const canRenew = isExpired || daysRemaining <= 3;

    return {
      isActive: !isExpired,
      daysRemaining,
      isExpired,
      isSuspended,
      canRenew,
      gracePeriodDays
    };
  }

  /**
   * Suspender un negocio (manual o automáticamente)
   */
  static async suspendBusiness(negocioId: string, forceManual = false): Promise<void> {
    try {
      // 1. Marcar el negocio como suspendido
      const negocioActualizado = await prisma.negocio.update({
        where: { id: negocioId },
        data: {
          suspended: true,
          suspendedAt: new Date()
        }
      });

      // 2. Deshabilitar acceso de usuarios (excepto SUPER_ADMIN)
      await prisma.usuario.updateMany({
        where: {
          negocioId,
          rol: { not: 'SUPER_ADMIN' }
        },
        data: {
          isActive: false
        }
      });

      // 3. Crear notificación crítica
      const tituloSuspension = forceManual ? `SUSPENSIÓN MANUAL - ${negocioActualizado.nombre}` : `SUSPENSIÓN AUTOMÁTICA - ${negocioActualizado.nombre}`;
      const descripcionSuspension = forceManual 
        ? `El negocio ha sido suspendido manualmente por un administrador. Todos los usuarios han sido deshabilitados y el acceso al sistema está restringido.`
        : `El negocio ha sido suspendido automáticamente debido al vencimiento de su suscripción. Todos los usuarios han sido deshabilitados y el acceso al sistema está restringido.`;

      await NotificationService.createAutomaticNotification({
        titulo: tituloSuspension,
        descripcion: descripcionSuspension,
        fechaInicio: new Date(),
        fechaFin: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 días
        nivelImportancia: 'CRITICA',
        tipo: 'ALERTA',
        negociosDestino: negocioId
      });

      console.log(`Negocio ${negocioActualizado.nombre} suspendido automáticamente`);
    } catch (error) {
      console.error('Error al suspender negocio:', error);
      throw error;
    }
  }

  /**
   * Reactivar un negocio
   */
  static async reactivateBusiness(negocioId: string, newLimitTime: Date): Promise<void> {
    try {
      // 1. Actualizar fecha de vencimiento
     const negocioActualizado = await prisma.negocio.update({
        where: { id: negocioId },
        data: {
          limitTime: newLimitTime,
          suspended: false,
          suspendedAt: null
        }
      });

      // 2. Reactivar usuarios
      await prisma.usuario.updateMany({
        where: {
          negocioId,
          rol: { not: 'SUPER_ADMIN' }
        },
        data: {
          isActive: true
        }
      });

      // 3. Crear notificación de reactivación
      await NotificationService.createAutomaticNotification({
        titulo: `REACTIVACIÓN EXITOSA - ${negocioActualizado.nombre}`,
        descripcion: `El negocio ha sido reactivado exitosamente. Todos los usuarios pueden acceder al sistema nuevamente.`,
        fechaInicio: new Date(),
        fechaFin: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 días
        nivelImportancia: 'MEDIA',
        tipo: 'NOTIFICACION',
        negociosDestino: negocioId
      });

      console.log(`Negocio ${negocioActualizado.nombre} reactivado`);
    } catch (error) {
      console.error('Error al reactivar negocio:', error);
      throw error;
    }
  }

  /**
   * Verificar y procesar suspensiones automáticas
   */
  static async checkAndProcessSuspensions(): Promise<void> {
    try {
      const now = new Date();
      const gracePeriodDays = 7;
      const gracePeriodDate = new Date(now.getTime() - gracePeriodDays * 24 * 60 * 60 * 1000);

      // Buscar negocios que han expirado y están fuera del período de gracia
      const expiredBusinesses = await prisma.negocio.findMany({
        where: {
          limitTime: {
            lt: gracePeriodDate
          },
          suspended: false // Agregar cuando se implemente el campo
        }
      });

      console.log(`Encontrados ${expiredBusinesses.length} negocios para suspender`);

      for (const negocio of expiredBusinesses) {
        await this.suspendBusiness(negocio.id);
      }

      // Verificar negocios en período de gracia
      const gracePeriodBusinesses = await prisma.negocio.findMany({
        where: {
          limitTime: {
            gte: gracePeriodDate,
            lt: now
          },
          suspended: false
        }
      });

      console.log(`Encontrados ${gracePeriodBusinesses.length} negocios en período de gracia`);

      for (const negocio of gracePeriodBusinesses) {
        await this.processGracePeriodNotification(negocio);
      }

    } catch (error) {
      console.error('Error al procesar suspensiones automáticas:', error);
    }
  }

  /**
   * Procesar notificación de período de gracia
   */
  private static async processGracePeriodNotification(negocio: any): Promise<void> {
    const now = new Date();
    const limitTime = new Date(negocio.limitTime);
    const diffTime = limitTime.getTime() - now.getTime();
    const daysExpired = Math.abs(Math.ceil(diffTime / (1000 * 60 * 60 * 24)));

    const titulo = `PERÍODO DE GRACIA - ${negocio.nombre}`;
    const descripcion = `Su suscripción expiró hace ${daysExpired} día${daysExpired !== 1 ? 's' : ''}. Está en período de gracia de 7 días. Después de este período, su cuenta será suspendida automáticamente.`;

    const notificacionExistente = await NotificationService.findExistingNotification(titulo, negocio.id);
    
    if (!notificacionExistente) {
      await NotificationService.createAutomaticNotification({
        titulo,
        descripcion,
        fechaInicio: now,
        fechaFin: new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000),
        nivelImportancia: 'ALTA',
        tipo: 'ALERTA',
        negociosDestino: negocio.id
      });
    }
  }

  /**
   * Obtener estadísticas de suscripciones
   */
  static async getSubscriptionStats(): Promise<{
    total: number;
    active: number;
    expired: number;
    suspended: number;
    gracePeriod: number;
  }> {
    const now = new Date();
    const gracePeriodDays = 7;
    const gracePeriodDate = new Date(now.getTime() - gracePeriodDays * 24 * 60 * 60 * 1000);

    const [total, active, expired, suspended] = await Promise.all([
      prisma.negocio.count(),
      prisma.negocio.count({
        where: {
          limitTime: { gt: now }
        }
      }),
      prisma.negocio.count({
        where: {
          limitTime: {
            gte: gracePeriodDate,
            lt: now
          }
        }
      }),
      prisma.negocio.count({
        where: {
          limitTime: { lt: gracePeriodDate }
        }
      })
    ]);

    return {
      total,
      active,
      expired,
      suspended,
      gracePeriod: expired
    };
  }

  /**
   * Activar un negocio suspendido (incluso con días restantes)
   */
  static async activateBusiness(negocioId: string): Promise<void> {
    try {
      const negocioActualizado = await prisma.negocio.update({
        where: { id: negocioId },
        data: {
          suspended: false,
          suspendedAt: null
        }
      });

      // Reactivar usuarios
      await prisma.usuario.updateMany({
        where: {
          negocioId,
          rol: { not: 'SUPER_ADMIN' }
        },
        data: {
          isActive: true
        }
      });

      // Crear notificación de activación
      await NotificationService.createAutomaticNotification({
        titulo: `NEGOCIO ACTIVADO - ${negocioActualizado.nombre}`,
        descripcion: `El negocio ha sido activado manualmente. Todos los usuarios pueden acceder al sistema nuevamente.`,
        fechaInicio: new Date(),
        fechaFin: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 días
        nivelImportancia: 'MEDIA',
        tipo: 'NOTIFICACION',
        negociosDestino: negocioId
      });

      console.log(`Negocio ${negocioActualizado.nombre} activado manualmente`);
    } catch (error) {
      console.error('Error al activar negocio:', error);
      throw error;
    }
  }

  /**
   * Establecer fecha de expiración específica
   */
  static async setExpirationDate(negocioId: string, newExpirationDate: Date): Promise<void> {
    try {
      const negocio = await prisma.negocio.findUnique({
        where: { id: negocioId }
      });

      if (!negocio) {
        throw new Error('Negocio no encontrado');
      }

      const negocioActualizado = await prisma.negocio.update({
        where: { id: negocioId },
        data: {
          limitTime: newExpirationDate,
          suspended: false,
          suspendedAt: null
        }
      });

      // Reactivar usuarios si estaban suspendidos
      await prisma.usuario.updateMany({
        where: {
          negocioId,
          rol: { not: 'SUPER_ADMIN' }
        },
        data: {
          isActive: true
        }
      });

      // Crear notificación
      await NotificationService.createAutomaticNotification({
        titulo: `FECHA DE EXPIRACIÓN ACTUALIZADA - ${negocioActualizado.nombre}`,
        descripcion: `La fecha de expiración del negocio ha sido establecida para el ${newExpirationDate.toLocaleDateString()}`,
        fechaInicio: new Date(),
        fechaFin: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        nivelImportancia: 'MEDIA',
        tipo: 'NOTIFICACION',
        negociosDestino: negocioId
      });

      console.log(`Fecha de expiración del negocio ${negocioActualizado.nombre} actualizada a ${newExpirationDate.toLocaleDateString()}`);
    } catch (error) {
      console.error('Error al establecer fecha de expiración:', error);
      throw error;
    }
  }

  /**
   * Extender suscripción
   */
  static async extendSubscription(negocioId: string, daysToAdd: number): Promise<void> {
    const negocio = await prisma.negocio.findUnique({
      where: { id: negocioId }
    });

    if (!negocio) {
      throw new Error('Negocio no encontrado');
    }

    const currentLimitTime = new Date(negocio.limitTime);
    const newLimitTime = new Date(currentLimitTime.getTime() + daysToAdd * 24 * 60 * 60 * 1000);

    await prisma.negocio.update({
      where: { id: negocioId },
      data: {
        limitTime: newLimitTime
      }
    });

    // Crear notificación de extensión
    await NotificationService.createAutomaticNotification({
      titulo: `SUSCRIPCIÓN EXTENDIDA - ${negocio.nombre}`,
      descripcion: `Su suscripción ha sido extendida por ${daysToAdd} día${daysToAdd !== 1 ? 's' : ''}. Nueva fecha de vencimiento: ${newLimitTime.toLocaleDateString()}`,
      fechaInicio: new Date(),
      fechaFin: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      nivelImportancia: 'MEDIA',
      tipo: 'NOTIFICACION',
      negociosDestino: negocioId
    });
  }
}
