import { prisma } from "@/lib/prisma";
import { Negocio, Plan, Prisma, Producto, Usuario } from "@prisma/client";

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
    const whereClause: Prisma.NotificacionWhereInput = {
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
        }
      }
    } catch (error) {
      console.error('Error al verificar expiración de suscripciones:', error);
    }
  }

  /**
   * Procesar expiración de suscripción para un negocio específico
   */
  private static async processSubscriptionExpiration(negocio: Negocio) {
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
            productos: true,
            plan: true
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
            productos: true,
            plan: true
          }
        });

        if (negocio) {
          await this.processProductLimits(negocio);
        } else {
        }
      }
    } catch (error) {
      console.error('Error al verificar límites de productos:', error);
    }
  }

  /**
   * Procesar límites de productos para un negocio específico
   */
  private static async processProductLimits(negocio: Negocio & { productos: Producto[]; plan: Plan | null }) {
    const productlimit = negocio.plan?.limiteProductos ?? -1;
    if (productlimit === -1) {
      // Sin límite, eliminar notificación si existe
      const titulo = `Límite de productos - ${negocio.nombre}`;
      const notificacionExistente = await this.findExistingNotification(titulo, negocio.id);
      if (notificacionExistente) {
        await this.deleteNotification(notificacionExistente.id);
      }
      return;
    }

    const porcentajeUsado = Math.round((negocio.productos.length / productlimit) * 100);
    const titulo = `Límite de productos - ${negocio.nombre}`;
    const descripcion = `El negocio "${negocio.nombre}" ha alcanzado el ${porcentajeUsado}% de su límite de productos (${negocio.productos.length}/${productlimit}). Considera actualizar tu plan para agregar más productos.`;
    const nivelImportancia = porcentajeUsado >= 95 ? 'ALTA' : 'MEDIA';

    // Verificar si la notificación es válida
    if (porcentajeUsado < 90) {
      // Si está por debajo del 90%, eliminar notificación si existe
      const notificacionExistente = await this.findExistingNotification(titulo, negocio.id);
      if (notificacionExistente) {
        await this.deleteNotification(notificacionExistente.id);
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
            usuarios: true,
            plan: true
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
            },
            plan: true
          }
        });

        if (negocio) {
          await this.processUserLimits(negocio);
        } else {
        }
      }
    } catch (error) {
      console.error('Error al verificar límites de usuarios:', error);
    }
  }

  /**
   * Procesar límites de usuarios para un negocio específico
   */
  private static async processUserLimits(negocio: Negocio & { usuarios: Usuario[]; plan: Plan | null }) {
    const userlimit = negocio.plan?.limiteUsuarios ?? -1;
    if (userlimit === -1) {
      // Sin límite, eliminar notificación si existe
      const titulo = `Límite de usuarios - ${negocio.nombre}`;
      const notificacionExistente = await this.findExistingNotification(titulo, negocio.id);
      if (notificacionExistente) {
        await this.deleteNotification(notificacionExistente.id);
      }
      return;
    }

    const porcentajeUsado = Math.round((negocio.usuarios.length / userlimit) * 100);
    const titulo = `Límite de usuarios - ${negocio.nombre}`;
    const descripcion = `El negocio "${negocio.nombre}" ha alcanzado el ${porcentajeUsado}% de su límite de usuarios (${negocio.usuarios.length}/${userlimit}). Considera actualizar tu plan para agregar más usuarios.`;
    const nivelImportancia = porcentajeUsado >= 95 ? 'ALTA' : 'MEDIA';

    // Verificar si la notificación es válida
    if (porcentajeUsado < 90) {
      // Si está por debajo del 90%, eliminar notificación si existe
      const notificacionExistente = await this.findExistingNotification(titulo, negocio.id);
      if (notificacionExistente) {
        await this.deleteNotification(notificacionExistente.id);
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
   * Eliminar notificaciones vencidas
   */
  static async deleteExpiredNotifications() {
    const now = new Date();
    await prisma.notificacion.deleteMany({
      where: { fechaFin: { lt: now } }
    });
  }

  /**
   * Verificar productos próximos a vencer o vencidos por tienda
   */
  static async checkProductExpiration(negocioId?: string) {
    try {
      const ahora = new Date();
      const en30Dias = new Date(ahora.getTime() + 30 * 24 * 60 * 60 * 1000);

      const whereNegocio = negocioId
        ? { tienda: { negocioId } }
        : {};

      const productosTienda = await prisma.productoTienda.findMany({
        where: {
          ...whereNegocio,
          fechaVencimiento: { not: null, lte: en30Dias }
        },
        include: {
          producto: { select: { nombre: true } },
          tienda: { select: { id: true, nombre: true, negocioId: true } }
        }
      });

      // Agrupar por tienda
      const porTienda = new Map<string, typeof productosTienda>();
      for (const pt of productosTienda) {
        const key = pt.tiendaId;
        if (!porTienda.has(key)) porTienda.set(key, []);
        porTienda.get(key).push(pt);
      }

      for (const [, items] of porTienda) {
        const tienda = items[0].tienda;
        const negId = tienda.negocioId;

        const niveles: Array<{
          nivel: 'CRITICA' | 'ALTA' | 'MEDIA' | 'BAJA';
          label: string;
        }> = [
          { nivel: 'CRITICA', label: 'VENCIDOS' },
          { nivel: 'ALTA',    label: 'vencen en ≤7 días' },
          { nivel: 'MEDIA',   label: 'vencen en ≤15 días' },
          { nivel: 'BAJA',    label: 'vencen en ≤30 días' },
        ];

        for (const { nivel, label } of niveles) {
          const grupo = items.filter(pt => {
            const dias = Math.ceil((pt.fechaVencimiento.getTime() - ahora.getTime()) / (24 * 60 * 60 * 1000));
            if (nivel === 'CRITICA') return dias <= 0;
            if (nivel === 'ALTA')   return dias > 0 && dias <= 7;
            if (nivel === 'MEDIA')  return dias > 7 && dias <= 15;
            return dias > 15 && dias <= 30;
          });

          const titulo = `Vencimiento de productos — ${tienda.nombre} (${label})`;

          if (grupo.length === 0) {
            const existente = await this.findExistingNotification(titulo, negId);
            if (existente) await this.deleteNotification(existente.id);
            continue;
          }

          const listaProductos = grupo
            .map(pt => {
              const dias = Math.ceil((pt.fechaVencimiento.getTime() - ahora.getTime()) / (24 * 60 * 60 * 1000));
              const diasTexto = dias <= 0 ? `vencido hace ${Math.abs(dias)} día(s)` : `vence en ${dias} día(s)`;
              return `• ${pt.producto.nombre} (${diasTexto})`;
            })
            .join('\n');

          const descripcion = `${grupo.length} producto(s) ${label} en la tienda "${tienda.nombre}":\n${listaProductos}`;
          const fechaFin = new Date(ahora.getTime() + 7 * 24 * 60 * 60 * 1000);

          const existente = await this.findExistingNotification(titulo, negId);

          if (!existente) {
            await this.createAutomaticNotification({
              titulo,
              descripcion,
              fechaInicio: ahora,
              fechaFin,
              nivelImportancia: nivel,
              tipo: 'ALERTA',
              negociosDestino: negId
            });
          } else {
            const contenidoCambiado =
              existente.descripcion !== descripcion ||
              existente.nivelImportancia !== nivel;
            if (contenidoCambiado) {
              await this.updateNotification(existente.id, { descripcion, nivelImportancia: nivel, fechaFin });
            }
          }
        }
      }
    } catch (error) {
      console.error('Error al verificar vencimiento de productos:', error);
    }
  }

  /**
   * Ejecutar todas las verificaciones automáticas
   */
  static async runAutomaticChecks(negocioId?: string) {

    await Promise.all([
      this.checkSubscriptionExpiration(negocioId),
      this.checkProductLimits(negocioId),
      this.checkUserLimits(negocioId),
      this.checkProductExpiration(negocioId),
      this.deleteExpiredNotifications()
    ]);

  }
}
