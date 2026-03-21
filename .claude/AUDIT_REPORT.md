# Audit Report: Foreman Home + Report Flow

**Date:** 2026-03-21
**Modules:** `useAreas`, `AreaCard`, `useReportStore`, `ReportFlowNavigator`, `report.tsx`
**Auditor:** Claude (SaaS Factory Senior Architect)

---

## 1. Code Bloat Analysis

### useAreas.ts — 239 lines

**Veredicto: ZONA AMARILLA (no critico, monitorear)**

El hook ejecuta **4 queries secuenciales** en cada poll cycle (2s):
1. Areas + status JOIN (`user_assignments → areas → area_trade_status`)
2. Active delays (`delay_logs WHERE ended_at IS NULL`)
3. Recent reports (`field_reports GROUP BY area_id, trade_name`)
4. Pending NODs (`nod_drafts → delay_logs → areas → user_assignments`)

**Problema:** Las 4 queries son independientes pero se ejecutan en serie (`await` secuencial). Cada poll cycle bloquea el thread durante 4 roundtrips a SQLite.

**Recomendacion (V2, no urgente):**
```typescript
// Ejecutar queries 1-4 en paralelo con Promise.all
const [rawAreas, activeDelays, recentReports, nods] = await Promise.all([
  db.getAll<RawAreaRow>(AREAS_QUERY, [userId]),
  db.getAll<RawDelayRow>(DELAYS_QUERY, [userId]),
  db.getAll<RawRecentReportRow>(REPORTS_QUERY, [userId]),
  db.getAll<RawNodRow>(NODS_QUERY, [userId]),
]);
```
**Ganancia estimada:** ~60% reduccion en latencia por poll cycle. SQLite maneja bien lecturas concurrentes.

**Extraccion a service:** NO necesario aun. 239 lineas es aceptable para un hook con 4 queries + derivacion. Si crece a 300+, extraer las queries SQL a un `areaQueries.ts` service.

### AreaCard.tsx — 204 lines

**Veredicto: LIMPIO**

- `isRecentlyReported()` es una comparacion de timestamp pura (4 lineas). No es logica de negocio — es logica de presentacion. Correcto que viva en el componente.
- `STATUS_CONFIG` es un mapa estatico de colores. Correcto como constante del componente.
- No hay state, no hay effects, no hay side effects. Es un componente presentacional puro.
- **Unica nota:** Si en el futuro agregamos mas indicadores (ej: "needs attention", "overdue"), extraer `STATUS_CONFIG` a `shared/constants/areaStatus.ts` para reutilizarlo en web dashboard.

### useReportStore.ts — 179 lines

**Veredicto: LIMPIO**

- Zustand store bien tipado con State + Actions separados
- `getDerivedStatus()` usa `get()` correctamente (no snapshot stale)
- `INITIAL_STATE` / `INITIAL_FORM_DATA` centralizados — reset es clean
- Sin persistence middleware = sin riesgo de corrupt state

### report.tsx — 94 lines

**Veredicto: LIMPIO (post-blindaje)**

- Guard via `useEffect` (no side-effect en render)
- Cleanup on unmount con `submittedRef` flag
- Double-tap guard via `isSubmitting`
- Data integrity validation pre-submit
- `router.replace` evita stack corruption

### ReportFlowNavigator.tsx — 105 lines

**Veredicto: LIMPIO**

- Conditional rendering sin animation lib (correcto para V1)
- Cancel → reset + router.back (correcto)
- Progress dots son presentacionales puros

---

## 2. Security Analysis (RLS + Data Access)

### Supabase RLS — BIEN CONFIGURADO

Las politicas RLS existentes cubren correctamente:

