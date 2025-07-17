import { useState, useCallback } from 'react';
import { OperacionTipo, ProductoSeleccionado } from '@/components/ProductcSelectionModal/ProductSelectionModal';
import { IProductoTiendaV2 } from '@/types/IProducto';

interface UseProductSelectionModalReturn {
  isOpen: boolean;
  operacion: OperacionTipo;
  openModal: (operacion: OperacionTipo) => void;
  closeModal: () => void;
  handleConfirm: (productos: ProductoSeleccionado[]) => void;
  onConfirm: (productos: ProductoSeleccionado[]) => void | Promise<void>;
  setOnConfirm: (callback: (productos: ProductoSeleccionado[]) => void | Promise<void>) => void;
}

export const useProductSelectionModal = (): UseProductSelectionModalReturn => {
  const [isOpen, setIsOpen] = useState(false);
  const [operacion, setOperacion] = useState<OperacionTipo>('ENTRADA');
  const [onConfirmCallback, setOnConfirmCallback] = useState<
    (productos: ProductoSeleccionado[]) => void | Promise<void>
  >(() => {});

  const openModal = useCallback((tipo: OperacionTipo) => {
    setOperacion(tipo);
    setIsOpen(true);
  }, []);

  const closeModal = useCallback(() => {
    setIsOpen(false);
  }, []);

  const handleConfirm = useCallback(async (productos: ProductoSeleccionado[]) => {
    try {
      await onConfirmCallback(productos);
      closeModal();
    } catch (error) {
      console.error('Error al procesar la selección de productos:', error);
      // Aquí podrías mostrar un mensaje de error usando el contexto de mensajes
    }
  }, [onConfirmCallback, closeModal]);

  const setOnConfirm = useCallback((
    callback: (productos: ProductoSeleccionado[]) => void | Promise<void>
  ) => {
    setOnConfirmCallback(() => callback);
  }, []);

  return {
    isOpen,
    operacion,
    openModal,
    closeModal,
    handleConfirm,
    onConfirm: onConfirmCallback,
    setOnConfirm
  };
}; 