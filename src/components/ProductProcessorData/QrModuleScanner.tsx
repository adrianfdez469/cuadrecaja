import React from 'react';
import MobileQrScanner from '@/components/ProductProcessorData/MobileQrScanner';
import HardwareQrScanner from '@/components/ProductProcessorData/HardwareQrScanner';

type QrModuleScannerProps = {
  onScan: (qrText: string) => void;
};

function QrModuleScanner({ onScan }: QrModuleScannerProps) {
  return (
    <>
      <MobileQrScanner qrCodeSuccessCallback={onScan} />
      <HardwareQrScanner qrCodeSuccessCallback={onScan} />
    </>
  );
}

export default QrModuleScanner;
