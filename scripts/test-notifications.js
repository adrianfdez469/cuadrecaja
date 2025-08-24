const BASE_URL = 'http://localhost:3000/api';

// Función para hacer peticiones HTTP
async function makeRequest(url, options = {}) {
  try {
    const response = await fetch(url, {
      headers: {
        'Content-Type': 'application/json',
        ...options.headers
      },
      ...options
    });
    
    const data = await response.json();
    
    if (!response.ok) {
      throw new Error(data.error || `HTTP ${response.status}`);
    }
    
    return data;
  } catch (error) {
    console.error(`Error en ${url}:`, error.message);
    throw error;
  }
}

// Función para probar la creación de notificaciones
async function testCreateNotification() {
  console.log('\n=== Probando creación de notificación ===');
  
  const notificationData = {
    titulo: 'Prueba de notificación automática',
    descripcion: 'Esta es una notificación de prueba creada automáticamente para verificar el funcionamiento del sistema.',
    fechaInicio: new Date().toISOString(),
    fechaFin: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(), // 7 días
    nivelImportancia: 'MEDIA',
    tipo: 'NOTIFICACION',
    negociosDestino: '',
    usuariosDestino: ''
  };

  try {
    const result = await makeRequest(`${BASE_URL}/notificaciones`, {
      method: 'POST',
      body: JSON.stringify(notificationData)
    });
    
    console.log('✅ Notificación creada exitosamente:', result);
    return result.id;
  } catch (error) {
    console.log('❌ Error al crear notificación:', error.message);
    return null;
  }
}

// Función para probar la obtención de notificaciones
async function testGetNotifications() {
  console.log('\n=== Probando obtención de notificaciones ===');
  
  try {
    const notifications = await makeRequest(`${BASE_URL}/notificaciones`);
    console.log('✅ Notificaciones obtenidas:', notifications.length, 'notificaciones');
    return notifications;
  } catch (error) {
    console.log('❌ Error al obtener notificaciones:', error.message);
    return [];
  }
}

// Función para probar la obtención de notificaciones activas
async function testGetActiveNotifications() {
  console.log('\n=== Probando obtención de notificaciones activas ===');
  
  try {
    const activeNotifications = await makeRequest(`${BASE_URL}/notificaciones/activas`);
    console.log('✅ Notificaciones activas obtenidas:', activeNotifications.length, 'notificaciones');
    return activeNotifications;
  } catch (error) {
    console.log('❌ Error al obtener notificaciones activas:', error.message);
    return [];
  }
}

// Función para probar el marcado como leída
async function testMarkAsRead(notificationId) {
  console.log('\n=== Probando marcado como leída ===');
  
  try {
    const result = await makeRequest(`${BASE_URL}/notificaciones/${notificationId}/marcar-leida`, {
      method: 'POST'
    });
    
    console.log('✅ Notificación marcada como leída:', result);
  } catch (error) {
    console.log('❌ Error al marcar como leída:', error.message);
  }
}

// Función para probar las estadísticas
async function testGetStats() {
  console.log('\n=== Probando obtención de estadísticas ===');
  
  try {
    const stats = await makeRequest(`${BASE_URL}/notificaciones/stats`);
    console.log('✅ Estadísticas obtenidas:', stats);
  } catch (error) {
    console.log('❌ Error al obtener estadísticas:', error.message);
  }
}

// Función para probar las verificaciones automáticas
async function testAutoCheck() {
  console.log('\n=== Probando verificaciones automáticas ===');
  
  try {
    const result = await makeRequest(`${BASE_URL}/notificaciones/auto-check`, {
      method: 'POST'
    });
    
    console.log('✅ Verificaciones automáticas ejecutadas:', result);
  } catch (error) {
    console.log('❌ Error al ejecutar verificaciones automáticas:', error.message);
  }
}

// Función principal para ejecutar todas las pruebas
async function runAllTests() {
  console.log('🚀 Iniciando pruebas del sistema de notificaciones...\n');
  
  try {
    // Probar creación
    const notificationId = await testCreateNotification();
    
    // Probar obtención
    await testGetNotifications();
    
    // Probar notificaciones activas
    await testGetActiveNotifications();
    
    // Probar marcado como leída (si se creó una notificación)
    if (notificationId) {
      await testMarkAsRead(notificationId);
    }
    
    // Probar estadísticas
    await testGetStats();
    
    // Probar verificaciones automáticas
    await testAutoCheck();
    
    console.log('\n✅ Todas las pruebas completadas');
  } catch (error) {
    console.log('\n❌ Error en las pruebas:', error.message);
  }
}

// Ejecutar las pruebas si el script se ejecuta directamente
if (typeof window === 'undefined') {
  runAllTests();
}

module.exports = {
  testCreateNotification,
  testGetNotifications,
  testGetActiveNotifications,
  testMarkAsRead,
  testGetStats,
  testAutoCheck,
  runAllTests
};
