import React, { useImperativeHandle, forwardRef } from 'react';
import QrModuleScanner from '@/components/ProductProcessorData/QrModuleScanner';
import { processClientDataFromQR } from '@/utils/scanner';
import {IProcessedData} from "@/types/IProcessedData";
import { Box } from '@mui/material';

type ClientProcessorDataProps = {
  onProcessedData: (processedData: IProcessedData) => void;
  onHardwareScan?: (processedData: IProcessedData) => void; // Nueva prop para escaneo de hardware
  keepFocus?: boolean; // Nueva prop para controlar el foco del hardware scanner
  forceKeepFocus?: boolean; // Forzar mantener foco incluso en móviles
};

export interface ProductProcessorDataRef {
  openScanner: () => void;
}

const ProductProcessorData = forwardRef<ProductProcessorDataRef, ClientProcessorDataProps>(
  ({ onProcessedData, onHardwareScan, keepFocus = true, forceKeepFocus }, ref) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const qrModuleRef = React.useRef<any>(null);

    useImperativeHandle(ref, () => ({
      openScanner: () => {
        if (qrModuleRef.current?.openScanner) {
          qrModuleRef.current.openScanner();
        }
      }
    }));

    function handleScan(qrText: string) {
      const processedData = processClientDataFromQR(qrText);
      // eslint-disable-next-line @typescript-eslint/no-unused-expressions
      onProcessedData && onProcessedData(processedData);
    }

    function handleHardwareScan(qrText: string) {
      const processedData = processClientDataFromQR(qrText);
      // eslint-disable-next-line @typescript-eslint/no-unused-expressions
      onHardwareScan && onHardwareScan(processedData);
    }

    return (
      <Box display="flex" justifyContent="left" alignItems="left" height="100%">
        <QrModuleScanner 
          ref={qrModuleRef} 
          onScan={handleScan} 
          onHardwareScan={handleHardwareScan}
          keepFocus={keepFocus}
          forceKeepFocus={forceKeepFocus}
        />
      </Box>
    );
  }
);

ProductProcessorData.displayName = 'ProductProcessorData';

export default ProductProcessorData;
