# Blueprint: Foreman Home Screen

## Objetivo

Pantalla principal para el capataz. Lista de areas asignadas con estado en tiempo real.

## Componentes UI

1. **NOD Banner:** Componente critico. Si existen blockers (NOD), banner rojo superior, sticky.
2. **AreaCard:**
   - Titulo (Nombre area)
   - Status (Chip con color: verde=OK, rojo=NOD)
   - Boton "Report Update": 56px height, central, haptic feedback al presionar.
3. **Layout:** ScrollView vertical, padding consistente, grouping por status.

## Logica de Datos

- Suscripcion a PowerSync: `SELECT * FROM areas WHERE foreman_id = ?`.
- Reactividad: La UI debe actualizarse instantaneamente al cambiar el estado en la DB.
- Offline: Si `PowerSync.connected` es false, mostrar indicador sutil en el header.