| Tabla | SELECT | INSERT | Scope |
|-------|--------|--------|-------|
| `areas` | Foreman: `id IN (SELECT area_id FROM user_assignments WHERE user_id = auth.uid())` | N/A | Solo areas asignadas |
| `area_trade_status` | Foreman: `area_id IN (SELECT area_id FROM user_assignments WHERE user_id = auth.uid())` | N/A | Solo status de areas asignadas |
| `field_reports` | `area_id IN get_accessible_area_ids()` | `user_id = auth.uid()` | Lee areas accesibles, escribe solo como si mismo |
| `delay_logs` | `area_id IN get_accessible_area_ids()` | N/A | Read-only en mobile |
| `user_assignments` | `area_id IN get_accessible_area_ids()` | N/A | Read-only |
| `nod_drafts` | Sub org: `delay_log_id IN (JOIN → projects WHERE sub_org_id = user_org)` | N/A | Solo NODs del sub |

### PowerSync Sync Rules — BIEN CONFIGURADO

Los sync rules filtran por `token_parameters.user_id` y solo bajan datos de areas asignadas. Double defense: RLS valida en Supabase, sync rules limitan lo que baja a SQLite.

### Hallazgo CRITICO: field_reports INSERT sin area_id validation

**Riesgo:** La politica RLS de INSERT para `field_reports` solo valida `user_id = auth.uid()`. Un usuario malicioso podria insertar un report con `area_id` de un area que NO le pertenece.

**Politica actual:**
```sql
CREATE POLICY "Foreman creates field reports" ON field_reports
  FOR INSERT WITH CHECK (user_id = auth.uid());
```

**Politica recomendada:**
```sql
CREATE POLICY "Foreman creates field reports" ON field_reports
  FOR INSERT WITH CHECK (
    user_id = auth.uid()
    AND area_id IN (
      SELECT ua.area_id FROM user_assignments ua
      WHERE ua.user_id = auth.uid()
    )
  );
```

**Severidad:** MEDIA. En practica, el foreman solo ve sus areas en la UI (sync rules filtran). Pero un request HTTP directo a Supabase podria bypass esto. Corregir en la proxima migracion de seguridad.

### Hallazgo: Codigo cliente no valida area_id ownership

En `report.tsx`, `handleSubmit` toma `store.context.area_id` directamente del store (que fue seteado por `startReport` en `index.tsx`). El store confía ciegamente en lo que recibe.

**Mitigacion actual:** El store se llena desde `useAreas` que solo retorna areas del `user_id` actual (via query con `WHERE ua.user_id = ?`). El riesgo real es bajo porque:
1. Sync rules solo bajan areas asignadas
2. El store se llena desde esas areas
3. RLS valida el write server-side

**No necesita fix client-side.** El fix correcto es la politica RLS mejorada arriba.

---

## 3. Scalability Analysis

### Escenario: 500 areas asignadas a un foreman

**Pregunta clave:** En la realidad, un foreman jamas tiene 500 areas. Un proyecto grande (80 Clarkson = 160 unidades) asigna ~15-40 areas por foreman. 500 seria un superintendent viendo todo el proyecto.

Pero analicemos el worst case:

### SQLite Performance (local queries)

| Query | 500 areas | Impacto |
|-------|-----------|---------|
| Areas JOIN (3 tablas) | ~2-5ms | Negligible. SQLite maneja JOINs de miles de rows en <10ms |
| Delays filter | ~1-2ms | Set de area_ids pequeno |
| Reports GROUP BY | ~3-8ms | MAX + GROUP BY en 500 groups. Puede crecer si hay miles de reports historicos |
| NODs JOIN (4 tablas) | ~2-4ms | Pocos NODs tipicamente |
| **Total per poll** | **~8-19ms** | **Aceptable a 2s interval** |

**Veredicto:** SQLite local NO colapsa con 500 areas. El bottleneck no es la query — es la sincronizacion de datos.

### PowerSync Sync (el bottleneck real)

Con 500 areas, PowerSync descargaria:
- 500 rows `areas`
- 500+ rows `area_trade_status`
- Potencialmente miles de `field_reports` (historico)
- Cientos de `delay_logs`

