import { useEffect, useRef } from 'react';
import { NotificationApiService } from '@/services/notificationApiService';

interface UseNotificationCheckProps {
  negocioId?: string;
  checkInterval?: number; // en milisegundos, por defecto 24 horas
}

export const useNotificationCheck = ({ 
  negocioId, 
  checkInterval = 24 * 60 * 60 * 1000 // 24 horas por defecto
}: UseNotificationCheckProps) => {
  const hasChecked = useRef(false);

  useEffect(() => {
    // Solo ejecutar una vez por sesión
    if (hasChecked.current) {
      return;
    }

    if (!negocioId) {
      return;
    }

    const lastCheckKey = `lastNotificationCheck_${negocioId}`;
    const lastCheck = localStorage.getItem(lastCheckKey);
    const now = new Date().getTime();
    
    const shouldCheck = !lastCheck || (now - parseInt(lastCheck)) > checkInterval;
    
    if (shouldCheck) {
      const runCheck = async () => {
        try {
          await NotificationApiService.runAutomaticChecks(negocioId);
          localStorage.setItem(lastCheckKey, now.toString());
          console.log(`Verificaciones automáticas ejecutadas para negocio: ${negocioId}`);
        } catch (error) {
          console.error('Error al ejecutar verificaciones automáticas:', error);
        }
      };
      
      runCheck();
      hasChecked.current = true;
    }
  }, [negocioId, checkInterval]);

  return null;
};
