export interface IDemoCategoria {
  nombre: string;
  color: string;
}

export interface IDemoProducto {
  nombre: string;
  descripcion: string;
  categoria: string;
  costo: number;
  precio: number;
  existencia: number;
}

export const DEMO_CATEGORIAS: IDemoCategoria[] = [
  { nombre: 'Bebidas', color: '#2196F3' },
  { nombre: 'Snacks', color: '#FF9800' },
  { nombre: 'Lácteos', color: '#4CAF50' },
  { nombre: 'Aseo Personal', color: '#9C27B0' },
];

export const DEMO_PRODUCTOS: IDemoProducto[] = [
  { nombre: 'Agua Mineral 500ml', descripcion: 'Agua mineral natural', categoria: 'Bebidas', costo: 0.5, precio: 1.0, existencia: 50 },
  { nombre: 'Refresco Cola 355ml', descripcion: 'Refresco sabor cola en lata', categoria: 'Bebidas', costo: 0.8, precio: 1.5, existencia: 30 },
  { nombre: 'Jugo de Naranja 1L', descripcion: 'Jugo 100% natural de naranja', categoria: 'Bebidas', costo: 1.2, precio: 2.5, existencia: 20 },
  { nombre: 'Papas Fritas', descripcion: 'Papas fritas en bolsa 50g', categoria: 'Snacks', costo: 0.6, precio: 1.25, existencia: 40 },
  { nombre: 'Galletas Oreo', descripcion: 'Galletas Oreo pack 154g', categoria: 'Snacks', costo: 1.0, precio: 2.0, existencia: 25 },
  { nombre: 'Chocolate Barra', descripcion: 'Chocolate con leche 100g', categoria: 'Snacks', costo: 0.9, precio: 1.75, existencia: 18 },
  { nombre: 'Leche Entera 1L', descripcion: 'Leche entera pasteurizada', categoria: 'Lácteos', costo: 1.2, precio: 2.5, existencia: 20 },
  { nombre: 'Yogur Natural 200g', descripcion: 'Yogur natural sin azúcar', categoria: 'Lácteos', costo: 0.9, precio: 1.75, existencia: 15 },
  { nombre: 'Queso Fresco 250g', descripcion: 'Queso fresco artesanal', categoria: 'Lácteos', costo: 2.0, precio: 4.0, existencia: 12 },
  { nombre: 'Jabón de Baño', descripcion: 'Jabón de baño barra 90g', categoria: 'Aseo Personal', costo: 0.7, precio: 1.5, existencia: 35 },
  { nombre: 'Shampoo 400ml', descripcion: 'Shampoo para todo tipo de cabello', categoria: 'Aseo Personal', costo: 2.5, precio: 5.0, existencia: 10 },
  { nombre: 'Pasta Dental 75ml', descripcion: 'Pasta dental con flúor', categoria: 'Aseo Personal', costo: 1.0, precio: 2.0, existencia: 22 },
];
