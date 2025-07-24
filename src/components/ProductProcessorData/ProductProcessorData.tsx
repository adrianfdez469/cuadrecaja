import React from 'react';
import QrModuleScanner from '@/components/ProductProcessorData/QrModuleScanner';
import { processClientDataFromQR } from '@/utils/scanner';
import {IProcessedData} from "@/types/IProcessedData";
import { Box } from '@mui/material';

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
    <Box display="flex" justifyContent="left" alignItems="left" height="100%">
      <QrModuleScanner onScan={handleScan} />
    </Box>
  );
}

export default ProductProcessorData;