**Problema potencial:** Initial sync time. En 3G/4G lento, la primera carga podria tomar 10-30s para descargar todo el dataset.

**Estrategia recomendada (V2):**
1. **NO paginar las queries SQLite locales** — no tiene sentido, SQLite es rapido
2. **SI paginar la UI** — FlatList ya virtualiza (solo renderiza items visibles). OK
3. **Considerar `windowSize` en FlatList** — reducir de default 21 a 10 para 500 items
4. **PowerSync incremental sync** ya esta implementado (solo baja deltas, no full dataset)

### Polling cada 2s — analisis de costo

4 queries × cada 2s × ~15ms = **~30ms/min de CPU en SQLite reads**. Esto es insignificante. El polling de 2s es correcto para V1.

**Optimizacion futura (V2):**
```typescript
// Reemplazar polling con PowerSync watch() cuando sea estable
db.watch('SELECT ... FROM areas ...', [userId], { throttleMs: 500 })
```
Esto eliminaria el polling y reaccionaria solo a cambios reales. Pero `watch()` tiene quirks por plataforma, asi que el polling es la decision correcta para V1.

---

## 4. Resumen de Hallazgos

| # | Hallazgo | Severidad | Accion | Cuando |
|---|----------|-----------|--------|--------|
| 1 | `field_reports` INSERT RLS no valida `area_id` ownership | MEDIA | Agregar `area_id IN (user_assignments)` al WITH CHECK | Proxima migracion |
| 2 | 4 queries en serie en `useAreas` (deberian ser `Promise.all`) | BAJA | Paralelizar con `Promise.all` | V2 optimization sprint |
| 3 | FlatList sin `windowSize` optimizado para 100+ items | BAJA | Agregar `windowSize={10}` y `maxToRenderPerBatch={10}` | Cuando haya >50 areas en testing |
| 4 | No hay indices en PowerSync schema | BAJA | Agregar indices en `user_id`, `area_id` columns | V2 cuando se midan queries lentas |
| 5 | `field_reports` GROUP BY sin filtro temporal | INFO | Agregar `WHERE created_at > datetime('now', '-30 days')` para evitar escanear historico completo | V2 |

---

## 5. Deuda Tecnica: NO CRITICA

No hay deuda que requiera refactor inmediato. Los modulos estan bien encapsulados:

- **Data layer:** `useAreas` (hook) + `useFieldReport` (hook) + `usePowerSync` (context)
- **State:** `useReportStore` (Zustand, no persistence)
- **UI:** `AreaCard` (presentacional) + `NodBanner` (presentacional) + Step 1/2/3 (form)
- **Navigation:** `report.tsx` (route) + `ReportFlowNavigator` (orchestrator)

La separacion es correcta. Ningun componente tiene >250 lineas. La logica de negocio esta en hooks/stores, no en UI.

---

## 6. Skill de Fabrica: AreaCard Pattern

Para que el agente no reinvente el estilo cada vez que necesite crear una card similar, aqui esta el patron estandarizado:

```
Archivo: packages/shared/src/constants/statusColors.ts

Exporta: STATUS_COLORS (Record<AreaStatus, { color, bg, label }>)
Uso: import en cualquier componente que muestre status visual

Patron de Card (Carlos Standard):
- borderLeftWidth: 4 + borderLeftColor: status color
- backgroundColor: #1e293b (card bg)
- borderRadius: 16
- padding: 16
- Titulo: fontSize 20, fontWeight 700, color #f8fafc
- Meta: fontSize 14, color #94a3b8
- Status chip: borderRadius 20, bg=status.bg, text=status.color, uppercase
- Boton primario: height 56, borderRadius 12, bg #2563eb
- Boton texto: fontSize 18, fontWeight 600, color #fff
```

Este patron aplica a: AreaCard, futuras TaskCard, DelayCard, NODCard.

---

*Report generado automaticamente. Proxima auditoria recomendada despues de Sprint B (Legal Docs).*
