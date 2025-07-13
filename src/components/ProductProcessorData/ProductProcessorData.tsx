import React from 'react';
import QrModuleScanner from '@/components/ProductProcessorData/QrModuleScanner';
import { processClientDataFromQR } from '@/utils/scanner';
import {IProcessedData} from "@/types/IProcessedData";

type ClientProcessorDataProps = {
  onProcessedData: (processedData: IProcessedData) => void;
};

function ProductProcessorData({ onProcessedData }: ClientProcessorDataProps) {
  function handleScan(qrText: string) {
    const processedData = processClientDataFromQR(qrText);
    // eslint-disable-next-line @typescript-eslint/no-unused-expressions
    onProcessedData && onProcessedData(processedData);
  }

  return (
    <>
      <QrModuleScanner onScan={handleScan} />
    </>
  );
}

export default ProductProcessorData;
