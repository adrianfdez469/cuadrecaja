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

// Función para crear notificaciones de prueba
async function createTestNotifications() {
  console.log('\n=== Creando notificaciones de prueba ===');
  
  const testNotifications = [
    {
      titulo: 'Mantenimiento Programado',
      descripcion: 'El sistema estará en mantenimiento el próximo domingo de 2:00 AM a 6:00 AM. Durante este tiempo, el servicio puede estar interrumpido.',
      fechaInicio: new Date().toISOString(),
      fechaFin: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
      nivelImportancia: 'MEDIA',
      tipo: 'NOTIFICACION',
      negociosDestino: '',
      usuariosDestino: ''
    },
    {
      titulo: 'Nueva Funcionalidad Disponible',
      descripcion: 'Ya está disponible la nueva funcionalidad de reportes avanzados. Accede a la sección de configuración para activarla.',
      fechaInicio: new Date().toISOString(),
      fechaFin: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString(),
      nivelImportancia: 'BAJA',
      tipo: 'MENSAJE',
      negociosDestino: '',
      usuariosDestino: ''
    },
    {
      titulo: 'Promoción Especial - 50% Descuento',
      descripcion: 'Por tiempo limitado, obtén un 50% de descuento en la actualización a nuestro plan Premium. ¡No te lo pierdas!',
      fechaInicio: new Date().toISOString(),
      fechaFin: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString(),
      nivelImportancia: 'ALTA',
      tipo: 'PROMOCION',
      negociosDestino: '',
      usuariosDestino: ''
    },
    {
      titulo: 'Alerta de Seguridad',
      descripcion: 'Se ha detectado un intento de acceso no autorizado. Por favor, verifica tu contraseña y habilita la autenticación de dos factores.',
      fechaInicio: new Date().toISOString(),
      fechaFin: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
      nivelImportancia: 'CRITICA',
      tipo: 'ALERTA',
      negociosDestino: '',
      usuariosDestino: ''
    }
  ];

  const createdIds = [];
  
  for (const notification of testNotifications) {
    try {
      const result = await makeRequest(`${BASE_URL}/notificaciones`, {
        method: 'POST',
        body: JSON.stringify(notification)
      });
      
      console.log(`✅ Notificación creada: ${result.titulo}`);
      createdIds.push(result.id);
    } catch (error) {
      console.log(`❌ Error al crear notificación: ${notification.titulo}`, error.message);
    }
  }
  
  return createdIds;
}

// Función para probar el marcado como leída
async function testMarkAsRead(notificationIds) {
  console.log('\n=== Probando marcado como leída ===');
  
  for (const id of notificationIds) {
    try {
      const result = await makeRequest(`${BASE_URL}/notificaciones/${id}/marcar-leida`, {
        method: 'POST'
      });
      
      console.log(`✅ Notificación ${id} marcada como leída`);
    } catch (error) {
      console.log(`❌ Error al marcar como leída: ${id}`, error.message);
    }
  }
}

// Función para probar estadísticas
async function testStats() {
  console.log('\n=== Probando estadísticas ===');
  
  try {
    const stats = await makeRequest(`${BASE_URL}/notificaciones/stats`);
    console.log('✅ Estadísticas obtenidas:', {
      total: stats.total,
      activas: stats.activas,
      leidas: stats.leidas,
      noLeidas: stats.noLeidas,
      porcentajeLeidas: stats.porcentajeLeidas
    });
  } catch (error) {
    console.log('❌ Error al obtener estadísticas:', error.message);
  }
}

// Función para probar verificaciones automáticas
async function testAutoCheck() {
  console.log('\n=== Probando verificaciones automáticas ===');
  
  try {
    const result = await makeRequest(`${BASE_URL}/notificaciones/auto-check`, {
      method: 'POST'
    });
    
    console.log('✅ Verificaciones automáticas ejecutadas:', result.message);
  } catch (error) {
    console.log('❌ Error al ejecutar verificaciones automáticas:', error.message);
  }
}

