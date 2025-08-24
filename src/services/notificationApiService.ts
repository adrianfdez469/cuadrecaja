import { INotificacion, INotificacionConEstado, INotificacionFormData, INotificacionStats, INotificacionResponse } from '@/types/INotificacion';

export class NotificationApiService {
  private static baseUrl = '/api/notificaciones';

  /**
   * Obtener todas las notificaciones (solo SUPER_ADMIN)
   */
  static async getAllNotifications(): Promise<INotificacion[]> {
    const response = await fetch(this.baseUrl);
    
    if (!response.ok) {
      throw new Error('Error al cargar las notificaciones');
    }
    
    return response.json();
  }

  /**
   * Obtener una notificación específica por ID (solo SUPER_ADMIN)
   */
  static async getNotificationById(id: string): Promise<INotificacion> {
    const response = await fetch(`${this.baseUrl}/${id}`);
    
    if (!response.ok) {
      throw new Error('Error al cargar la notificación');
    }
    
    return response.json();
  }

  /**
   * Crear una nueva notificación (solo SUPER_ADMIN)
   */
  static async createNotification(data: INotificacionFormData): Promise<INotificacion> {
    const response = await fetch(this.baseUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        ...data,
        negociosDestino: data.negociosDestino.join(','),
        usuariosDestino: data.usuariosDestino.join(',')
      }),
    });
    
    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || 'Error al crear la notificación');
    }
    
    return response.json();
  }

  /**
   * Actualizar una notificación existente (solo SUPER_ADMIN)
   */
  static async updateNotification(id: string, data: INotificacionFormData): Promise<INotificacion> {
    const response = await fetch(`${this.baseUrl}/${id}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        ...data,
        negociosDestino: data.negociosDestino.join(','),
        usuariosDestino: data.usuariosDestino.join(',')
      }),
    });
    
    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || 'Error al actualizar la notificación');
    }
    
    return response.json();
  }

  /**
   * Eliminar una notificación (solo SUPER_ADMIN)
   */
  static async deleteNotification(id: string): Promise<INotificacionResponse> {
    const response = await fetch(`${this.baseUrl}/${id}`, {
      method: 'DELETE',
    });
    
    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || 'Error al eliminar la notificación');
    }
    
    return response.json();
  }

  /**
   * Obtener notificaciones activas para el usuario actual
   */
  static async getActiveNotifications(): Promise<INotificacionConEstado[]> {
    const response = await fetch(`${this.baseUrl}/activas`);
    
    if (!response.ok) {
      throw new Error('Error al cargar las notificaciones activas');
    }
    
    return response.json();
  }

  /**
   * Marcar una notificación como leída
   */
  static async markAsRead(id: string): Promise<INotificacionResponse> {
    const response = await fetch(`${this.baseUrl}/${id}/marcar-leida`, {
      method: 'POST',
    });
    
    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || 'Error al marcar la notificación como leída');
    }
    
    return response.json();
  }

  /**
   * Obtener estadísticas de notificaciones (solo SUPER_ADMIN)
   */
  static async getNotificationStats(): Promise<INotificacionStats> {
    const response = await fetch(`${this.baseUrl}/stats`);
    
    if (!response.ok) {
      throw new Error('Error al cargar las estadísticas');
    }
    
    return response.json();
  }

  /**
   * Ejecutar verificaciones automáticas (solo SUPER_ADMIN)
   */
  static async runAutomaticChecks(negocioId?: string): Promise<INotificacionResponse> {
    const response = await fetch(`${this.baseUrl}/auto-check`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ negocioId }),
    });
    
    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || 'Error al ejecutar las verificaciones automáticas');
    }
    
    return response.json();
  }

  /**
   * Obtener información sobre verificaciones automáticas (solo SUPER_ADMIN)
   */
  static async getAutoCheckInfo(): Promise<any> {
    const response = await fetch(`${this.baseUrl}/auto-check`);
    
    if (!response.ok) {
      throw new Error('Error al obtener información de verificaciones automáticas');
    }
    
    return response.json();
  }

  /**
   * Utilidad para convertir arrays de strings a string separado por comas
   */
  static arrayToString(arr: string[]): string {
    return arr.join(',');
  }

  /**
   * Utilidad para convertir string separado por comas a array de strings
   */
  static stringToArray(str: string): string[] {
    if (!str || str.trim() === '') return [];
    return str.split(',').map(item => item.trim()).filter(item => item !== '');
  }

  /**
   * Utilidad para verificar si una notificación está activa
   */
  static isNotificationActive(notificacion: INotificacion): boolean {
    const ahora = new Date();
    return ahora >= new Date(notificacion.fechaInicio) && ahora <= new Date(notificacion.fechaFin);
  }

  /**
   * Utilidad para obtener el color basado en el nivel de importancia
   */
  static getImportanceColor(nivelImportancia: string): string {
    switch (nivelImportancia) {
      case 'CRITICA':
        return '#ef4444'; // red-500
      case 'ALTA':
        return '#f97316'; // orange-500
      case 'MEDIA':
        return '#eab308'; // yellow-500
      case 'BAJA':
        return '#22c55e'; // green-500
      default:
        return '#6b7280'; // gray-500
    }
  }

  /**
   * Utilidad para obtener el color basado en el tipo de notificación
   */
  static getTypeColor(tipo: string): string {
    switch (tipo) {
      case 'ALERTA':
        return '#ef4444'; // red-500
      case 'PROMOCION':
        return '#8b5cf6'; // violet-500
      case 'NOTIFICACION':
        return '#3b82f6'; // blue-500
      case 'MENSAJE':
        return '#10b981'; // emerald-500
      default:
        return '#6b7280'; // gray-500
    }
  }
}
