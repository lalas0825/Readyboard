# PRP: Ready Board Grid + GC Dashboard (Week 3, Modules 1-2)

**Date:** 2026-03-21
**Prerequisite:** Approve migrations in `dashboard_data_flow.md` first
**Scope:** Web only (`apps/web/`). Zero changes to mobile.

---

## Fase 0: Migraciones de Infraestructura (DB)

Antes de escribir una línea de UI, aplicar estas 3 migraciones:

### Migration 1: `propagate_report_to_ats`
```sql
-- Trigger: field_reports INSERT → area_trade_status UPDATE
CREATE OR REPLACE FUNCTION propagate_report_to_ats()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE area_trade_status
  SET manual_pct = NEW.progress_pct,
      updated_at = NOW()
  WHERE area_id = NEW.area_id
    AND trade_type = NEW.trade_name;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE TRIGGER trg_propagate_report
  AFTER INSERT ON field_reports
  FOR EACH ROW
  EXECUTE FUNCTION propagate_report_to_ats();
```

### Migration 2: `enable_realtime`
```sql
ALTER PUBLICATION supabase_realtime ADD TABLE area_trade_status;
ALTER PUBLICATION supabase_realtime ADD TABLE delay_logs;
ALTER PUBLICATION supabase_realtime ADD TABLE corrective_actions;
```

### Migration 3: `seed_full_grid_data`
- INSERT 390 `area_trade_status` rows (13 remaining trades × 30 areas)
- Realistic "wave" pattern: lower floors more complete, upper floors behind
- Creates visual demo data for the grid

---

## Fase 1: Ready Board Grid (Componente Independiente)

### Arquitectura

```
src/features/ready-board/
├── components/
│   ├── ReadyBoardGrid.tsx      # Componente principal (tabla floors × trades)
│   ├── GridCell.tsx             # Celda individual (color + tooltip)
│   ├── GridLegend.tsx           # Leyenda de colores (READY/ALMOST/BLOCKED/HELD/DONE)
│   └── GridDetailPanel.tsx      # Panel lateral: detalle al hacer click en celda
├── hooks/
│   ├── useReadyBoardData.ts     # Query inicial + Realtime subscription
│   └── useGridStatus.ts         # Lógica de derivación de status (client-side)
├── lib/
│   └── deriveStatus.ts          # Función pura: effective_pct + priors → status
└── types.ts                     # GridCell, GridRow, GridStatus types
```

### `ReadyBoardGrid.tsx`
- **Input:** `projectId: string`
- **Layout:** Tabla HTML con:
  - Columnas = 14 trades (ordenados por `sequence_order`)
  - Filas = Agrupadas por floor, sub-filas por area name
  - Header sticky con nombres de trades (abreviados, tooltip con nombre completo)
- **Interacción:** Click en celda → `GridDetailPanel` slides in desde la derecha
- **Responsive:** Scroll horizontal para trades que no caben. Floor column fija.

### `GridCell.tsx`
- Renderiza: color de fondo (hex de BUSINESS_LOGIC.md) + label (RDY/ALM/BLK/HLD/DONE)
- Tooltip on hover: trade name, effective_pct, last report time
- Size: min 60px × 40px para densidad visual
- Animación: transición suave al cambiar color (Realtime update)

### `useReadyBoardData.ts`
1. Query inicial: la query de `dashboard_data_flow.md` (single query, no N+1)
2. Supabase Realtime subscription on `area_trade_status`
3. On change: actualiza solo la celda afectada en el state
4. Returns: `{ grid, isLoading, error }`

### `deriveStatus.ts`
- Función pura (testeable sin React)
- Implementa la lógica de BUSINESS_LOGIC.md §Ready Board Status Logic
- Input: currentTrade + priorTrades + activeDelays → output: GridStatus

### `GridDetailPanel.tsx`
- Slide-in panel (derecha, 400px width)
- Contenido: area info, trade, effective_pct, hours blocked, cumulative cost, GPS map placeholder, photo thumbnails
- Source: delay_logs + field_reports para la celda seleccionada
- Close button + click-outside-to-close

---

## Fase 2: GC Dashboard (Contenedor)

### Arquitectura

```
src/features/dashboard/
├── components/
│   ├── DashboardLayout.tsx      # Layout: 3 secciones + sidebars
│   ├── MetricCards.tsx           # Section 1: 4 cards de métricas
│   ├── AlertList.tsx            # Section 2: Top 5 alerts por costo
│   ├── AlertItem.tsx            # Alert individual expandible
│   ├── ProjectionBar.tsx        # Section 3: P6 vs projected + delta
│   ├── CostCounter.tsx          # Right sidebar: costo de inacción animado
│   └── FloorStrip.tsx           # Left sidebar: status por floor
├── hooks/
│   ├── useDashboardMetrics.ts   # Aggregate counts from grid data
│   └── useAlerts.ts             # Active delays ranked by daily_cost
└── types.ts                     # DashboardMetrics, Alert types
```