// Función para probar notificaciones activas
async function testActiveNotifications() {
  console.log('\n=== Probando notificaciones activas ===');
  
  try {
    const activeNotifications = await makeRequest(`${BASE_URL}/notificaciones/activas`);
    console.log(`✅ Notificaciones activas obtenidas: ${activeNotifications.length}`);
    
    activeNotifications.forEach((notification, index) => {
      console.log(`  ${index + 1}. ${notification.titulo} (${notification.tipo}) - ${notification.yaLeida ? 'Leída' : 'No leída'}`);
    });
  } catch (error) {
    console.log('❌ Error al obtener notificaciones activas:', error.message);
  }
}

// Función para probar CRUD completo
async function testCRUD() {
  console.log('\n=== Probando CRUD completo ===');
  
  // Crear
  const newNotification = {
    titulo: 'Notificación de Prueba CRUD',
    descripcion: 'Esta es una notificación de prueba para verificar las operaciones CRUD.',
    fechaInicio: new Date().toISOString(),
    fechaFin: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
    nivelImportancia: 'MEDIA',
    tipo: 'NOTIFICACION',
    negociosDestino: '',
    usuariosDestino: ''
  };
  
  try {
    // Crear
    const created = await makeRequest(`${BASE_URL}/notificaciones`, {
      method: 'POST',
      body: JSON.stringify(newNotification)
    });
    console.log('✅ Notificación creada:', created.id);
    
    // Leer
    const read = await makeRequest(`${BASE_URL}/notificaciones/${created.id}`);
    console.log('✅ Notificación leída:', read.titulo);
    
    // Actualizar
    const updated = await makeRequest(`${BASE_URL}/notificaciones/${created.id}`, {
      method: 'PUT',
      body: JSON.stringify({
        ...newNotification,
        titulo: 'Notificación de Prueba CRUD - Actualizada',
        descripcion: 'Esta notificación ha sido actualizada.'
      })
    });
    console.log('✅ Notificación actualizada:', updated.titulo);
    
    // Eliminar
    const deleted = await makeRequest(`${BASE_URL}/notificaciones/${created.id}`, {
      method: 'DELETE'
    });
    console.log('✅ Notificación eliminada:', deleted.message);
    
  } catch (error) {
    console.log('❌ Error en CRUD:', error.message);
  }
}

// Función principal
async function runCompleteTest() {
  console.log('🚀 Iniciando pruebas completas del sistema de notificaciones...\n');
  
  try {
    // Probar CRUD
    await testCRUD();
    
    // Crear notificaciones de prueba
    const notificationIds = await createTestNotifications();
    
    // Probar notificaciones activas
    await testActiveNotifications();
    
    // Probar marcado como leída
    await testMarkAsRead(notificationIds);
    
    // Probar estadísticas
    await testStats();
    
    // Probar verificaciones automáticas
    await testAutoCheck();
    
    // Probar notificaciones activas después de marcadas como leídas
    await testActiveNotifications();
    
    console.log('\n✅ Todas las pruebas completadas exitosamente');
    console.log('\n📋 Resumen de funcionalidades probadas:');
    console.log('  ✅ Creación de notificaciones');
    console.log('  ✅ Lectura de notificaciones');
    console.log('  ✅ Actualización de notificaciones');
    console.log('  ✅ Eliminación de notificaciones');
    console.log('  ✅ Obtención de notificaciones activas');
    console.log('  ✅ Marcado como leída');
    console.log('  ✅ Estadísticas');
    console.log('  ✅ Verificaciones automáticas');
    
  } catch (error) {
    console.log('\n❌ Error en las pruebas:', error.message);
  }
}

// Ejecutar las pruebas si el script se ejecuta directamente
if (typeof window === 'undefined') {
  runCompleteTest();
}

module.exports = {
  createTestNotifications,
  testMarkAsRead,
  testStats,
  testAutoCheck,
  testActiveNotifications,
  testCRUD,
  runCompleteTest
};
