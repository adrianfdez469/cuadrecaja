// Service Worker personalizado para manejo avanzado de offline
const CACHE_NAME = 'cuadre-caja-v1';
const CRITICAL_PAGES = ['/', '/pos'];
const OFFLINE_QUEUE_KEY = 'offline-sales-queue';

// Instalar SW y pre-cachear páginas críticas
self.addEventListener('install', (event) => {
  console.log('🔧 [SW] Instalando service worker personalizado');
  
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      console.log('📦 [SW] Pre-cacheando páginas críticas');
      return cache.addAll(CRITICAL_PAGES);
    })
  );
  
  // Activar inmediatamente
  self.skipWaiting();
});

// Activar SW y limpiar cachés antiguos
self.addEventListener('activate', (event) => {
  console.log('✅ [SW] Activando service worker');
  
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_NAME && cacheName.startsWith('cuadre-caja-')) {
            console.log('🗑️ [SW] Eliminando caché antiguo:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
  
  // Tomar control inmediatamente
  self.clients.claim();
});

// Interceptar fetch requests
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);
  
  // Solo manejar requests del mismo origen
  if (url.origin !== location.origin) return;
  
  // Estrategia para páginas críticas (/ y /pos)
  if (CRITICAL_PAGES.includes(url.pathname)) {
    event.respondWith(handleCriticalPage(request));
    return;
  }
  
  // Estrategia para API de productos
  if (url.pathname.includes('/api/productos_tienda/') && url.pathname.endsWith('/productos_venta')) {
    event.respondWith(handleProductsAPI(request));
    return;
  }
  
  // Estrategia para API de período
  if (url.pathname.includes('/api/cierre/') && url.pathname.endsWith('/last')) {
    event.respondWith(handlePeriodAPI(request));
    return;
  }
  
  // Estrategia para API de ventas
  if (url.pathname.includes('/api/venta/')) {
    event.respondWith(handleSalesAPI(request));
    return;
  }
  
  // Para otros requests, usar estrategia por defecto
  event.respondWith(handleDefaultRequest(request));
});

