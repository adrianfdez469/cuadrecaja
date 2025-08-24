import { prisma } from "@/lib/prisma";

export interface NotificationData {
  titulo: string;
  descripcion: string;
  fechaInicio: Date;
  fechaFin: Date;
  nivelImportancia: 'BAJA' | 'MEDIA' | 'ALTA' | 'CRITICA';
  tipo: 'ALERTA' | 'NOTIFICACION' | 'PROMOCION' | 'MENSAJE';
  negociosDestino?: string;
  usuariosDestino?: string;
}

export class NotificationService {
  /**
   * Crear una notificación automática
   */
  static async createAutomaticNotification(data: NotificationData) {
    try {
      const notificacion = await prisma.notificacion.create({
        data: {
          titulo: data.titulo,
          descripcion: data.descripcion,
          fechaInicio: data.fechaInicio,
          fechaFin: data.fechaFin,
          nivelImportancia: data.nivelImportancia,
          tipo: data.tipo,
          negociosDestino: data.negociosDestino || "",
          usuariosDestino: data.usuariosDestino || "",
          leidoPor: ""
        }
      });

      console.log(`Notificación automática creada: ${notificacion.titulo}`);
      return notificacion;
    } catch (error) {
      console.error('Error al crear notificación automática:', error);
      throw error;
    }
  }

  /**
   * Buscar notificación existente por título y negocio
   */
  static async findExistingNotification(titulo: string, negocioId?: string) {
    const whereClause: any = {
      titulo: {
        contains: titulo
      },
      fechaFin: {
        gte: new Date()
      }
    };

    if (negocioId) {
      whereClause.negociosDestino = negocioId;
    }

    return await prisma.notificacion.findFirst({
      where: whereClause
    });
  }

  /**
   * Actualizar notificación existente y marcar como no leída
   */
  static async updateNotification(notificationId: string, data: Partial<NotificationData>) {
    try {
      const notificacion = await prisma.notificacion.update({
        where: { id: notificationId },
        data: {
          ...data,
          leidoPor: "", // Marcar como no leída por todos
          updatedAt: new Date()
        }
      });

      console.log(`Notificación actualizada: ${notificacion.titulo}`);
      return notificacion;
    } catch (error) {
      console.error('Error al actualizar notificación:', error);
      throw error;
    }
  }

  /**
   * Eliminar notificación
   */
  static async deleteNotification(notificationId: string) {
    try {
      await prisma.notificacion.delete({
        where: { id: notificationId }
      });

      console.log(`Notificación eliminada: ${notificationId}`);
    } catch (error) {
      console.error('Error al eliminar notificación:', error);
      throw error;
    }
  }

  /**
   * Verificar y crear/actualizar/eliminar notificaciones de expiración de suscripción
   */
  static async checkSubscriptionExpiration(negocioId?: string) {
    try {
      const ahora = new Date();
      const sieteDias = new Date(ahora.getTime() + 7 * 24 * 60 * 60 * 1000);

      if (!negocioId) {
        // Procesar todos los negocios
        const negociosExpirando = await prisma.negocio.findMany({
          where: {
            limitTime: {
              gte: ahora,
              lte: sieteDias
            }
          }
        });

        for (const negocio of negociosExpirando) {
          await this.processSubscriptionExpiration(negocio);
        }
      } else {
        // Procesar negocio específico
        const negocio = await prisma.negocio.findUnique({
          where: { id: negocioId }
        });

        if (negocio) {
          await this.processSubscriptionExpiration(negocio);
        } else {
          console.log('Negocio no encontrado:', negocioId);
        }
      }
    } catch (error) {
      console.error('Error al verificar expiración de suscripciones:', error);
    }
  }

