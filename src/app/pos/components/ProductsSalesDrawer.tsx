import React from "react";
import { TablaProductosCierre } from "@/components/tablaProductosCierre/intex";
import { Products } from "@/store/salesStore";
import { Close } from "@mui/icons-material";
import { Box, Drawer, IconButton } from "@mui/material";

interface IProps {
  showProducts: boolean;
  setShowProducts: (show: boolean) => void;
  productos: Products[]
}

export const ProducsSalesDrawer: React.FC<IProps> = ({
  showProducts,
  setShowProducts,
  productos
}) => {

  return (
    <Drawer
      anchor="bottom"
      open={showProducts}
      onClose={() => setShowProducts(false)}
    >
      <Box
        sx={{
          width: "100vw",
          p: 2,
          display: "flex",
          flexDirection: "column",
          height: "100vh",
        }}
      >
        <Box display={"flex"} flexDirection={"row"} justifyContent={"end"}>
          <IconButton onClick={() => setShowProducts(false)} color="default">
            <Close />
          </IconButton>
        </Box>
        <TablaProductosCierre
          cierreData={{
            totalGanancia: 0,
            totalTransferencia: 0,
            totalVentas: 0,
            productosVendidos: productos.map((prod) => {
              return {
                cantidad: prod.cantVendida,
                costo: 0,
                ganancia: 0,
                precio: 0,
                id: prod.id,
                nombre: prod.nombre,
                total: 0,
                productoId: prod.id
              };
            }),
          }}
          totales={{ totalCantidad: 0, totalGanancia: 0, totalMonto: 0 }}
          hideTotales
          showOnlyCants
        />
      </Box>
    </Drawer>
  );
};
