import React from 'react';
import MobileQrScanner from '@/components/ClientProcessorData/MobileQrScanner';
import HardwareQrScanner from '@/components/ClientProcessorData/HardwareQrScanner';

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
