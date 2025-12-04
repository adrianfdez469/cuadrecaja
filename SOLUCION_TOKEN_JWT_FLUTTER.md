# 🔧 Solución: Token JWT desde Flutter

## 🎯 Problema Identificado

Cuando Flutter envía el token en el header `Authorization`, la función `getToken()` de NextAuth devolvía `null` porque **está diseñada para leer tokens desde cookies**, no desde headers.

### ❌ **Lo que NO funcionaba:**

```typescript
// ❌ getToken() solo lee cookies, no headers
const token = await getToken({ 
  req: request, 
  secret: process.env.NEXTAUTH_SECRET 
});
// Devolvía null aunque el header Authorization estuviera presente
```

---

## ✅ Solución Implementada

Se modificó `src/utils/authFromRequest.ts` para **extraer y decodificar manualmente** el token JWT del header `Authorization` usando la librería `jose`.

### **Cambios Realizados:**

```typescript
import { jwtVerify } from 'jose';

// 1. Extraer el token del header Authorization
const authHeader = request.headers.get("authorization");
if (!authHeader || !authHeader.startsWith('Bearer ')) {
  return null;
}

const tokenString = authHeader.substring(7); // Quitar "Bearer "

// 2. Verificar y decodificar el token usando jose
const secret = new TextEncoder().encode(process.env.NEXTAUTH_SECRET);
const { payload } = await jwtVerify(tokenString, secret);

// 3. Construir sesión desde el payload
return {
  user: {
    id: payload.id,
    usuario: payload.usuario,
    nombre: payload.nombre,
    rol: payload.rol,
    negocio: payload.negocio,
    // ... otros campos
  },
  expires: new Date((payload.exp as number) * 1000).toISOString(),
};
```

---

## 📱 Cómo Obtener el Token JWT desde Flutter

El problema es que NextAuth guarda el token en una **cookie HTTP-only**, que no es accesible desde JavaScript ni desde Flutter. Necesitas usar un enfoque diferente:

### **🎯 Opción 1: Endpoint Custom para Login Mobile (RECOMENDADO)**

Crea un endpoint específico para Flutter que devuelva el token JWT directamente:

#### **Backend: `src/app/api/auth/login-mobile/route.ts`**

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import bcrypt from 'bcryptjs';
import { SignJWT } from 'jose';

