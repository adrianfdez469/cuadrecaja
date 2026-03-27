import { useEffect } from 'react';
import { useMessageContext } from '@/context/MessageContext';

/**
 * En móvil, intercepta el botón "atrás" del navegador para evitar
 * salir accidentalmente de la interfaz y recargar la aplicación.
 * Muestra un aviso cada vez que el usuario intenta navegar atrás.
 */
export function useBlockBackNavigation() {
  const { showMessage } = useMessageContext();

  useEffect(() => {
    // Solo aplicar en dispositivos móviles
    const isMobile = window.matchMedia('(max-width: 600px)').matches;
    if (!isMobile) return;

    // Insertar estado ficticio para que haya algo que interceptar
    history.pushState(null, '', window.location.href);

    const handlePopState = () => {
      // Volver a insertar el estado para neutralizar la navegación
      history.pushState(null, '', window.location.href);
      showMessage('Navegación atrás deshabilitada en esta pantalla', 'warning');
    };

    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, [showMessage]);
}