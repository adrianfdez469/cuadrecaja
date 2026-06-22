import React from 'react';
import {Badge, IconButton, Stack} from "@mui/material";
import {useSalesStore} from "@/store/salesStore";
import PointOfSaleIcon from '@mui/icons-material/PointOfSale';
import SyncProblemIcon from '@mui/icons-material/SyncProblem';
import SyncIcon from '@mui/icons-material/SyncAlt';

interface PosStatusToolBarProps {
  handleShowSyncView: () => void;
  handleShowUserSales: () => void;
}

function PosStatusToolBar({
                               handleShowSyncView,
                               handleShowUserSales
                             }: PosStatusToolBarProps) {

  const {sales} = useSalesStore();

  return (
      <Stack direction="row" spacing={0.1}>
        <IconButton onClick={handleShowSyncView} data-tour="pos-toolbar-sync">
          {sales.filter((s) => !s.synced).length > 0 ? (
              <Badge badgeContent={sales.filter((s) => !s.synced).length} color="secondary">
                <SyncProblemIcon/>
              </Badge>
          ) : (
              <SyncIcon/>
          )}
        </IconButton>
        <IconButton onClick={handleShowUserSales} data-tour="pos-toolbar-mis-ventas">
          <PointOfSaleIcon/>
        </IconButton>
      </Stack>
  );
}

export default PosStatusToolBar;