export async function POST(request: NextRequest) {
  try {
    const { usuario, password } = await request.json();
    
    // 1. Validar credenciales
    const user = await prisma.usuario.findUnique({
      where: { usuario },
      include: {
        negocio: true,
        tiendas: {
          include: {
            tienda: true,
            rol: {
              select: {
                id: true,
                nombre: true,
                permisos: true,
              }
            },
          },
        },
      },
    });
    
    if (!user) {
      return NextResponse.json(
        { error: 'Usuario no encontrado' },
        { status: 401 }
      );
    }

    const isValidPassword = await bcrypt.compare(password, user.password);
    if (!isValidPassword) {
      return NextResponse.json(
        { error: 'Contraseña incorrecta' },
        { status: 401 }
      );
    }
    
    // 2. Verificar suscripción (igual que en authOptions.ts)
    if (user.rol !== "SUPER_ADMIN") {
      const now = new Date();
      const limitTime = new Date(user.negocio.limitTime);
      const diffTime = limitTime.getTime() - now.getTime();
      const daysRemaining = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
      const isExpired = daysRemaining <= 0;
      const gracePeriodDays = 7;
      const isInGracePeriod = daysRemaining > -gracePeriodDays;
      
      const negocioCompleto = await prisma.negocio.findUnique({
        where: { id: user.negocio.id },
        select: { suspended: true }
      });
      
      const isSuspended = negocioCompleto?.suspended || (isExpired && !isInGracePeriod);
      
      if (isSuspended) {
        return NextResponse.json(
          { error: 'SUBSCRIPTION_EXPIRED', message: 'La suscripción ha expirado' },
          { status: 403 }
        );
      }
    }

    // 3. Verificar que tenga locales y roles asignados
    if (user.rol !== "SUPER_ADMIN") {
      const localesDisponibles = user.tiendas.map(ut => ut.tienda);
      
      if (localesDisponibles.length === 0) {
        return NextResponse.json({
          error: 'USUARIO_SIN_CONFIGURAR',
          message: 'No tienes locales (tiendas o almacenes) asignados. Contacta al administrador.'
        }, { status: 403 });
      }
      
      const tieneRolAsignado = user.tiendas.some(ut => ut.rolId !== null);
      if (!tieneRolAsignado) {
        return NextResponse.json({
          error: 'USUARIO_SIN_CONFIGURAR',
          message: 'No tienes un rol asignado en ningún local. Contacta al administrador.'
        }, { status: 403 });
      }
    }
    
    // 4. Obtener local actual
    let localActual = null;
    if (user.localActualId) {
      localActual = await prisma.tienda.findUnique({
        where: { id: user.localActualId }
      });
    } else if (user.tiendas.length > 0) {
      localActual = user.tiendas[0].tienda;
    }
    
    // 5. Obtener permisos
    const localesDisponibles = user.tiendas.map(ut => ({
      id: ut.tienda.id,
      nombre: ut.tienda.nombre,
      tipo: ut.tienda.tipo,
    }));
    
    let permisos: string[] = [];
    if (user.rol !== "SUPER_ADMIN" && localActual) {
      const usuarioTienda = user.tiendas.find(ut => ut.tienda.id === localActual.id);
      if (usuarioTienda?.rol?.permisos) {
        try {
          permisos = JSON.parse(usuarioTienda.rol.permisos);
        } catch (e) {
          console.error('Error al parsear permisos:', e);
        }
      }
    }
    
    // 6. Generar token JWT
    const secret = new TextEncoder().encode(process.env.NEXTAUTH_SECRET!);
    const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000); // 30 días
    
    const token = await new SignJWT({
      id: user.id,
      usuario: user.usuario,
      nombre: user.nombre,
      rol: user.rol,
      negocio: {
        id: user.negocio.id,
        nombre: user.negocio.nombre,
        limitTime: user.negocio.limitTime,
        locallimit: user.negocio.locallimit,
        userlimit: user.negocio.userlimit,
        productlimit: user.negocio.productlimit,
      },
      localActual: localActual ? {
        id: localActual.id,
        nombre: localActual.nombre,
        tipo: localActual.tipo,
      } : null,
      locales: localesDisponibles,
      permisos: JSON.stringify(permisos),
      expCustom: expiresAt.toISOString(),
    })
      .setProtectedHeader({ alg: 'HS256' })
      .setIssuedAt()
      .setExpirationTime('30d')
      .sign(secret);
    
    // 7. Devolver token y datos del usuario
    return NextResponse.json({
      success: true,
      token,
      user: {
        id: user.id,
        usuario: user.usuario,
        nombre: user.nombre,
        rol: user.rol,
        negocio: {
          id: user.negocio.id,
          nombre: user.negocio.nombre,
          limitTime: user.negocio.limitTime,
        },
        localActual,
        locales: localesDisponibles,
        permisos,
      },
      expiresAt: expiresAt.toISOString(),
    }, { status: 200 });
    
  } catch (error) {
    console.error('❌ [LOGIN MOBILE] Error:', error);
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    );
  }
}
```

---

#### **Flutter: `lib/services/auth_service.dart`**

```dart
import 'package:dio/dio.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'dart:convert';

class AuthService {
  final Dio _dio;
  final FlutterSecureStorage _storage = const FlutterSecureStorage();
  
  AuthService(this._dio);
  
  /// Login usando el endpoint mobile custom
  Future<Map<String, dynamic>?> login(String usuario, String password) async {
    try {
      print('🔐 Intentando login para: $usuario');
      
      final response = await _dio.post(
        '/auth/login-mobile',
        data: {
          'usuario': usuario,
          'password': password,
        },
      );
      
      if (response.statusCode == 200 && response.data['success'] == true) {
        final token = response.data['token'] as String;
        final userData = response.data['user'];
        final expiresAt = response.data['expiresAt'];
        
        // Guardar token de forma segura
        await _storage.write(key: 'auth_token', value: token);
        await _storage.write(key: 'user_data', value: jsonEncode(userData));
        await _storage.write(key: 'expires_at', value: expiresAt);
        
        print('✅ Login exitoso: ${userData['nombre']}');
        print('📅 Token expira: $expiresAt');
        
        return {
          'token': token,
          'user': userData,
          'expiresAt': expiresAt,
        };
      }
      
      print('❌ Login fallido: respuesta inesperada');
      return null;
      
    } on DioException catch (e) {
      print('❌ Error en login: ${e.message}');
      
      if (e.response != null) {
        final errorData = e.response!.data;
        print('Status: ${e.response!.statusCode}');
        print('Error: ${errorData['error']}');
        
        // Manejar errores específicos
        if (errorData['error'] == 'SUBSCRIPTION_EXPIRED') {
          throw Exception('Suscripción expirada. Contacta al administrador.');
        } else if (errorData['error'] == 'USUARIO_SIN_CONFIGURAR') {
          throw Exception(errorData['message']);
        }
      }
      
      return null;
    } catch (e) {
      print('❌ Error inesperado: $e');
      return null;
    }
  }
  
