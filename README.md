This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel
# Script para procesar Excel y manejar duplicados de productos

## ¿Qué hace este script?
Toma un archivo Excel local llamado `archivo.xlsx`, revisa si hay productos duplicados en la columna **Producto** y, si encuentra, concatena el precio (columna **Precio**) al nombre del producto duplicado. El resultado se guarda como `archivo_procesado.xlsx`.

## Cómo usar

1. **Instalar dependencias**
   ```bash
   npm install
   ```

2. **Coloca tu archivo a procesar**
   - Renombra tu archivo de Excel como `archivo.xlsx` y colócalo en la carpeta raíz del proyecto.
   - El archivo debe tener columnas llamadas exactamente `Producto` y `Precio`.

3. **Ejecutar el script**
   ```bash
   npm start
   ```

4. **Obtener resultado**
   - El archivo procesado aparecerá como `archivo_procesado.xlsx` en la misma carpeta.

## Personalización

- Si tu archivo tiene otro nombre, cámbialo en la variable `nombreArchivo` dentro de `procesarExcel.ts`.
The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.

## Correr migraciones
- npx prisma migrate dev 

- Crear .env con datos necesarios.
- Para instalacion se requiere un usuario superadmin, este se genera al pegarle al siguiente endpoint:
https://tu-app.vercel.app/api/init-superadmin?secret=INIT_SECRET

---

## Script utilitario para procesar Excel sin conflictos

Si necesitas procesar un Excel local para eliminar/renombrar duplicados de la columna Producto y concatenar el precio, usa el script utilitario incluido de forma completamente aislada:

1. Ve a la carpeta `/tools/procesar-excel`.
2. Coloca ahí tu archivo llamado `archivo.xlsx`.
3. Instala dependencias locales SOLO en esa carpeta:
   ```bash
   cd tools/procesar-excel
   npm install
   ```
4. Ejecuta el script:
   ```bash
   npm start
   ```
5. El resultado se guardará como `archivo_procesado.xlsx` en la misma carpeta.

> Este script utilitario NO afecta la aplicación principal, no altera dependencias ni scripts globales, y es completamente seguro de usar.
