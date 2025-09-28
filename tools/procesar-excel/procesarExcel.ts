import * as XLSX from "xlsx";
import * as path from "path";
import * as fs from "fs";

// Cambia el nombre de tu archivo aquí si es necesario
const nombreArchivo = "archivo.xlsx";

// Verificamos que el archivo exista
if (!fs.existsSync(nombreArchivo)) {
  console.error(`No se encontró el archivo: ${nombreArchivo}`);
  process.exit(1);
}

// Leemos el archivo excel
const workbook = XLSX.readFile(nombreArchivo);
const nombreHoja = workbook.SheetNames[0];
const worksheet = workbook.Sheets[nombreHoja];

// Convertimos la hoja a objetos JSON
const datos: any[] = XLSX.utils.sheet_to_json(worksheet, { defval: "" });

// Si el archivo está vacío o sin filas, salimos
if (datos.length === 0) {
  console.error("El archivo no contiene filas.");
  process.exit(1);
}

// Identificamos los nombres de campo
const columnas = Object.keys(datos[0]);
const columnaProducto = columnas.find(c =>
  c.trim().toLowerCase() === "producto"
);
const columnaPrecio = columnas.find(c =>
  c.trim().toLowerCase() === "precio"
);

if (!columnaProducto || !columnaPrecio) {
  console.error("No se encontraron las columnas 'Producto' y 'Precio'.");
  process.exit(1);
}

type Dato = { [key: string]: any };

// Creamos un mapa de productos para detectar duplicados
const mapaProductos = new Map<string, number[]>();

datos.forEach((fila, idx) => {
  const nombreProducto = String(fila[columnaProducto]).trim();
  if (!mapaProductos.has(nombreProducto)) {
    mapaProductos.set(nombreProducto, []);
  }
  mapaProductos.get(nombreProducto)?.push(idx);
});

// Vamos a procesar los duplicados
const filasProcesadas: Dato[] = [...datos]; // Clonamos por seguridad

for (const [producto, indices] of mapaProductos) {
  if (indices.length > 1) {
    // Para cada repetido (excepto la primera instancia)
    // Concatenar el precio al nombre
    for (let i = 1; i < indices.length; i++) {
      const idx = indices[i];
      const precio = filasProcesadas[idx][columnaPrecio];
      filasProcesadas[idx][columnaProducto] = `${producto} ${precio}`;
    }
  }
}

// Escribimos los nuevos datos en un archivo de salida
const nuevaHoja = XLSX.utils.json_to_sheet(filasProcesadas);
const nuevoLibro = XLSX.utils.book_new();
XLSX.utils.book_append_sheet(nuevoLibro, nuevaHoja, "Procesado");

const nombreArchivoSalida = path.basename(nombreArchivo, path.extname(nombreArchivo)) + "_procesado.xlsx";
XLSX.writeFile(nuevoLibro, nombreArchivoSalida);

console.log(`Archivo procesado guardado en: ${nombreArchivoSalida}`);