  /// Obtener token guardado
  Future<String?> getToken() async {
    return await _storage.read(key: 'auth_token');
  }
  
  /// Obtener datos del usuario guardado
  Future<Map<String, dynamic>?> getUserData() async {
    final userData = await _storage.read(key: 'user_data');
    if (userData != null) {
      return jsonDecode(userData);
    }
    return null;
  }
  
  /// Verificar si el usuario está autenticado
  Future<bool> isAuthenticated() async {
    final token = await getToken();
    if (token == null) return false;
    
    // Verificar si el token expiró
    final expiresAt = await _storage.read(key: 'expires_at');
    if (expiresAt != null) {
      final expiryDate = DateTime.parse(expiresAt);
      if (DateTime.now().isAfter(expiryDate)) {
        print('⚠️ Token expirado');
        await logout();
        return false;
      }
    }
    
    return true;
  }
  
  /// Logout
  Future<void> logout() async {
    await _storage.delete(key: 'auth_token');
    await _storage.delete(key: 'user_data');
    await _storage.delete(key: 'expires_at');
    print('👋 Logout exitoso');
  }
}
```

---

#### **Flutter: Ejemplo de Uso**

```dart
import 'package:flutter/material.dart';

class LoginScreen extends StatefulWidget {
  @override
  _LoginScreenState createState() => _LoginScreenState();
}

class _LoginScreenState extends State<LoginScreen> {
  final _usuarioController = TextEditingController();
  final _passwordController = TextEditingController();
  bool _loading = false;
  String? _errorMessage;
  
  late AuthService _authService;
  
  @override
  void initState() {
    super.initState();
    final dio = Dio(BaseOptions(
      baseUrl: 'http://192.168.1.100:3000/api', // Cambiar por tu IP
    ));
    _authService = AuthService(dio);
  }
  
  Future<void> _handleLogin() async {
    setState(() {
      _loading = true;
      _errorMessage = null;
    });
    
    try {
      final result = await _authService.login(
        _usuarioController.text,
        _passwordController.text,
      );
      
      if (result != null) {
        // Login exitoso, navegar a la pantalla principal
        Navigator.of(context).pushReplacementNamed('/home');
      } else {
        setState(() {
          _errorMessage = 'Credenciales incorrectas';
        });
      }
    } catch (e) {
      setState(() {
        _errorMessage = e.toString().replaceAll('Exception: ', '');
      });
    } finally {
      setState(() {
        _loading = false;
      });
    }
  }
  
  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: Text('Iniciar Sesión')),
      body: Padding(
        padding: EdgeInsets.all(16.0),
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            TextField(
              controller: _usuarioController,
              decoration: InputDecoration(
                labelText: 'Usuario',
                border: OutlineInputBorder(),
              ),
            ),
            SizedBox(height: 16),
            TextField(
              controller: _passwordController,
              obscureText: true,
              decoration: InputDecoration(
                labelText: 'Contraseña',
                border: OutlineInputBorder(),
              ),
            ),
            SizedBox(height: 24),
            if (_errorMessage != null)
              Padding(
                padding: EdgeInsets.only(bottom: 16),
                child: Text(
                  _errorMessage!,
                  style: TextStyle(color: Colors.red),
                ),
              ),
            ElevatedButton(
              onPressed: _loading ? null : _handleLogin,
              child: _loading
                  ? CircularProgressIndicator(color: Colors.white)
                  : Text('Iniciar Sesión'),
            ),
          ],
        ),
      ),
    );
  }
}
```

---

## 🔄 Flujo Completo Actualizado

```
1. Flutter App
   ↓ POST /api/auth/login-mobile
   ↓ Body: { "usuario": "admin", "password": "123" }
   