  /**
   * Procesar expiración de suscripción para un negocio específico
   */
  private static async processSubscriptionExpiration(negocio: any) {
    const ahora = new Date();
    const diasRestantes = Math.ceil((negocio.limitTime.getTime() - ahora.getTime()) / (24 * 60 * 60 * 1000));
    
    // Determinar nivel de importancia basado en días restantes
    let nivelImportancia: 'BAJA' | 'MEDIA' | 'ALTA' | 'CRITICA' = 'BAJA';
    if (diasRestantes <= 1) nivelImportancia = 'CRITICA';
    else if (diasRestantes <= 3) nivelImportancia = 'ALTA';
    else if (diasRestantes <= 7) nivelImportancia = 'MEDIA';

    const titulo = `Expiración de suscripción - ${negocio.nombre}`;
    const descripcion = `La suscripción del negocio "${negocio.nombre}" expira en ${diasRestantes} día${diasRestantes !== 1 ? 's' : ''}. Por favor, renueva la suscripción para evitar interrupciones en el servicio.`;
    const fechaFin = new Date(negocio.limitTime.getTime() + 24 * 60 * 60 * 1000);

    // Verificar si la notificación es válida
    if (diasRestantes > 7) {
      // Si faltan más de 7 días, eliminar notificación si existe
      const notificacionExistente = await this.findExistingNotification(titulo, negocio.id);
      if (notificacionExistente) {
        await this.deleteNotification(notificacionExistente.id);
        console.log(`Notificación eliminada: ${titulo} - Negocio: ${negocio.nombre}`);
      }
      return;
    }

    // Buscar notificación existente
    const notificacionExistente = await this.findExistingNotification(titulo, negocio.id);

    if (!notificacionExistente) {
      // Crear nueva notificación
      await this.createAutomaticNotification({
        titulo,
        descripcion,
        fechaInicio: ahora,
        fechaFin,
        nivelImportancia,
        tipo: 'ALERTA',
        negociosDestino: negocio.id
      });
    } else {
      // Verificar si el contenido ha cambiado
      const contenidoCambiado = 
        notificacionExistente.descripcion !== descripcion ||
        notificacionExistente.nivelImportancia !== nivelImportancia ||
        notificacionExistente.fechaFin.getTime() !== fechaFin.getTime();

      if (contenidoCambiado) {
        // Actualizar notificación y marcar como no leída
        await this.updateNotification(notificacionExistente.id, {
          descripcion,
          nivelImportancia,
          fechaFin
        });
      }
    }
  }

  /**
   * Verificar y crear/actualizar/eliminar notificaciones de límites de productos
   */
  static async checkProductLimits(negocioId?: string) {
    try {
      if (!negocioId) {
        // Procesar todos los negocios
        const negocios = await prisma.negocio.findMany({
          include: {
            productos: true
          }
        });

        for (const negocio of negocios) {
          await this.processProductLimits(negocio);
        }
      } else {
        // Procesar negocio específico
        const negocio = await prisma.negocio.findUnique({
          where: { id: negocioId },
          include: {
            productos: true
          }
        });

        if (negocio) {
          await this.processProductLimits(negocio);
        } else {
          console.log('Negocio no encontrado:', negocioId);
        }
      }
    } catch (error) {
      console.error('Error al verificar límites de productos:', error);
    }
  }

  /**
   * Procesar límites de productos para un negocio específico
   */
  private static async processProductLimits(negocio: any) {
    if (negocio.productlimit <= 0) {
      // Si no hay límite, eliminar notificación si existe
      const titulo = `Límite de productos - ${negocio.nombre}`;
      const notificacionExistente = await this.findExistingNotification(titulo, negocio.id);
      if (notificacionExistente) {
        await this.deleteNotification(notificacionExistente.id);
        console.log(`Notificación eliminada: ${titulo} - Negocio: ${negocio.nombre}`);
      }
      return;
    }

    const porcentajeUsado = Math.round((negocio.productos.length / negocio.productlimit) * 100);
    const titulo = `Límite de productos - ${negocio.nombre}`;
    const descripcion = `El negocio "${negocio.nombre}" ha alcanzado el ${porcentajeUsado}% de su límite de productos (${negocio.productos.length}/${negocio.productlimit}). Considera actualizar tu plan para agregar más productos.`;
    const nivelImportancia = porcentajeUsado >= 95 ? 'ALTA' : 'MEDIA';

    // Verificar si la notificación es válida
    if (porcentajeUsado < 90) {
      // Si está por debajo del 90%, eliminar notificación si existe
      const notificacionExistente = await this.findExistingNotification(titulo, negocio.id);
      if (notificacionExistente) {
        await this.deleteNotification(notificacionExistente.id);
        console.log(`Notificación eliminada: ${titulo} - Negocio: ${negocio.nombre}`);
      }
      return;
    }

    // Buscar notificación existente
    const notificacionExistente = await this.findExistingNotification(titulo, negocio.id);

    if (!notificacionExistente) {
      // Crear nueva notificación
      await this.createAutomaticNotification({
        titulo,
        descripcion,
        fechaInicio: new Date(),
        fechaFin: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 días
        nivelImportancia,
        tipo: 'NOTIFICACION',
        negociosDestino: negocio.id
      });
    } else {
      // Verificar si el contenido ha cambiado
      const contenidoCambiado = 
        notificacionExistente.descripcion !== descripcion ||
        notificacionExistente.nivelImportancia !== nivelImportancia;

      if (contenidoCambiado) {
        // Actualizar notificación y marcar como no leída
        await this.updateNotification(notificacionExistente.id, {
          descripcion,
          nivelImportancia
        });
      }
    }
  }