// Manejar páginas críticas con Cache First
async function handleCriticalPage(request) {
  try {
    const cachedResponse = await caches.match(request);
    if (cachedResponse) {
      console.log('📱 [SW] Sirviendo página crítica desde caché:', request.url);
      return cachedResponse;
    }
    
    // Si no está en caché, intentar red y cachear
    const networkResponse = await fetch(request);
    if (networkResponse.ok) {
      const cache = await caches.open(CACHE_NAME);
      cache.put(request, networkResponse.clone());
    }
    return networkResponse;
    
  } catch (error) {
    console.log('❌ [SW] Error cargando página crítica:', error);
    
    // Fallback a página offline básica
    return new Response(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>Cuadre Caja - Offline</title>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1">
        </head>
        <body>
          <div style="text-align: center; padding: 50px; font-family: Arial, sans-serif;">
            <h1>📱 Modo Offline</h1>
            <p>La aplicación está funcionando sin conexión</p>
            <p>Los datos se sincronizarán cuando regrese la conexión</p>
            <button onclick="window.location.reload()">Reintentar</button>
          </div>
        </body>
      </html>
    `, {
      headers: { 'Content-Type': 'text/html' },
      status: 200
    });
  }
}

// Manejar API de productos con localStorage fallback
async function handleProductsAPI(request) {
  try {
    // Intentar red primero
    const networkResponse = await fetch(request, { timeout: 5000 });
    if (networkResponse.ok) {
      const data = await networkResponse.clone().json();
      
      // Guardar en localStorage para uso offline
      const tiendaId = request.url.split('/')[4];
      const storageKey = `offline-productos-${tiendaId}`;
      
      try {
        localStorage.setItem(storageKey, JSON.stringify(data));
        localStorage.setItem('offline-productos-timestamp', Date.now().toString());
        console.log('💾 [SW] Productos guardados en localStorage');
      } catch (storageError) {
        console.warn('⚠️ [SW] Error guardando productos en localStorage:', storageError);
      }
      
      return networkResponse;
    }
    
    throw new Error('Network response not ok');
    
  } catch (error) {
    console.log('📱 [SW] Red falló, usando localStorage para productos');
    
    // Fallback a localStorage
    const tiendaId = request.url.split('/')[4];
    const storageKey = `offline-productos-${tiendaId}`;
    const offlineData = localStorage.getItem(storageKey);
    
    if (offlineData) {
      return new Response(offlineData, {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      });
    }
    
    // Si no hay datos offline, devolver array vacío
    return new Response('[]', {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

// Manejar API de período con localStorage fallback
async function handlePeriodAPI(request) {
  try {
    const networkResponse = await fetch(request, { timeout: 3000 });
    if (networkResponse.ok) {
      const data = await networkResponse.clone().json();
      
      // Guardar período en localStorage
      const tiendaId = request.url.split('/')[4];
      const storageKey = `offline-periodo-${tiendaId}`;
      
      try {
        localStorage.setItem(storageKey, JSON.stringify(data));
        console.log('💾 [SW] Período guardado en localStorage');
      } catch (storageError) {
        console.warn('⚠️ [SW] Error guardando período:', storageError);
      }
      
      return networkResponse;
    }
    
    throw new Error('Network response not ok');
    
  } catch (error) {
    console.log('📱 [SW] Red falló, usando localStorage para período');
    
    const tiendaId = request.url.split('/')[4];
    const storageKey = `offline-periodo-${tiendaId}`;
    const offlineData = localStorage.getItem(storageKey);
    
    if (offlineData) {
      return new Response(offlineData, {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      });
    }
    
    // Crear período temporal para testing
    const tempPeriod = {
      id: 'offline-' + Date.now(),
      fechaInicio: new Date().toISOString(),
      fechaFin: null,
      tiendaId: tiendaId,
      totalVentas: 0,
      totalGanancia: 0,
      totalInversion: 0,
      totalTransferencia: 0
    };
    
    return new Response(JSON.stringify(tempPeriod), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

// Manejar API de ventas con queue offline
async function handleSalesAPI(request) {
  try {
    // Intentar enviar al servidor
    const networkResponse = await fetch(request);
    if (networkResponse.ok) {
      console.log('✅ [SW] Venta enviada al servidor exitosamente');
      return networkResponse;
    }
    
    throw new Error('Network response not ok');
    
  } catch (error) {
    console.log('📱 [SW] Venta falló, guardando en queue offline');
    
    // Si es POST (crear venta), guardar en queue
    if (request.method === 'POST') {
      try {
        const body = await request.clone().text();
        const salesQueue = JSON.parse(localStorage.getItem(OFFLINE_QUEUE_KEY) || '[]');
        
        const queueItem = {
          id: 'offline-' + Date.now() + '-' + Math.random().toString(36).substr(2, 9),
          url: request.url,
          method: request.method,
          body: body,
          headers: Object.fromEntries(request.headers.entries()),
          timestamp: Date.now(),
          attempts: 0,
        };
        
        salesQueue.push(queueItem);
        localStorage.setItem(OFFLINE_QUEUE_KEY, JSON.stringify(salesQueue));
        
        console.log('💾 [SW] Venta guardada en queue offline:', queueItem.id);
        
        // Devolver respuesta simulada de éxito
        return new Response(JSON.stringify({
          id: queueItem.id,
          success: true,
          offline: true,
          message: 'Venta guardada offline, se sincronizará automáticamente'
        }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' }
        });
        
      } catch (queueError) {
        console.error('❌ [SW] Error guardando venta en queue:', queueError);
      }
    }
    
    // Para otros métodos o errores, devolver error
    return new Response(JSON.stringify({
      error: 'Network unavailable',
      offline: true
    }), {
      status: 503,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

// Manejar otros requests con estrategia por defecto
async function handleDefaultRequest(request) {
  try {
    return await fetch(request);
  } catch (error) {
    // Intentar caché como fallback
    const cachedResponse = await caches.match(request);
    if (cachedResponse) {
      return cachedResponse;
    }
    
    throw error;
  }
}

// Sincronización en background cuando regresa la conexión
self.addEventListener('sync', (event) => {
  if (event.tag === 'background-sync-sales') {
    console.log('🔄 [SW] Iniciando sincronización de ventas en background');
    event.waitUntil(syncOfflineSales());
  }
});

// Función para sincronizar ventas offline
async function syncOfflineSales() {
  try {
    const salesQueue = JSON.parse(localStorage.getItem(OFFLINE_QUEUE_KEY) || '[]');
    
    if (salesQueue.length === 0) {
      console.log('✅ [SW] No hay ventas pendientes de sincronizar');
      return;
    }
    
    console.log(`🔄 [SW] Sincronizando ${salesQueue.length} ventas offline`);
    
    const syncedSales = [];
    const failedSales = [];
    
    for (const sale of salesQueue) {
      try {
        const response = await fetch(sale.url, {
          method: sale.method,
          headers: sale.headers,
          body: sale.body,
        });
        
        if (response.ok) {
          console.log('✅ [SW] Venta sincronizada:', sale.id);
          syncedSales.push(sale.id);
          
          // Notificar a la aplicación
          self.clients.matchAll().then(clients => {
            clients.forEach(client => {
              client.postMessage({
                type: 'SALE_SYNCED',
                saleId: sale.id,
                response: response.json()
              });
            });
          });
        } else {
          throw new Error(`HTTP ${response.status}`);
        }
        
      } catch (syncError) {
        console.log('❌ [SW] Error sincronizando venta:', sale.id, syncError);
        sale.attempts = (sale.attempts || 0) + 1;
        
        if (sale.attempts < 3) {
          failedSales.push(sale);
        } else {
          console.log('❌ [SW] Venta descartada después de 3 intentos:', sale.id);
        }
      }
    }
    
    // Actualizar queue con ventas no sincronizadas
    localStorage.setItem(OFFLINE_QUEUE_KEY, JSON.stringify(failedSales));
    
    console.log(`✅ [SW] Sincronización completada: ${syncedSales.length} exitosas, ${failedSales.length} pendientes`);
    
  } catch (error) {
    console.error('❌ [SW] Error en sincronización:', error);
  }
}

// Manejar mensajes de la aplicación
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SYNC_SALES') {
    console.log('📨 [SW] Solicitud de sincronización manual');
    syncOfflineSales();
  }
  
  if (event.data && event.data.type === 'CLEAR_OFFLINE_DATA') {
    console.log('🗑️ [SW] Limpiando datos offline');
    localStorage.removeItem(OFFLINE_QUEUE_KEY);
    // Limpiar otros datos offline si es necesario
  }
});

console.log('🚀 [SW] Service Worker personalizado cargado y listo'); 