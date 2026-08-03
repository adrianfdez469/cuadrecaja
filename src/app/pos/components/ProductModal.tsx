"use client";

import { Box, Grid, Typography, Modal, Fab } from "@mui/material";
import CloseIcon from "@mui/icons-material/Close";
import { IProductoTiendaV2 } from "@/schemas/producto";
import { PosProductItemLayout } from "./PosProductItemLayout";

interface ProductModalProps {
  open: boolean;
  closeModal: () => void;
  productosTienda: IProductoTiendaV2[];
  allProductosTienda?: IProductoTiendaV2[];
  category: { id: string; nombre: string; color: string } | null;
  isCartPinned?: boolean;
}

export function ProductModal({
  open,
  closeModal,
  productosTienda,
  allProductosTienda,
  category,
  isCartPinned,
}: ProductModalProps) {
  const allProducts = allProductosTienda || productosTienda;

  const content = (
    <Box
      sx={{
        width: "100%",
        height: "100%",
        bgcolor: "background.paper",
        p: { xs: 2, sm: 3 },
        pt: { xs: "calc(16px + env(safe-area-inset-top))", sm: 3 },
        pb: { xs: "calc(16px + env(safe-area-inset-bottom))", sm: 3 },
        borderRadius: isCartPinned ? 0 : { xs: 0, sm: 2 },
        overflow: "auto",
        position: "relative",
        boxSizing: "border-box",
      }}
    >
      <Box
        display="flex"
        flexDirection="row"
        alignItems="flex-start"
        justifyContent="space-between"
      >
        <Typography variant="h4" mb={2} textAlign="left">
          {category ? category.nombre : ""}
        </Typography>
        <Fab
          size="small"
          aria-label="Cerrar"
          onClick={closeModal}
          sx={{
            position: "absolute",
            top: { xs: "calc(16px + env(safe-area-inset-top))", sm: 16 },
            right: { xs: "calc(16px + env(safe-area-inset-right))", sm: 16 },
            zIndex: 10,
          }}
        >
          <CloseIcon />
        </Fab>
      </Box>

      <Grid container spacing={1.5}>
        {productosTienda.map((productoTienda) => (
          <Grid item xs={12} sm={6} md={4} lg={3} key={productoTienda.id}>
            <PosProductItemLayout
              productoTienda={productoTienda}
              allProductosTienda={allProducts}
              showDescription
              sx={{ height: "100%" }}
            />
          </Grid>
        ))}
      </Grid>
    </Box>
  );

  return isCartPinned ? (
    open && (
      <Box
        sx={{
          position: "absolute",
          inset: 0,
          zIndex: 101,
          overflow: "hidden",
        }}
      >
        {content}
      </Box>
    )
  ) : (
    <Modal
      open={open}
      onClose={closeModal}
      sx={{
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <Box
        sx={{
          width: { xs: "100vw", sm: "95vw" },
          height: { xs: "100dvh", sm: "95vh" },
        }}
      >
        {content}
      </Box>
    </Modal>
  );
}
