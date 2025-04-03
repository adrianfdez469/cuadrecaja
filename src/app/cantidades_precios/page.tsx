"use client";

import { useState, useEffect } from "react";
import { Box, TextField, CircularProgress, Button } from "@mui/material";
import { DataGrid, GridRowModel } from "@mui/x-data-grid";
import axios from "axios";
import { useAppContext } from "@/context/AppContext";
import { useMessageContext } from "@/context/MessageContext";

const PreciosCantidades = () => {
  const [productos, setProductos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [idDirtyProds, setIdDirtyProds] = useState([]);
  const { user, loadingContext } = useAppContext()
  const { showMessage } = useMessageContext();

  const fetchProductos = async () => {
    try {
      console.log('user', user);
      
      if(user?.tiendaActual?.id){
        const response = await axios.get(`/api/productos_tienda/${user.tiendaActual.id}`);
        setProductos(response.data);
        setIdDirtyProds([]);
      }
    } catch (error) {
      console.error("Error al obtener productos", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if(!loadingContext) {
      fetchProductos();
    }
  }, [loadingContext]);

  const handleProcessRowUpdate = (
    newRow: GridRowModel,
  ) => {

    setIdDirtyProds((state) => [...state, newRow.id]);
    setProductos((prod) => {
      return prod.map((p) => {
        if (p.id === newRow.id) {
          return newRow;
        }
        return p;
      });
    });
    return newRow;
  };

  const save = async () => {
    const productsToSave = productos.filter((prod) => {
      return idDirtyProds.includes(prod.id);
    }).map((prod) => {
      return {
        id: prod.id,
        costo: prod.costo,
        precio: prod.precio,
        existencia: prod.existencia
      }
    });

    
    try {
      const response = await fetch(`/api/productos_tienda/${user.tiendaActual.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ productos: productsToSave })
      });

      if (!response.ok) {
        throw new Error("Error al actualizar productos");
      }

      showMessage("Productos actualizados correctamente", "success");
      fetchProductos();
    } catch (error) {
      console.error("Error:", error);
      showMessage(error.message, "error");
    }

  };

  return (
    <Box>
      {(loading || loadingContext) ? (
        <CircularProgress />
      ) : (
        <>
          <Box
            display={"flex"}
            flexDirection={"row"}
            justifyContent={"space-between"}
            alignItems={"start"}
            sx={{mb: 2}}
          >
            <TextField
              label="Buscar producto"
              variant="outlined"
              sx={{flex: 0.9 }}
              size="small"
              onChange={(e) => {
                const query = e.target.value.toLowerCase();
                setProductos((prev) =>
                  prev.map((p) => ({
                    ...p,
                    hidden: !p.nombre.toLowerCase().includes(query),
                  }))
                );
              }}
            />
            <Button
              variant="contained"
              disabled={idDirtyProds.length === 0}
              onClick={save}
              size="large"
            >
              Guardar
            </Button>
          </Box>
          <DataGrid
            rows={productos.filter((p) => !p.hidden)}
            columns={[
              { field: "nombre", headerName: "Producto", flex: 1 },
              {
                field: "costo",
                headerName: "Costo",
                flex: 1,
                editable: true,
                type: "number",
              },
              {
                field: "precio",
                headerName: "Precio",
                flex: 1,
                editable: true,
                type: "number",
              },
              {
                field: "existencia",
                headerName: "Existencia",
                flex: 1,
                editable: true,
                type: "number",
              }
              
            ]}
            disableRowSelectionOnClick
            processRowUpdate={handleProcessRowUpdate} // Manejo correcto de cambios
          />
        </>
      )}
    </Box>
  );
};


export default PreciosCantidades;
