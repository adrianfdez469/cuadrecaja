import type { NextConfig } from "next";
import withPWA from "next-pwa";

const nextConfig: NextConfig = {
  /* config options here */
  reactStrictMode: true,
  // Optimización para PWA offline
  experimental: {
    optimizePackageImports: ['@mui/material', '@mui/icons-material'],
  },
  // Configuración de chunks para mejor caché
  webpack: (config, { dev, isServer }) => {
    if (!dev && !isServer) {
      // Optimizar chunks para páginas críticas
      config.optimization.splitChunks = {
        ...config.optimization.splitChunks,
        cacheGroups: {
          ...config.optimization.splitChunks?.cacheGroups,
          // Chunk específico para POS
          pos: {
            name: 'pos',
            test: /[\\/]src[\\/]app[\\/]pos[\\/]/,
            chunks: 'all',
            priority: 30,
          },
          // Chunk específico para componentes offline
          offline: {
            name: 'offline',
            test: /[\\/]src[\\/](hooks|components)[\\/](useOffline|OfflineAccess|OfflineBanner)/,
            chunks: 'all',
            priority: 25,
          },
          // Material-UI separado
          mui: {
            name: 'mui',
            test: /[\\/]node_modules[\\/]@mui[\\/]/,
            chunks: 'all',
            priority: 20,
          },
        },
      };
    }
    return config;
  },
};

export default withPWA({
  dest: "public",
  register: true,
  skipWaiting: true,
  disable: process.env.NODE_ENV === "development",
  runtimeCaching: [
    // ========== RUTAS CRÍTICAS - CACHE FIRST ==========
    {
      urlPattern: /^\/$/,
      handler: "CacheFirst",
      options: {
        cacheName: "critical-pages",
        expiration: {
          maxEntries: 10,
          maxAgeSeconds: 7 * 24 * 60 * 60, // 7 días
        },
      },
    },
    {
      urlPattern: /^\/pos$/,
      handler: "CacheFirst", 
      options: {
        cacheName: "critical-pages",
        expiration: {
          maxEntries: 10,
          maxAgeSeconds: 7 * 24 * 60 * 60, // 7 días
        },
      },
    },
    
    // ========== API CALLS - ESTRATEGIA OFFLINE ==========
    {
      urlPattern: /^\/api\/productos_tienda\/.*\/productos_venta$/,
      handler: "NetworkFirst",
      options: {
        cacheName: "pos-products-cache",
        networkTimeoutSeconds: 5,
        expiration: {
          maxEntries: 20,
          maxAgeSeconds: 2 * 60 * 60, // 2 horas
        },
      },
    },
    {
      urlPattern: /^\/api\/cierre\/.*\/last$/,
      handler: "NetworkFirst",
      options: {
        cacheName: "pos-period-cache",
        networkTimeoutSeconds: 3,
        expiration: {
          maxEntries: 10,
          maxAgeSeconds: 30 * 60, // 30 minutos
        },
      },
    },
    
    // ========== VENTAS - NETWORK ONLY ==========
    {
      urlPattern: /^\/api\/venta\/.*$/,
      handler: "NetworkOnly",
    },
    
    // ========== OTRAS APIS - NETWORK FIRST ==========
    {
      urlPattern: /^\/api\/(?!productos_tienda|cierre.*\/last|venta).*$/,
      handler: "NetworkFirst",
      options: {
        cacheName: "api-cache",
        networkTimeoutSeconds: 8,
        expiration: {
          maxEntries: 30,
          maxAgeSeconds: 10 * 60, // 10 minutos
        },
      },
    },
    
    // ========== RECURSOS ESTÁTICOS ==========
    {
      urlPattern: /^https?.*\.(png|jpg|jpeg|svg|gif|webp|ico)$/,
      handler: "CacheFirst",
      options: {
        cacheName: "images",
        expiration: {
          maxEntries: 100,
          maxAgeSeconds: 30 * 24 * 60 * 60, // 30 días
        },
      },
    },
    {
      urlPattern: /^https?.*\.(js|css|woff|woff2|ttf|eot)$/,
      handler: "CacheFirst",
      options: {
        cacheName: "static-resources",
        expiration: {
          maxEntries: 200,
          maxAgeSeconds: 30 * 24 * 60 * 60, // 30 días
        },
      },
    },
    
    // ========== OTRAS PÁGINAS - NETWORK FIRST ==========
    {
      urlPattern: /^\/(?!pos$|$).*$/,
      handler: "NetworkFirst",
      options: {
        cacheName: "pages-cache",
        networkTimeoutSeconds: 10,
        expiration: {
          maxEntries: 30,
          maxAgeSeconds: 12 * 60 * 60, // 12 horas
        },
      },
    },
  ],
})(nextConfig);
