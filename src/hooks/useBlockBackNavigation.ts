import { useEffect, useRef } from 'react';
import { useMessageContext } from '@/context/MessageContext';

/**
 * En móvil, intercepta el botón "atrás" del navegador para evitar
 * salir accidentalmente de la interfaz y recargar la aplicación.
 * Muestra un aviso cada vez que el usuario intenta navegar atrás.
 */
export function useBlockBackNavigation() {
  const { showMessage } = useMessageContext();

  // Ref para que el handler siempre tenga la versión actual de showMessage
  // sin necesitar ser dependencia del efecto (evita desmontajes/remontajes)
  const showMessageRef = useRef(showMessage);
  useEffect(() => {
    showMessageRef.current = showMessage;
  }, [showMessage]);

  useEffect(() => {
    const isMobile = window.matchMedia('(max-width: 600px)').matches;
    if (!isMobile) return;

    // Insertar varios estados ficticios como "colchón" ante presses rápidos
    history.pushState(null, '', window.location.href);
    history.pushState(null, '', window.location.href);
    history.pushState(null, '', window.location.href);

    const handlePopState = () => {
      // Re-insertar inmediatamente para neutralizar el movimiento
      history.pushState(null, '', window.location.href);
      showMessageRef.current('Navegación atrás deshabilitada', 'warning');
    };

    window.addEventListener('popstate', handlePopState);
    // El listener nunca se desmonta mientras el componente esté vivo
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);
}