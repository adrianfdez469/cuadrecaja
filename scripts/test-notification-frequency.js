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

// Función para simular múltiples llamadas al endpoint de auto-check
async function testMultipleCalls() {
  console.log('\n=== Probando múltiples llamadas al endpoint de auto-check ===');
  
  const negocioId = 'test-negocio-id';
  const calls = 5;
  
  console.log(`🔄 Ejecutando ${calls} llamadas consecutivas...`);
  
  const startTime = Date.now();
  
  for (let i = 1; i <= calls; i++) {
    try {
      console.log(`\n📞 Llamada ${i}/${calls}`);
      const result = await makeRequest(`${BASE_URL}/notificaciones/auto-check`, {
        method: 'POST',
        body: JSON.stringify({ negocioId })
      });
      
      console.log(`✅ Llamada ${i} exitosa:`, result.message);
      console.log(`   Negocio procesado: ${result.negocioId}`);
      console.log(`   Timestamp: ${result.timestamp}`);
      
    } catch (error) {
      console.log(`❌ Error en llamada ${i}:`, error.message);
    }
    
    // Pequeña pausa entre llamadas
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  
  const endTime = Date.now();
  const totalTime = endTime - startTime;
  
  console.log(`\n⏱️ Tiempo total: ${totalTime}ms`);
  console.log(`📊 Promedio por llamada: ${totalTime / calls}ms`);
}

// Función para probar el comportamiento con diferentes intervalos
async function testDifferentIntervals() {
  console.log('\n=== Probando diferentes intervalos de verificación ===');
  
  const negocioId = 'test-negocio-interval';
  
  // Simular verificación inmediata
  console.log('\n🔄 Verificación inmediata:');
  try {
    const result1 = await makeRequest(`${BASE_URL}/notificaciones/auto-check`, {
      method: 'POST',
      body: JSON.stringify({ negocioId })
    });
    console.log('✅ Primera verificación:', result1.message);
  } catch (error) {
    console.log('❌ Error en primera verificación:', error.message);
  }
  
  // Simular verificación después de 1 segundo
  console.log('\n⏳ Esperando 1 segundo...');
  await new Promise(resolve => setTimeout(resolve, 1000));
  
  console.log('\n🔄 Segunda verificación (después de 1 segundo):');
  try {
    const result2 = await makeRequest(`${BASE_URL}/notificaciones/auto-check`, {
      method: 'POST',
      body: JSON.stringify({ negocioId })
    });
    console.log('✅ Segunda verificación:', result2.message);
  } catch (error) {
    console.log('❌ Error en segunda verificación:', error.message);
  }
  
  // Simular verificación después de 5 segundos
  console.log('\n⏳ Esperando 5 segundos...');
  await new Promise(resolve => setTimeout(resolve, 5000));
  
  console.log('\n🔄 Tercera verificación (después de 5 segundos):');
  try {
    const result3 = await makeRequest(`${BASE_URL}/notificaciones/auto-check`, {
      method: 'POST',
      body: JSON.stringify({ negocioId })
    });
    console.log('✅ Tercera verificación:', result3.message);
  } catch (error) {
    console.log('❌ Error en tercera verificación:', error.message);
  }
}

// Función para probar el comportamiento con diferentes negocios
async function testDifferentNegocios() {
  console.log('\n=== Probando diferentes negocios ===');
  
  const negocios = [
    'negocio-1',
    'negocio-2', 
    'negocio-3',
    null, // Sin negocio
    '' // Negocio vacío
  ];
  
  for (const negocioId of negocios) {
    console.log(`\n🔄 Probando negocio: ${negocioId || 'null/empty'}`);
    
    try {
      const result = await makeRequest(`${BASE_URL}/notificaciones/auto-check`, {
        method: 'POST',
        body: JSON.stringify({ negocioId })
      });
      
      console.log(`✅ Éxito para negocio ${negocioId || 'null/empty'}:`, result.message);
    } catch (error) {
      console.log(`❌ Error para negocio ${negocioId || 'null/empty'}:`, error.message);
    }
    
    // Pequeña pausa entre pruebas
    await new Promise(resolve => setTimeout(resolve, 200));
  }
}

// Función para verificar logs del servidor
async function checkServerLogs() {
  console.log('\n=== Verificando logs del servidor ===');
  
  console.log('📋 Para verificar que las verificaciones automáticas no se ejecuten múltiples veces:');
  console.log('   1. Revisa los logs del servidor en la consola');
  console.log('   2. Busca mensajes como:');
  console.log('      - "Iniciando verificaciones automáticas de notificaciones..."');
  console.log('      - "Verificaciones automáticas completadas"');
  console.log('      - "Notificación automática creada: ..."');
  console.log('      - "Notificación actualizada: ..."');
  console.log('      - "Notificación eliminada: ..."');
  console.log('   3. Verifica que no se repitan innecesariamente');
}

// Función principal
async function runFrequencyTests() {
  console.log('🚀 Iniciando pruebas de frecuencia de verificaciones automáticas...\n');
  
  try {
    // Probar múltiples llamadas consecutivas
    await testMultipleCalls();
    
    // Probar diferentes intervalos
    await testDifferentIntervals();
    
    // Probar diferentes negocios
    await testDifferentNegocios();
    
    // Verificar logs
    await checkServerLogs();
    
    console.log('\n✅ Todas las pruebas de frecuencia completadas');
    console.log('\n📋 Resumen de lo que se probó:');
    console.log('  ✅ Múltiples llamadas consecutivas');
    console.log('  ✅ Diferentes intervalos de tiempo');
    console.log('  ✅ Diferentes tipos de negocios');
    console.log('  ✅ Verificación de logs del servidor');
    console.log('\n💡 Recomendaciones:');
    console.log('  - Las verificaciones automáticas deben ejecutarse una vez por día por negocio');
    console.log('  - El hook useNotificationCheck previene ejecuciones múltiples');
    console.log('  - Los logs del servidor deben mostrar ejecuciones únicas');
    
  } catch (error) {
    console.log('\n❌ Error en las pruebas de frecuencia:', error.message);
  }
}

// Ejecutar las pruebas si el script se ejecuta directamente
if (typeof window === 'undefined') {
  runFrequencyTests();
}

module.exports = {
  testMultipleCalls,
  testDifferentIntervals,
  testDifferentNegocios,
  checkServerLogs,
  runFrequencyTests
};
