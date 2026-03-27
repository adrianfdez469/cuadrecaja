import React from 'react';
import {Badge, IconButton, Stack} from "@mui/material";
import {useSalesStore} from "@/store/salesStore";
import PointOfSaleIcon from '@mui/icons-material/PointOfSale';
import SyncProblemIcon from '@mui/icons-material/SyncProblem';
import SyncIcon from '@mui/icons-material/SyncAlt';

interface SyncButtonComponentProps {
  handleShowSyncView: () => void;
  handleShowUserSales: () => void;
}

function SyncButtonComponent({
                               handleShowSyncView,
                               handleShowUserSales
                             }: SyncButtonComponentProps) {

  const {sales} = useSalesStore();

  return (
      <Stack direction="row" spacing={0.1}>
        <IconButton onClick={handleShowSyncView}>
          {sales.filter((s) => !s.synced).length > 0 ? (
              <Badge badgeContent={sales.filter((s) => !s.synced).length} color="secondary">
                <SyncProblemIcon/>
              </Badge>
          ) : (
              <SyncIcon/>
          )}
        </IconButton>
        <IconButton onClick={handleShowUserSales}>
          <PointOfSaleIcon/>
        </IconButton>
      </Stack>
  );
}

export default SyncButtonComponent;