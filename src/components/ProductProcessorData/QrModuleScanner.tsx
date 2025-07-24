import React from 'react';
import MobileQrScanner from '@/components/ProductProcessorData/MobileQrScanner';
import HardwareQrScanner from '@/components/ProductProcessorData/HardwareQrScanner';
import { Box } from '@mui/material';

type QrModuleScannerProps = {
  onScan: (qrText: string) => void;
};

function QrModuleScanner({ onScan }: QrModuleScannerProps) {
  return (
    <Box 
      display="flex" 
      flexDirection="row" 
      gap={1} 
      width="100%" 
    >
      <MobileQrScanner qrCodeSuccessCallback={onScan} />
      <HardwareQrScanner qrCodeSuccessCallback={onScan} />
    </Box>
  );
}

export default QrModuleScanner;