  /**
   * Verificar y crear/actualizar/eliminar notificaciones de límites de usuarios
   */
  static async checkUserLimits(negocioId?: string) {
    try {
      if (!negocioId) {
        // Procesar todos los negocios
        const negocios = await prisma.negocio.findMany({
          include: {
            usuarios: true
          }
        });

        for (const negocio of negocios) {
          await this.processUserLimits(negocio);
        }
      } else {
        // Procesar negocio específico
        const negocio = await prisma.negocio.findUnique({
          where: { id: negocioId },
          include: {
            usuarios: {
              where: {
                rol: null
              }
            }
          }
        });

        if (negocio) {
          await this.processUserLimits(negocio);
        } else {
          console.log('Negocio no encontrado:', negocioId);
        }
      }
    } catch (error) {
      console.error('Error al verificar límites de usuarios:', error);
    }
  }

  /**
   * Procesar límites de usuarios para un negocio específico
   */
  private static async processUserLimits(negocio: any) {
    if (negocio.userlimit <= 0) {
      // Si no hay límite, eliminar notificación si existe
      const titulo = `Límite de usuarios - ${negocio.nombre}`;
      const notificacionExistente = await this.findExistingNotification(titulo, negocio.id);
      if (notificacionExistente) {
        await this.deleteNotification(notificacionExistente.id);
        console.log(`Notificación eliminada: ${titulo} - Negocio: ${negocio.nombre}`);
      }
      return;
    }
console.log(negocio.usuarios);

    const porcentajeUsado = Math.round((negocio.usuarios.length / negocio.userlimit) * 100);
    const titulo = `Límite de usuarios - ${negocio.nombre}`;
    const descripcion = `El negocio "${negocio.nombre}" ha alcanzado el ${porcentajeUsado}% de su límite de usuarios (${negocio.usuarios.length}/${negocio.userlimit}). Considera actualizar tu plan para agregar más usuarios.`;
    const nivelImportancia = porcentajeUsado >= 95 ? 'ALTA' : 'MEDIA';

    // Verificar si la notificación es válida
    if (porcentajeUsado < 90) {
      // Si está por debajo del 90%, eliminar notificación si existe
      const notificacionExistente = await this.findExistingNotification(titulo, negocio.id);
      if (notificacionExistente) {
        await this.deleteNotification(notificacionExistente.id);
        console.log(`Notificación eliminada: ${titulo} - Negocio: ${negocio.nombre}`);
      }
      return;
    }

    // Buscar notificación existente
    const notificacionExistente = await this.findExistingNotification(titulo, negocio.id);

    if (!notificacionExistente) {
      // Crear nueva notificación
      await this.createAutomaticNotification({
        titulo,
        descripcion,
        fechaInicio: new Date(),
        fechaFin: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 días
        nivelImportancia,
        tipo: 'NOTIFICACION',
        negociosDestino: negocio.id
      });
    } else {
      // Verificar si el contenido ha cambiado
      const contenidoCambiado = 
        notificacionExistente.descripcion !== descripcion ||
        notificacionExistente.nivelImportancia !== nivelImportancia;

      if (contenidoCambiado) {
        // Actualizar notificación y marcar como no leída
        await this.updateNotification(notificacionExistente.id, {
          descripcion,
          nivelImportancia
        });
      }
    }
  }

  /**
   * Ejecutar todas las verificaciones automáticas
   */
  static async runAutomaticChecks(negocioId?: string) {
    console.log('Iniciando verificaciones automáticas de notificaciones...');
    
    await Promise.all([
      this.checkSubscriptionExpiration(negocioId),
      this.checkProductLimits(negocioId),
      this.checkUserLimits(negocioId),
    ]);
    
    console.log('Verificaciones automáticas completadas');
  }
}
