import React from 'react';
import {Badge, Button, Stack} from "@mui/material";
import {useSalesStore} from "@/store/salesStore";
import {Sync} from "@mui/icons-material";
import PointOfSaleIcon from '@mui/icons-material/PointOfSale';
import CloudSyncIcon from '@mui/icons-material/CloudSync';
import SyncProblemIcon from '@mui/icons-material/SyncProblem';
import SyncIcon from '@mui/icons-material/Sync';

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
        <Button variant="contained" onClick={handleShowSyncView}>
          {sales.filter((s) => !s.synced).length > 0 ? (
              <Badge badgeContent={sales.filter((s) => !s.synced).length} color="secondary">
                <SyncProblemIcon/>
              </Badge>
          ) : (
              <SyncIcon/>
          )}
        </Button>
        <Button variant="contained" onClick={handleShowUserSales}>
          <PointOfSaleIcon/>
        </Button>
      </Stack>
  );
}

export default SyncButtonComponent;