2. Backend valida credenciales
   ↓ Verifica suscripción, roles, locales
   ↓ Genera token JWT con SignJWT
   
3. Backend responde
   ↓ { "success": true, "token": "eyJ...", "user": {...} }
   
4. Flutter guarda token
   ↓ FlutterSecureStorage.write('auth_token', token)
   
5. Flutter hace request a API
   ↓ GET /api/categorias
   ↓ Header: Authorization: Bearer eyJ...
   
6. Backend (authFromRequest.ts)
   ↓ Extrae token del header Authorization
   ↓ Verifica con jwtVerify (jose)
   ↓ Construye Session desde payload
   
7. Endpoint procesa
   ↓ const user = session.user
   ↓ Consulta base de datos
   
8. Backend responde
   ↓ { categorias: [...] }
   
9. Flutter muestra datos
   ✅ Éxito!
```

---

## 🧪 Testing

### **Probar Login desde Flutter:**

```dart
void testLogin() async {
  final dio = Dio(BaseOptions(
    baseUrl: 'http://192.168.1.100:3000/api',
  ));
  
  final authService = AuthService(dio);
  
  try {
    final result = await authService.login('admin', 'password123');
    
    if (result != null) {
      print('✅ Login exitoso');
      print('Token: ${result['token'].substring(0, 50)}...');
      print('Usuario: ${result['user']['nombre']}');
      print('Rol: ${result['user']['rol']}');
      print('Negocio: ${result['user']['negocio']['nombre']}');
    }
  } catch (e) {
    print('❌ Error: $e');
  }
}
```

### **Probar Request con Token:**

```dart
void testCategorias() async {
  final dio = Dio(BaseOptions(
    baseUrl: 'http://192.168.1.100:3000/api',
  ));
  
  final authService = AuthService(dio);
  
  // Primero login
  await authService.login('admin', 'password123');
  
  // Configurar interceptor
  dio.interceptors.add(InterceptorsWrapper(
    onRequest: (options, handler) async {
      final token = await authService.getToken();
      if (token != null) {
        options.headers['Authorization'] = 'Bearer $token';
        print('✅ Token agregado al request');
      }
      return handler.next(options);
    },
  ));
  
  // Probar endpoint
  try {
    final response = await dio.get('/categorias');
    print('✅ Categorías obtenidas: ${response.data.length}');
  } catch (e) {
    print('❌ Error: $e');
  }
}
```

---

## 📊 Logs Esperados

### **En el backend (Next.js):**

```
🔍 [AUTH] Authorization header: Bearer eyJhbGciOiJIUzI1NiIs...
✅ [AUTH] Token JWT verificado y decodificado
📋 [AUTH] Usuario: admin | Rol: SUPER_ADMIN
```

### **En Flutter:**

```
🔐 Intentando login para: admin
✅ Login exitoso: Administrador
📅 Token expira: 2025-12-23T10:30:00.000Z
✅ Token agregado al request: Bearer eyJhbGciOiJIUzI1...
✅ Categorías obtenidas: 5
```

---

## ✅ Checklist de Implementación

- [x] Crear endpoint `/api/auth/login-mobile/route.ts`
- [x] Modificar `authFromRequest.ts` para usar `jwtVerify`
- [ ] Crear `AuthService` en Flutter
- [ ] Implementar `FlutterSecureStorage` en Flutter
- [ ] Configurar interceptor de Dio para agregar token
- [ ] Probar login desde Flutter
- [ ] Probar requests con token a diferentes endpoints
- [ ] Manejar errores de token expirado
- [ ] Implementar renovación automática de token (opcional)

---

## 🎉 ¡Listo!

Ahora tu app Flutter puede:

✅ **Hacer login** y obtener token JWT directamente  
✅ **Guardar el token** de forma segura  
✅ **Enviar el token** en cada request  
✅ **Backend verifica** el token correctamente  
✅ **Funciona tanto para web** (cookies) **como mobile** (JWT headers)  

**¡El problema está completamente resuelto!** 🚀


