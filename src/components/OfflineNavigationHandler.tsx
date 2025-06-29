import { useEffect } from 'react';
import { useNetworkStatus } from '@/hooks/useNetworkStatus';

export const OfflineNavigationHandler: React.FC = () => {
  const { isOnline } = useNetworkStatus();

  useEffect(() => {
    // Interceptar y manejar errores de red cuando estamos offline
    const handleWindowError = (event: ErrorEvent) => {
      // Si estamos offline y el error es de red, suprimirlo
      if (!isOnline && (
        event.message?.includes('ERR_INTERNET_DISCONNECTED') ||
        event.message?.includes('NetworkError') ||
        event.message?.includes('Failed to fetch')
      )) {
        console.log('🌐 [OfflineNav] Error de red suprimido (modo offline):', event.message);
        event.preventDefault();
        return false;
      }
    };

    const handleUnhandledRejection = (event: PromiseRejectionEvent) => {
      // Si estamos offline y es un error de red, suprimirlo
      if (!isOnline && event.reason) {
        const errorMsg = event.reason.toString();
        if (
          errorMsg.includes('ERR_INTERNET_DISCONNECTED') ||
          errorMsg.includes('NetworkError') ||
          errorMsg.includes('Failed to fetch') ||
          errorMsg.includes('fetch')
        ) {
          console.log('🌐 [OfflineNav] Promise rejection de red suprimida (modo offline):', errorMsg);
          event.preventDefault();
          return false;
        }
      }
    };

    // Solo agregar listeners cuando estamos offline
    if (!isOnline) {
      window.addEventListener('error', handleWindowError);
      window.addEventListener('unhandledrejection', handleUnhandledRejection);
    }

    return () => {
      window.removeEventListener('error', handleWindowError);
      window.removeEventListener('unhandledrejection', handleUnhandledRejection);
    };
  }, [isOnline]);

  // Interceptar errores de consola relacionados con red cuando offline
  useEffect(() => {
    if (!isOnline) {
      const originalConsoleError = console.error;
      
      console.error = (...args: unknown[]) => {
        const message = args.join(' ').toString();
        
        // Suprimir errores conocidos de Next.js offline
        if (
          message.includes('ERR_INTERNET_DISCONNECTED') ||
          message.includes('__nextjs_original-stack-frames') ||
          message.includes('_rsc=') ||
          message.includes('Failed to fetch RSC payload') ||
          message.includes('Failed to fetch') ||
          message.includes('NetworkError') ||
          message.includes('fetch')
        ) {
          console.log('🌐 [OfflineNav] Error de consola suprimido (modo offline)');
          return;
        }
        
        // Mostrar otros errores normalmente
        originalConsoleError(...args);
      };

      return () => {
        console.error = originalConsoleError;
      };
    }
  }, [isOnline]);

  // Interceptar navegación offline para forzar navegación del lado del cliente
  useEffect(() => {
    if (!isOnline) {
      // Interceptar clicks en enlaces y botones que naveguen
      const handleClick = (event: MouseEvent) => {
        const target = event.target as HTMLElement;
        
        // Buscar el elemento clickeable más cercano
        const clickableElement = target.closest('a, button, [role="button"], [onClick]') as HTMLElement;
        
        if (clickableElement) {
          // Si es un enlace con href
          if (clickableElement.tagName === 'A') {
            const href = clickableElement.getAttribute('href');
            if (href && href.startsWith('/')) {
              console.log('🌐 [OfflineNav] Interceptando navegación offline:', href);
              event.preventDefault();
              
              // Usar window.location para navegación del lado del cliente
              window.location.href = href;
              return;
            }
          }
          
          // Si es un botón o elemento con onClick que podría navegar
          // Verificar si tiene atributos de navegación comunes
          const dataPath = clickableElement.getAttribute('data-path');
          if (dataPath) {
            console.log('🌐 [OfflineNav] Interceptando navegación por data-path:', dataPath);
            event.preventDefault();
            window.location.href = dataPath;
            return;
          }
        }
      };

      // Interceptar el router.push de Next.js cuando estamos offline
      const originalPushState = window.history.pushState;
      const originalReplaceState = window.history.replaceState;

      window.history.pushState = function(state: unknown, title: string, url?: string | URL | null) {
        if (url && typeof url === 'string' && url.startsWith('/')) {
          console.log('🌐 [OfflineNav] Interceptando pushState offline:', url);
          // En lugar de usar pushState, usar location.href para navegación completa
          window.location.href = url;
          return;
        }
        return originalPushState.call(this, state, title, url);
      };

      window.history.replaceState = function(state: unknown, title: string, url?: string | URL | null) {
        if (url && typeof url === 'string' && url.startsWith('/')) {
          console.log('🌐 [OfflineNav] Interceptando replaceState offline:', url);
          window.location.href = url;
          return;
        }
        return originalReplaceState.call(this, state, title, url);
      };

      document.addEventListener('click', handleClick, true);

      return () => {
        document.removeEventListener('click', handleClick, true);
        window.history.pushState = originalPushState;
        window.history.replaceState = originalReplaceState;
      };
    }
  }, [isOnline]);

  return null; // Este componente no renderiza nada
}; 