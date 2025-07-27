import React, { useImperativeHandle, forwardRef } from 'react';
import QrModuleScanner from '@/components/ProductProcessorData/QrModuleScanner';
import { processClientDataFromQR } from '@/utils/scanner';
import {IProcessedData} from "@/types/IProcessedData";
import { Box } from '@mui/material';

type ClientProcessorDataProps = {
  onProcessedData: (processedData: IProcessedData) => void;
};

export interface ProductProcessorDataRef {
  openScanner: () => void;
}

const ProductProcessorData = forwardRef<ProductProcessorDataRef, ClientProcessorDataProps>(
  ({ onProcessedData }, ref) => {
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

    return (
      <Box display="flex" justifyContent="left" alignItems="left" height="100%">
        <QrModuleScanner ref={qrModuleRef} onScan={handleScan} />
      </Box>
    );
  }
);

ProductProcessorData.displayName = 'ProductProcessorData';

export default ProductProcessorData;