### Relación Grid ↔ Dashboard

```
DashboardPage (route: /dashboard)
├── DashboardLayout
│   ├── FloorStrip (left sidebar)
│   │   └── Consumes: grid data grouped by floor
│   ├── Main Content
│   │   ├── MetricCards
│   │   │   └── Consumes: grid data aggregated (count by status)
│   │   ├── ReadyBoardGrid ← COMPONENTE INDEPENDIENTE
│   │   │   └── Consumes: projectId prop
│   │   └── AlertList
│   │       └── Consumes: delay_logs + corrective_actions
│   └── CostCounter (right sidebar)
│       └── Consumes: SUM(daily_cost) from active delays
└── ProjectionBar (bottom)
    └── Consumes: forecast_snapshots (Week 5 — placeholder for now)
```

**Principio clave:** El grid es un componente independiente que se monta con `projectId`. El dashboard es un contenedor que consume los mismos datos que el grid más datos adicionales (delay_logs, corrective_actions).

### `MetricCards.tsx` — Section 1
4 cards:
| Card | Source | Color |
|------|--------|-------|
| Project % | AVG(effective_pct) across all trades | neutral |
| On Track | COUNT(status = ready OR done) | green |
| Needs Attention | COUNT(status = almost) | yellow |
| Action Required | COUNT(status = blocked OR held) | red |

### `AlertList.tsx` — Section 2
- Source: `delay_logs WHERE ended_at IS NULL` JOIN `areas` + `area_trade_status`
- Ordered by: `daily_cost DESC` (most expensive inaction first)
- Max 5 items visible, "View All" link
- Each alert expandable: context, GC action note input, "Confirm Action" button (creates corrective_action)

### `ProjectionBar.tsx` — Section 3
- **Week 3:** Placeholder with P6 date + "Projection available after schedule import"
- **Week 5:** Real data from `forecast_snapshots`

### Dark Theme
- Per CLAUDE.md: "Dark theme. Indoor office use."
- `bg-zinc-950` body, `zinc-900` cards, `zinc-800` borders
- Status colors from BUSINESS_LOGIC.md stand out on dark backgrounds

---

## Rutas (App Router)

```
apps/web/src/app/
├── (main)/
│   ├── dashboard/
│   │   └── page.tsx             # GC Dashboard (imports DashboardLayout + Grid)
│   └── layout.tsx               # Sidebar nav + header with logo
└── (auth)/
    └── ...                      # Login (future)
```

- `/dashboard` es la ruta principal del GC
- Auth gating pendiente (Week 3 no incluye login — se accede directo para desarrollo)
- `(main)/layout.tsx` tendrá nav sidebar con logo animado

---

## Dependencias UI

shadcn/ui components necesarios (instalar antes de Fase 1):
- `card` — MetricCards
- `table` — ReadyBoardGrid
- `badge` — Status labels
- `tooltip` — GridCell hover info
- `sheet` — GridDetailPanel (slide-in)
- `separator` — Section dividers

---

## Datos de Demo

Para que el dashboard sea visualmente útil desde Day 1:
- La Migration 3 crea un patrón de "ola" en los datos:
  - Floor 20: trades 1-6 DONE, trade 7 (Tile) at 45%
  - Floor 21: trades 1-4 DONE, trade 5 at 70%
  - Floor 22: trades 1-3 DONE, trade 4 at 30%
  - Floor 23: trades 1-2 DONE, trade 3 at 15%
  - Floor 24: trade 1 at 60%
- 2-3 delay_logs activos para que AlertList tenga datos
- Esto simula un proyecto real donde los pisos más bajos están más avanzados

---

## Qué NO hacer en este PRP

- NO construir auth/login para web (Week 3 acceso directo)
- NO implementar corrective actions CRUD completo (solo vista en AlertList)
- NO implementar push notifications (módulo separado)
- NO construir forecast real (placeholder hasta Week 5)
- NO tocar código mobile (`apps/mobile/`)

---

## Orden de Ejecución

1. Aprobar y aplicar 3 migraciones (Fase 0)
2. Instalar shadcn/ui components
3. Crear `src/features/ready-board/` (Grid independiente)
4. Crear `src/features/dashboard/` (contenedor)
5. Crear ruta `/dashboard` + layout con nav
6. Verificar en browser: grid con datos seed + Realtime

---

*El grid es el corazón. Todo lo demás lo consume.*
