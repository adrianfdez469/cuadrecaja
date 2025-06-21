import { Document, Packer, Paragraph, Table, TableCell, TableRow, WidthType, AlignmentType, TextRun, HeadingLevel } from 'docx';
import { saveAs } from 'file-saver';
import { IProductoTienda } from '@/types/IProducto';

interface ExportInventoryOptions {
  productos: IProductoTienda[];
  tiendaNombre: string;
  fecha?: Date;
}

export const exportInventoryToWord = async ({
  productos,
  tiendaNombre,
  fecha = new Date()
}: ExportInventoryOptions) => {
  try {
    // Agrupar productos por categoría
    const productosPorCategoria = productos.reduce((acc, producto) => {
      const categoriaNombre = producto.categoria.nombre;
      if (!acc[categoriaNombre]) {
        acc[categoriaNombre] = [];
      }
      acc[categoriaNombre].push(producto);
      return acc;
    }, {} as Record<string, IProductoTienda[]>);

    // Ordenar categorías alfabéticamente
    const categoriasOrdenadas = Object.keys(productosPorCategoria).sort();

    // Ordenar productos dentro de cada categoría alfabéticamente
    categoriasOrdenadas.forEach(categoria => {
      productosPorCategoria[categoria] = productosPorCategoria[categoria].sort((a, b) => 
        a.nombre.localeCompare(b.nombre)
      );
    });

    // Crear filas de la tabla
    const tableRows = [
      // Fila de encabezados
      new TableRow({
        children: [
          new TableCell({
            children: [
              new Paragraph({
                children: [
                  new TextRun({
                    text: "Producto",
                    bold: true,
                    size: 24, // 12pt
                  })
                ],
                alignment: AlignmentType.CENTER,
              })
            ],
            width: {
              size: 30,
              type: WidthType.PERCENTAGE,
            },
          }),
          new TableCell({
            children: [
              new Paragraph({
                children: [
                  new TextRun({
                    text: "Precio",
                    bold: true,
                    size: 24,
                  })
                ],
                alignment: AlignmentType.CENTER,
              })
            ],
            width: {
              size: 15,
              type: WidthType.PERCENTAGE,
            },
          }),
          new TableCell({
            children: [
              new Paragraph({
                children: [
                  new TextRun({
                    text: "Cantidad Inicial",
                    bold: true,
                    size: 24,
                  })
                ],
                alignment: AlignmentType.CENTER,
              })
            ],
            width: {
              size: 15,
              type: WidthType.PERCENTAGE,
            },
          }),
          new TableCell({
            children: [
              new Paragraph({
                children: [
                  new TextRun({
                    text: "Cantidad Vendida",
                    bold: true,
                    size: 24,
                  })
                ],
                alignment: AlignmentType.CENTER,
              })
            ],
            width: {
              size: 25,
              type: WidthType.PERCENTAGE,
            },
          }),
          new TableCell({
            children: [
              new Paragraph({
                children: [
                  new TextRun({
                    text: "Cantidad Final",
                    bold: true,
                    size: 24,
                  })
                ],
                alignment: AlignmentType.CENTER,
              })
            ],
            width: {
              size: 15,
              type: WidthType.PERCENTAGE,
            },
          }),
        ],
      }),
    ];

    // Agregar filas por categoría
    categoriasOrdenadas.forEach(categoriaNombre => {
      // Fila de categoría
      tableRows.push(
        new TableRow({
          children: [
            new TableCell({
              children: [
                new Paragraph({
                  children: [
                    new TextRun({
                      text: categoriaNombre.toUpperCase(),
                      bold: true,
                      size: 24,
                      color: "FFFFFF", // Texto blanco
                    })
                  ],
                  alignment: AlignmentType.CENTER,
                })
              ],
              columnSpan: 5, // Ocupa todas las columnas
              shading: {
                fill: "4472C4", // Fondo azul
              },
            }),
          ],
        })
      );

      // Filas de productos de esta categoría
      productosPorCategoria[categoriaNombre].forEach(producto => {
        tableRows.push(
          new TableRow({
            children: [
              new TableCell({
                children: [
                  new Paragraph({
                    children: [
                      new TextRun({
                        text: producto.nombre,
                        size: 22, // 11pt
                      })
                    ],
                  })
                ],
              }),
              new TableCell({
                children: [
                  new Paragraph({
                    children: [
                      new TextRun({
                        text: `$${producto.precio.toFixed(2)}`,
                        size: 22,
                      })
                    ],
                    alignment: AlignmentType.RIGHT,
                  })
                ],
              }),
              new TableCell({
                children: [
                  new Paragraph({
                    children: [
                      new TextRun({
                        text: "", // Columna vacía como solicitado
                        size: 22,
                      })
                    ],
                  })
                ],
              }),
              new TableCell({
                children: [
                  new Paragraph({
                    children: [
                      new TextRun({
                        text: "", // Columna vacía como solicitado
                        size: 22,
                      })
                    ],
                  })
                ],
              }),
              new TableCell({
                children: [
                  new Paragraph({
                    children: [
                      new TextRun({
                        text: "", // Columna vacía como solicitado
                        size: 22,
                      })
                    ],
                  })
                ],
              }),
            ],
          })
        );
      });
    });

    // Crear el documento
    const doc = new Document({
      sections: [
        {
          children: [
            // Título del documento
            new Paragraph({
              children: [
                new TextRun({
                  text: `Inventario de Productos - ${tiendaNombre}`,
                  bold: true,
                  size: 32, // 16pt
                })
              ],
              heading: HeadingLevel.HEADING_1,
              alignment: AlignmentType.CENTER,
              spacing: {
                after: 400, // Espacio después del título
              },
            }),
            // Fecha
            new Paragraph({
              children: [
                new TextRun({
                  text: `Fecha: ${fecha.toLocaleDateString('es-ES', {
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric'
                  })}`,
                  size: 24,
                })
              ],
              alignment: AlignmentType.CENTER,
              spacing: {
                after: 400,
              },
            }),
            // Tabla de productos
            new Table({
              rows: tableRows,
              width: {
                size: 100,
                type: WidthType.PERCENTAGE,
              },
            }),
          ],
        },
      ],
    });

    // Generar y descargar el archivo
    const blob = await Packer.toBlob(doc);
    const fileName = `Inventario_${tiendaNombre.replace(/\s+/g, '_')}_${fecha.toISOString().split('T')[0]}.docx`;
    
    saveAs(blob, fileName);
    
    return true;
  } catch (error) {
    console.error('Error al generar el documento Word:', error);
    throw new Error('Error al generar el documento Word');
  }
}; 