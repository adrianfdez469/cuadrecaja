# Informes archivados

Informes de un solo uso —qa, tests, implementación— de features ya cerrados. **Nadie los relee**:
se conservan por trazabilidad, porque alguno se cita desde un ADR o desde el spec de su feature.

No los leas para trabajar un feature nuevo. Lo que había que aprender de ellos está en
`.agents/errors/` (la ficha del error) o en `docs/adr/` (la decisión). Si un informe contiene algo
que sigue siendo vigente y no está en ninguno de esos dos sitios, entonces el sitio donde falta es
el bug, no este directorio.

Los informes de **seguridad** no viven aquí: su destino es `.agents/security/F-###.md`, que es una
ruta viva y el único destino del `security-guardian`.
