import React, { forwardRef, useImperativeHandle } from 'react';
import MobileQrScanner from '@/components/ProductProcessorData/MobileQrScanner';
import HardwareQrScanner from '@/components/ProductProcessorData/HardwareQrScanner';
import { Box } from '@mui/material';

type QrModuleScannerProps = {
  onScan: (qrText: string) => void;
  onHardwareScan?: (qrText: string) => void; // Nueva prop para escaneo de hardware
};

export interface QrModuleScannerRef {
  openScanner: () => void;
}

const QrModuleScanner = forwardRef<QrModuleScannerRef, QrModuleScannerProps>(
  ({ onScan, onHardwareScan }, ref) => {
    const mobileScannerRef = React.useRef<any>(null);

    useImperativeHandle(ref, () => ({
      openScanner: () => {
        if (mobileScannerRef.current?.openScanner) {
          mobileScannerRef.current.openScanner();
        }
      }
    }));

    return (
      <Box 
        display="flex" 
        flexDirection="row" 
        gap={1} 
        width="100%" 
      >
        <MobileQrScanner ref={mobileScannerRef} qrCodeSuccessCallback={onScan} />
        <HardwareQrScanner 
          qrCodeSuccessCallback={onHardwareScan || onScan} 
        />
      </Box>
    );
  }
);

QrModuleScanner.displayName = 'QrModuleScanner';

export default QrModuleScanner;
