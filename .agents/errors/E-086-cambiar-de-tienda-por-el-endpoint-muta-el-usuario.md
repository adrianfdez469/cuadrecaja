# E-086: Cambiar de tienda por el endpoint muta al usuario, y el JWT no lo refleja hasta el próximo login

**Área:** auth
**Apariciones:** 1 — F-049 (QA)

## Síntoma

Verificando una pantalla contra **tres períodos distintos** en una sola sesión, se usó
`POST /api/auth/cambiar-tienda` para saltar de una tienda a otra. Después de volver a entrar, la
aplicación cargó **la tienda equivocada**, y las mediciones siguientes describían un período que no
era el que se creía estar mirando.

No hay error, ni aviso: la pantalla se ve perfectamente, con los datos de otro período.

## Causa raíz

Dos hechos que solo juntos producen el fallo:

1. Ese endpoint **escribe en la base**: cambia el `localActualId` del usuario. No es un cambio de
   vista, es una **mutación persistente del usuario** — el siguiente login lo hereda.
2. **El local actual viaja en el JWT de la sesión**, y la base solo se relee **al iniciar sesión**,
   no en cada petición. Es [[E-021]] visto desde el otro lado: allí se cambiaba la base y la sesión
   seguía vieja; aquí se cambia la base **a propósito** y el efecto sobrevive a la sesión.

Resultado: una herramienta que parecía «cambiar de pestaña» dejó al usuario de prueba apuntando de
forma permanente a otra tienda.

## Solución

Sembrar **un usuario por tienda** y autenticarse con el que corresponda, en vez de mover un único
usuario de una tienda a otra.

## Cómo evitarlo

- **Ningún endpoint cuyo nombre empiece por `cambiar-` es un cambio de vista.** Antes de usar uno
  para preparar un escenario, mira qué escribe: si toca una columna del usuario, el escenario
  siguiente arranca contaminado.
- Al verificar **varios períodos o varias tiendas en una misma sesión**, el aislamiento se consigue
  con **credenciales distintas**, no con un conmutador de la propia aplicación.
- Señal de alarma barata: si un dato de sesión se lee de la base **solo en el login**, cualquier
  escritura sobre él es invisible hasta el siguiente, y cualquier lectura posterior puede estar
  midiendo un estado que ya no existe.
