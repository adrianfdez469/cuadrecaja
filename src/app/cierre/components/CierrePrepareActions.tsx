"use client";

import { Box, Button, Stack } from "@mui/material";
import PostAddIcon from "@mui/icons-material/PostAdd";
import SavingsIcon from "@mui/icons-material/Savings";
import FilterAltOutlinedIcon from "@mui/icons-material/FilterAltOutlined";
import { SALES_CUTOFF_PREPARE_LABEL } from "@/constants/cierre";

const SELECT_SALES_LABEL = "Seleccionar ventas";

interface Props {
  /**
   * `header` puts the three buttons in the page header, from 900px up.
   * `section` puts them in the content, inside the labelled region, below it.
   */
  layout: "header" | "section";
  /** Only below 600px: one button per row, at full width. */
  stacked: boolean;
  showSelectSales: boolean;
  showAdHoc: boolean;
  showInitialFund: boolean;
  onSelectSales: () => void;
  onAdHoc: () => void;
  onInitialFund: () => void;
}

/**
 * The three actions that PREPARE a close — choosing which sales it takes,
 * noting an expense, recording the initial cash fund — kept together as one
 * group wherever they land.
 *
 * Why they move as a trio instead of splitting: `PageContainer` lays out
 * `headerActions` in the title's own row inside a `flexShrink: 0` box, so that
 * row cannot compress — a fourth labelled button would push the page into
 * horizontal overflow rather than wrap. Between 600 and 899px the three come
 * down to the content, where there is room. It is deliberate that "Agregar
 * gasto" and "Fondo inicial" leave the header at those widths: the price of not
 * breaking the group.
 */
export default function CierrePrepareActions({
  layout,
  stacked,
  showSelectSales,
  showAdHoc,
  showInitialFund,
  onSelectSales,
  onAdHoc,
  onInitialFund,
}: Readonly<Props>) {
  const minHeight = layout === "section" ? 48 : 44;
  const fullWidth = layout === "section" && stacked;

  const buttons = (
    <>
      {showSelectSales && (
        <Button
          aria-label={SELECT_SALES_LABEL}
          variant="outlined"
          startIcon={<FilterAltOutlinedIcon />}
          onClick={onSelectSales}
          fullWidth={fullWidth}
          sx={{ minHeight }}
        >
          {SELECT_SALES_LABEL}
        </Button>
      )}
      {showAdHoc && (
        <Button
          variant="outlined"
          startIcon={<PostAddIcon />}
          onClick={onAdHoc}
          fullWidth={fullWidth}
          sx={{ minHeight }}
        >
          Agregar gasto
        </Button>
      )}
      {showInitialFund && (
        <Button
          variant="outlined"
          startIcon={<SavingsIcon />}
          onClick={onInitialFund}
          fullWidth={fullWidth}
          sx={{ minHeight }}
        >
          Fondo inicial
        </Button>
      )}
    </>
  );

  if (layout === "header") return buttons;

  return (
    <Box component="section" aria-label={SALES_CUTOFF_PREPARE_LABEL}>
      <Stack
        direction={stacked ? "column" : "row"}
        spacing={1.25}
        sx={{ "& > *": { flex: stacked ? "unset" : 1 } }}
      >
        {buttons}
      </Stack>
    </Box>
  );
}
