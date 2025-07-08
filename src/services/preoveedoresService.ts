import { IProveedorConsignacion } from "@/types/IProveedorConsignación";
import axios from "axios";


const API_URL = "/api/proveedores-consignadores";

export const sumDineroLiquidado = (acc, item) => {
    if(item.liquidatedAt !== null) {
        acc += item.monto
    }
    return acc;
};

export const sumDineroPorLiquidar = (acc, item) => {
    if(item.liquidatedAt === null) {
        acc += item.monto
    }
    return acc;
};

export const sumProdsConsignación = (acc, item) => {
    acc += item.existencia;
    return acc;
}

export const findUltimaLiquidacion = (acc, item) => {
    if(item.liquidatedAt === null) {
        return acc;
    }
    if(acc === null) {
        return item.liquidatedAt;
    } 
    if(acc < item.liquidatedAt) {
        return item.liquidatedAt;
    } 
    return acc;
}

export const getProveedoresConsignacion = async (): Promise<IProveedorConsignacion[]> => {
    const response = await axios.get(API_URL);
    const data = response.data.map((proveedor) => {
        const pclc = proveedor.prodProveedorConsignadorLiquidacionCierre;
        const dataProveedor:IProveedorConsignacion = {
            nombre: proveedor.nombre,
            telefono: proveedor.telefono,
            direccion: proveedor.direccion,
            id: proveedor.id,
            estado: 'activo',  
            dineroLiquidado: pclc.reduce(sumDineroLiquidado, 0),
            dineroPorLiquidar: pclc.reduce(sumDineroPorLiquidar, 0),
            totalProductosConsignacion: pclc.reduce(sumProdsConsignación, 0),
            ultimaLiquidacion: pclc.reduce(findUltimaLiquidacion, null)
        }
       return dataProveedor; 
    });
    return data;
}

export const getProveedoresConsignacionById = async (id: string) => {
    const response = await axios.get(`${API_URL}/${id}`);
    return response.data;
    
}