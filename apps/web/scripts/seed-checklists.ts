/**
 * seed-checklists.ts — Week 8 Bloque 2
 *
 * Seeds 170+ trade task templates for the 14-trade interior finish sequence
 * across 4 area types (bathroom, kitchen, corridor, office).
 *
 * Usage:
 *   npx tsx apps/web/scripts/seed-checklists.ts
 *
 * Flags:
 *   --force   Delete existing system templates before re-seeding
 *   --dry-run Validate weights only, do not insert
 */

import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';
import { resolve } from 'path';

// ─── Load env from apps/web/.env.local ───────────────────────
const envPath = resolve(__dirname, '../.env.local');
try {
  const envFile = readFileSync(envPath, 'utf-8');
  for (const line of envFile.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eqIdx = trimmed.indexOf('=');
    if (eqIdx === -1) continue;
    const key = trimmed.slice(0, eqIdx).trim();
    const val = trimmed.slice(eqIdx + 1).trim();
    if (!process.env[key]) process.env[key] = val;
  }
} catch {
  console.warn('Could not load .env.local — using existing env vars');
}

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

// ─── Types ───────────────────────────────────────────────────
type TaskTemplate = {
  org_id: null;
  trade_type: string;
  area_type: string;
  task_order: number;
  task_name_en: string;
  task_name_es: string;
  task_owner: 'sub' | 'gc';
  is_gate: boolean;
  is_inspection: boolean;
  weight: number;
  requires_photo: boolean;
  verification_criteria: string | null;
};

// ─── Helper ──────────────────────────────────────────────────
function t(
  trade_type: string,
  area_type: string,
  task_order: number,
  task_name_en: string,
  task_name_es: string,
  task_owner: 'sub' | 'gc',
  weight: number,
  opts: {
    is_gate?: boolean;
    is_inspection?: boolean;
    requires_photo?: boolean;
    verification_criteria?: string;
  } = {},
): TaskTemplate {
  return {
    org_id: null,
    trade_type,
    area_type,
    task_order,
    task_name_en,
    task_name_es,
    task_owner,
    is_gate: opts.is_gate ?? false,
    is_inspection: opts.is_inspection ?? false,
    weight,
    requires_photo: opts.requires_photo ?? false,
    verification_criteria: opts.verification_criteria ?? null,
  };
}

// ═══════════════════════════════════════════════════════════════
// TASK CATALOG — 14 trades × 4 area types (211 tasks)
// NYC Commercial High-Rise Interior Finish Sequence
// ═══════════════════════════════════════════════════════════════

const TASKS: TaskTemplate[] = [
  // ─── Trade 1: Rough Plumbing ─────────────────────────────────
  // Bathroom (6 tasks)
  t('Rough Plumbing', 'bathroom', 1, 'Layout & mark waste/supply lines', 'Trazar y marcar líneas de drenaje/suministro', 'sub', 15),
  t('Rough Plumbing', 'bathroom', 2, 'Install waste piping & vents', 'Instalar tubería de drenaje y ventilación', 'sub', 25),
  t('Rough Plumbing', 'bathroom', 3, 'Install supply lines (hot/cold)', 'Instalar líneas de suministro (caliente/fría)', 'sub', 20),
  t('Rough Plumbing', 'bathroom', 4, 'Install tub/shower rough valves', 'Instalar válvulas de tina/ducha', 'sub', 15),
  t('Rough Plumbing', 'bathroom', 5, 'Pressure test', 'Prueba de presión', 'sub', 10, { requires_photo: true, verification_criteria: 'Hold 50 PSI for 30 min with no drop' }),
  t('Rough Plumbing', 'bathroom', 6, 'GC Inspection — Rough plumbing', 'Inspección GC — Plomería bruta', 'gc', 15, { is_gate: true, is_inspection: true, verification_criteria: 'All connections secure, pressure test passed, no leaks' }),

  // Kitchen (5 tasks)
  t('Rough Plumbing', 'kitchen', 1, 'Layout & mark waste/supply lines', 'Trazar y marcar líneas de drenaje/suministro', 'sub', 20),
  t('Rough Plumbing', 'kitchen', 2, 'Install waste piping & vents', 'Instalar tubería de drenaje y ventilación', 'sub', 25),
  t('Rough Plumbing', 'kitchen', 3, 'Install supply lines', 'Instalar líneas de suministro', 'sub', 25),
  t('Rough Plumbing', 'kitchen', 4, 'Pressure test', 'Prueba de presión', 'sub', 10, { requires_photo: true }),
  t('Rough Plumbing', 'kitchen', 5, 'GC Inspection — Rough plumbing', 'Inspección GC — Plomería bruta', 'gc', 20, { is_gate: true, is_inspection: true }),

  // Office (4 tasks)
  t('Rough Plumbing', 'office', 1, 'Layout & mark waste/supply lines', 'Trazar y marcar líneas de drenaje/suministro', 'sub', 25),
  t('Rough Plumbing', 'office', 2, 'Install waste piping', 'Instalar tubería de drenaje', 'sub', 30),
  t('Rough Plumbing', 'office', 3, 'Install supply lines', 'Instalar líneas de suministro', 'sub', 25),
  t('Rough Plumbing', 'office', 4, 'GC Inspection — Rough plumbing', 'Inspección GC — Plomería bruta', 'gc', 20, { is_gate: true, is_inspection: true }),

  // ─── Trade 2: Metal Stud Framing ─────────────────────────────
  // Bathroom (5 tasks)
  t('Metal Stud Framing', 'bathroom', 1, 'Layout & snap lines', 'Trazar y marcar líneas', 'sub', 15),
  t('Metal Stud Framing', 'bathroom', 2, 'Install floor/ceiling tracks', 'Instalar rieles de piso/techo', 'sub', 20),
  t('Metal Stud Framing', 'bathroom', 3, 'Install studs & blocking', 'Instalar montantes y bloqueo', 'sub', 25),
  t('Metal Stud Framing', 'bathroom', 4, 'Install door frames', 'Instalar marcos de puertas', 'sub', 20),
  t('Metal Stud Framing', 'bathroom', 5, 'GC Inspection — Framing', 'Inspección GC — Estructura', 'gc', 20, { is_gate: true, is_inspection: true, verification_criteria: 'Plumb, level, proper spacing, blocking for accessories' }),

  // Kitchen (5 tasks)
  t('Metal Stud Framing', 'kitchen', 1, 'Layout & snap lines', 'Trazar y marcar líneas', 'sub', 15),
  t('Metal Stud Framing', 'kitchen', 2, 'Install floor/ceiling tracks', 'Instalar rieles de piso/techo', 'sub', 20),
  t('Metal Stud Framing', 'kitchen', 3, 'Install studs & blocking', 'Instalar montantes y bloqueo', 'sub', 25),
  t('Metal Stud Framing', 'kitchen', 4, 'Install door frames', 'Instalar marcos de puertas', 'sub', 20),
  t('Metal Stud Framing', 'kitchen', 5, 'GC Inspection — Framing', 'Inspección GC — Estructura', 'gc', 20, { is_gate: true, is_inspection: true }),

  // Corridor (4 tasks)
  t('Metal Stud Framing', 'corridor', 1, 'Layout & snap lines', 'Trazar y marcar líneas', 'sub', 20),
  t('Metal Stud Framing', 'corridor', 2, 'Install tracks & studs', 'Instalar rieles y montantes', 'sub', 30),
  t('Metal Stud Framing', 'corridor', 3, 'Install door frames', 'Instalar marcos de puertas', 'sub', 25),
  t('Metal Stud Framing', 'corridor', 4, 'GC Inspection — Framing', 'Inspección GC — Estructura', 'gc', 25, { is_gate: true, is_inspection: true }),

  // Office (5 tasks)
  t('Metal Stud Framing', 'office', 1, 'Layout & snap lines', 'Trazar y marcar líneas', 'sub', 15),
  t('Metal Stud Framing', 'office', 2, 'Install floor/ceiling tracks', 'Instalar rieles de piso/techo', 'sub', 20),
  t('Metal Stud Framing', 'office', 3, 'Install studs & blocking', 'Instalar montantes y bloqueo', 'sub', 25),
  t('Metal Stud Framing', 'office', 4, 'Install door frames', 'Instalar marcos de puertas', 'sub', 20),
  t('Metal Stud Framing', 'office', 5, 'GC Inspection — Framing', 'Inspección GC — Estructura', 'gc', 20, { is_gate: true, is_inspection: true }),

  // ─── Trade 3: MEP Rough-In ───────────────────────────────────
  // Bathroom (5 tasks)
  t('MEP Rough-In', 'bathroom', 1, 'Install electrical conduit & boxes', 'Instalar conduit eléctrico y cajas', 'sub', 25),
  t('MEP Rough-In', 'bathroom', 2, 'Install HVAC ductwork', 'Instalar ductos de HVAC', 'sub', 20),
  t('MEP Rough-In', 'bathroom', 3, 'Install fire sprinkler piping', 'Instalar tubería contra incendios', 'sub', 20),
  t('MEP Rough-In', 'bathroom', 4, 'Pull electrical wire', 'Pasar cable eléctrico', 'sub', 15),
  t('MEP Rough-In', 'bathroom', 5, 'GC Inspection — MEP rough-in', 'Inspección GC — MEP bruto', 'gc', 20, { is_gate: true, is_inspection: true, verification_criteria: 'All conduit secured, boxes at correct height, duct connections sealed' }),

  // Kitchen (5 tasks)
  t('MEP Rough-In', 'kitchen', 1, 'Install electrical conduit & boxes', 'Instalar conduit eléctrico y cajas', 'sub', 20),
  t('MEP Rough-In', 'kitchen', 2, 'Install HVAC ductwork & hood duct', 'Instalar ductos HVAC y campana', 'sub', 20),
  t('MEP Rough-In', 'kitchen', 3, 'Install fire sprinkler piping', 'Instalar tubería contra incendios', 'sub', 20),
  t('MEP Rough-In', 'kitchen', 4, 'Pull electrical wire', 'Pasar cable eléctrico', 'sub', 20),
  t('MEP Rough-In', 'kitchen', 5, 'GC Inspection — MEP rough-in', 'Inspección GC — MEP bruto', 'gc', 20, { is_gate: true, is_inspection: true }),

  // Corridor (4 tasks)
  t('MEP Rough-In', 'corridor', 1, 'Install electrical conduit & boxes', 'Instalar conduit eléctrico y cajas', 'sub', 25),
  t('MEP Rough-In', 'corridor', 2, 'Install HVAC ductwork', 'Instalar ductos de HVAC', 'sub', 25),
  t('MEP Rough-In', 'corridor', 3, 'Install fire sprinkler piping', 'Instalar tubería contra incendios', 'sub', 25),
  t('MEP Rough-In', 'corridor', 4, 'GC Inspection — MEP rough-in', 'Inspección GC — MEP bruto', 'gc', 25, { is_gate: true, is_inspection: true }),

  // Office (5 tasks)
  t('MEP Rough-In', 'office', 1, 'Install electrical conduit & boxes', 'Instalar conduit eléctrico y cajas', 'sub', 20),
  t('MEP Rough-In', 'office', 2, 'Install HVAC ductwork', 'Instalar ductos de HVAC', 'sub', 25),
  t('MEP Rough-In', 'office', 3, 'Install fire sprinkler piping', 'Instalar tubería contra incendios', 'sub', 15),
  t('MEP Rough-In', 'office', 4, 'Pull electrical wire', 'Pasar cable eléctrico', 'sub', 20),
  t('MEP Rough-In', 'office', 5, 'GC Inspection — MEP rough-in', 'Inspección GC — MEP bruto', 'gc', 20, { is_gate: true, is_inspection: true }),

  // ─── Trade 4: Fire Stopping ──────────────────────────────────
  // Bathroom (4 tasks)
  t('Fire Stopping', 'bathroom', 1, 'Identify & mark all penetrations', 'Identificar y marcar todas las penetraciones', 'sub', 20),
  t('Fire Stopping', 'bathroom', 2, 'Install firestop materials', 'Instalar materiales cortafuegos', 'sub', 35),
  t('Fire Stopping', 'bathroom', 3, 'Label & document penetrations', 'Etiquetar y documentar penetraciones', 'sub', 15, { requires_photo: true, verification_criteria: 'Each penetration labeled with UL system number' }),
  t('Fire Stopping', 'bathroom', 4, 'FDNY Inspection — Fire stopping', 'Inspección FDNY — Cortafuegos', 'gc', 30, { is_gate: true, is_inspection: true, verification_criteria: 'FDNY inspector sign-off on all rated assemblies' }),

  // Kitchen (4 tasks)
  t('Fire Stopping', 'kitchen', 1, 'Identify & mark all penetrations', 'Identificar y marcar todas las penetraciones', 'sub', 20),
  t('Fire Stopping', 'kitchen', 2, 'Install firestop materials', 'Instalar materiales cortafuegos', 'sub', 35),
  t('Fire Stopping', 'kitchen', 3, 'Label & document penetrations', 'Etiquetar y documentar penetraciones', 'sub', 15, { requires_photo: true }),
  t('Fire Stopping', 'kitchen', 4, 'FDNY Inspection — Fire stopping', 'Inspección FDNY — Cortafuegos', 'gc', 30, { is_gate: true, is_inspection: true }),

  // Corridor (4 tasks)
  t('Fire Stopping', 'corridor', 1, 'Identify & mark all penetrations', 'Identificar y marcar todas las penetraciones', 'sub', 20),
  t('Fire Stopping', 'corridor', 2, 'Install firestop materials', 'Instalar materiales cortafuegos', 'sub', 35),
  t('Fire Stopping', 'corridor', 3, 'Label & document penetrations', 'Etiquetar y documentar penetraciones', 'sub', 15, { requires_photo: true }),
  t('Fire Stopping', 'corridor', 4, 'FDNY Inspection — Fire stopping', 'Inspección FDNY — Cortafuegos', 'gc', 30, { is_gate: true, is_inspection: true }),

  // Office (4 tasks)
  t('Fire Stopping', 'office', 1, 'Identify & mark all penetrations', 'Identificar y marcar todas las penetraciones', 'sub', 20),
  t('Fire Stopping', 'office', 2, 'Install firestop materials', 'Instalar materiales cortafuegos', 'sub', 35),
  t('Fire Stopping', 'office', 3, 'Label & document penetrations', 'Etiquetar y documentar penetraciones', 'sub', 15, { requires_photo: true }),
  t('Fire Stopping', 'office', 4, 'FDNY Inspection — Fire stopping', 'Inspección FDNY — Cortafuegos', 'gc', 30, { is_gate: true, is_inspection: true }),

  // ─── Trade 5: Insulation & Drywall ───────────────────────────
  // Bathroom (5 tasks)
  t('Insulation & Drywall', 'bathroom', 1, 'Install batt insulation', 'Instalar aislamiento de fibra', 'sub', 15),
  t('Insulation & Drywall', 'bathroom', 2, 'Hang drywall (moisture-resistant)', 'Colocar tablaroca (resistente a humedad)', 'sub', 25),
  t('Insulation & Drywall', 'bathroom', 3, 'Tape, mud & sand joints', 'Encintado, masillado y lijado de juntas', 'sub', 25),
  t('Insulation & Drywall', 'bathroom', 4, 'Apply skim coat to Level 4', 'Aplicar acabado Nivel 4', 'sub', 15),
  t('Insulation & Drywall', 'bathroom', 5, 'GC Inspection — Drywall finish', 'Inspección GC — Acabado tablaroca', 'gc', 20, { is_gate: true, is_inspection: true, verification_criteria: 'Level 4 finish, no visible joints or fastener marks' }),

  // Kitchen (5 tasks)
  t('Insulation & Drywall', 'kitchen', 1, 'Install batt insulation', 'Instalar aislamiento de fibra', 'sub', 15),
  t('Insulation & Drywall', 'kitchen', 2, 'Hang drywall', 'Colocar tablaroca', 'sub', 25),
  t('Insulation & Drywall', 'kitchen', 3, 'Tape, mud & sand joints', 'Encintado, masillado y lijado de juntas', 'sub', 25),
  t('Insulation & Drywall', 'kitchen', 4, 'Apply skim coat to Level 4', 'Aplicar acabado Nivel 4', 'sub', 15),
  t('Insulation & Drywall', 'kitchen', 5, 'GC Inspection — Drywall finish', 'Inspección GC — Acabado tablaroca', 'gc', 20, { is_gate: true, is_inspection: true }),

  // Corridor (4 tasks)
  t('Insulation & Drywall', 'corridor', 1, 'Install batt insulation', 'Instalar aislamiento de fibra', 'sub', 20),
  t('Insulation & Drywall', 'corridor', 2, 'Hang drywall', 'Colocar tablaroca', 'sub', 30),
  t('Insulation & Drywall', 'corridor', 3, 'Tape, mud & sand joints', 'Encintado, masillado y lijado de juntas', 'sub', 25),
  t('Insulation & Drywall', 'corridor', 4, 'GC Inspection — Drywall finish', 'Inspección GC — Acabado tablaroca', 'gc', 25, { is_gate: true, is_inspection: true }),

  // Office (5 tasks)
  t('Insulation & Drywall', 'office', 1, 'Install batt insulation', 'Instalar aislamiento de fibra', 'sub', 15),
  t('Insulation & Drywall', 'office', 2, 'Hang drywall', 'Colocar tablaroca', 'sub', 25),
  t('Insulation & Drywall', 'office', 3, 'Tape, mud & sand joints', 'Encintado, masillado y lijado de juntas', 'sub', 25),
  t('Insulation & Drywall', 'office', 4, 'Apply skim coat to Level 4', 'Aplicar acabado Nivel 4', 'sub', 15),
  t('Insulation & Drywall', 'office', 5, 'GC Inspection — Drywall finish', 'Inspección GC — Acabado tablaroca', 'gc', 20, { is_gate: true, is_inspection: true }),

  // ─── Trade 6: Waterproofing (Bathroom + Kitchen only) ────────
  // Bathroom (5 tasks)
  t('Waterproofing', 'bathroom', 1, 'Surface prep & priming', 'Preparación y aplicación de primer', 'sub', 15),
  t('Waterproofing', 'bathroom', 2, 'Apply waterproof membrane', 'Aplicar membrana impermeabilizante', 'sub', 25),
  t('Waterproofing', 'bathroom', 3, 'Install sheet membrane at joints', 'Instalar membrana en juntas', 'sub', 20),
  t('Waterproofing', 'bathroom', 4, 'Flood test (48h)', 'Prueba de inundación (48h)', 'sub', 15, { requires_photo: true, verification_criteria: 'Maintain 2" water level for 48 hours, no leaks detected below' }),
  t('Waterproofing', 'bathroom', 5, 'GC Inspection — Waterproofing', 'Inspección GC — Impermeabilización', 'gc', 25, { is_gate: true, is_inspection: true, verification_criteria: 'Flood test passed, membrane integrity confirmed, no moisture below' }),

  // Kitchen (4 tasks)
  t('Waterproofing', 'kitchen', 1, 'Surface prep & priming', 'Preparación y aplicación de primer', 'sub', 20),
  t('Waterproofing', 'kitchen', 2, 'Apply waterproof membrane', 'Aplicar membrana impermeabilizante', 'sub', 30),
  t('Waterproofing', 'kitchen', 3, 'Flood test (24h)', 'Prueba de inundación (24h)', 'sub', 20, { requires_photo: true }),
  t('Waterproofing', 'kitchen', 4, 'GC Inspection — Waterproofing', 'Inspección GC — Impermeabilización', 'gc', 30, { is_gate: true, is_inspection: true }),

  // ─── Trade 7: Tile / Stone (Bathroom + Kitchen only) ─────────
  // Bathroom (5 tasks)
  t('Tile / Stone', 'bathroom', 1, 'Layout & set datum lines', 'Trazar líneas de referencia', 'sub', 10),
  t('Tile / Stone', 'bathroom', 2, 'Install floor tile', 'Instalar azulejo de piso', 'sub', 30),
  t('Tile / Stone', 'bathroom', 3, 'Install wall tile', 'Instalar azulejo de pared', 'sub', 25),
  t('Tile / Stone', 'bathroom', 4, 'Grout & seal', 'Aplicar lechada y sellador', 'sub', 15),
  t('Tile / Stone', 'bathroom', 5, 'GC Inspection — Tile/stone', 'Inspección GC — Azulejo/piedra', 'gc', 20, { is_gate: true, is_inspection: true, verification_criteria: 'Grout lines consistent, no lippage, proper slope to drains' }),

  // Kitchen (5 tasks)
  t('Tile / Stone', 'kitchen', 1, 'Layout & set datum lines', 'Trazar líneas de referencia', 'sub', 10),
  t('Tile / Stone', 'kitchen', 2, 'Install floor tile', 'Instalar azulejo de piso', 'sub', 30),
  t('Tile / Stone', 'kitchen', 3, 'Install backsplash tile', 'Instalar azulejo de salpicadero', 'sub', 25),
  t('Tile / Stone', 'kitchen', 4, 'Grout & seal', 'Aplicar lechada y sellador', 'sub', 15),
  t('Tile / Stone', 'kitchen', 5, 'GC Inspection — Tile/stone', 'Inspección GC — Azulejo/piedra', 'gc', 20, { is_gate: true, is_inspection: true }),

  // ─── Trade 8: Paint ──────────────────────────────────────────
  // Bathroom (4 tasks)
  t('Paint', 'bathroom', 1, 'Apply primer coat', 'Aplicar capa de primer', 'sub', 25),
  t('Paint', 'bathroom', 2, 'Apply first finish coat', 'Aplicar primera capa de acabado', 'sub', 30),
  t('Paint', 'bathroom', 3, 'Apply second finish coat', 'Aplicar segunda capa de acabado', 'sub', 25),
  t('Paint', 'bathroom', 4, 'GC Inspection — Paint', 'Inspección GC — Pintura', 'gc', 20, { is_gate: true, is_inspection: true, verification_criteria: 'Even coverage, no runs or sags, correct color per spec' }),

  // Kitchen (4 tasks)
  t('Paint', 'kitchen', 1, 'Apply primer coat', 'Aplicar capa de primer', 'sub', 25),
  t('Paint', 'kitchen', 2, 'Apply first finish coat', 'Aplicar primera capa de acabado', 'sub', 30),
  t('Paint', 'kitchen', 3, 'Apply second finish coat', 'Aplicar segunda capa de acabado', 'sub', 25),
  t('Paint', 'kitchen', 4, 'GC Inspection — Paint', 'Inspección GC — Pintura', 'gc', 20, { is_gate: true, is_inspection: true }),

  // Corridor (4 tasks)
  t('Paint', 'corridor', 1, 'Apply primer coat', 'Aplicar capa de primer', 'sub', 25),
  t('Paint', 'corridor', 2, 'Apply first finish coat', 'Aplicar primera capa de acabado', 'sub', 30),
  t('Paint', 'corridor', 3, 'Apply second finish coat', 'Aplicar segunda capa de acabado', 'sub', 25),
  t('Paint', 'corridor', 4, 'GC Inspection — Paint', 'Inspección GC — Pintura', 'gc', 20, { is_gate: true, is_inspection: true }),

  // Office (4 tasks)
  t('Paint', 'office', 1, 'Apply primer coat', 'Aplicar capa de primer', 'sub', 25),
  t('Paint', 'office', 2, 'Apply first finish coat', 'Aplicar primera capa de acabado', 'sub', 30),
  t('Paint', 'office', 3, 'Apply second finish coat', 'Aplicar segunda capa de acabado', 'sub', 25),
  t('Paint', 'office', 4, 'GC Inspection — Paint', 'Inspección GC — Pintura', 'gc', 20, { is_gate: true, is_inspection: true }),

  // ─── Trade 9: Ceiling Grid / ACT (Kitchen, Corridor, Office) ─
  // Kitchen (4 tasks)
  t('Ceiling Grid / ACT', 'kitchen', 1, 'Install suspension wire & main grid', 'Instalar alambre de suspensión y rejilla', 'sub', 30),
  t('Ceiling Grid / ACT', 'kitchen', 2, 'Install acoustical ceiling tiles', 'Instalar losetas acústicas de techo', 'sub', 30),
  t('Ceiling Grid / ACT', 'kitchen', 3, 'Integrate MEP fixtures in grid', 'Integrar accesorios MEP en rejilla', 'sub', 15),
  t('Ceiling Grid / ACT', 'kitchen', 4, 'GC Inspection — Ceiling grid', 'Inspección GC — Techo acústico', 'gc', 25, { is_gate: true, is_inspection: true }),

  // Corridor (4 tasks)
  t('Ceiling Grid / ACT', 'corridor', 1, 'Install suspension wire & main grid', 'Instalar alambre de suspensión y rejilla', 'sub', 30),
  t('Ceiling Grid / ACT', 'corridor', 2, 'Install acoustical ceiling tiles', 'Instalar losetas acústicas de techo', 'sub', 25),
  t('Ceiling Grid / ACT', 'corridor', 3, 'Integrate MEP fixtures in grid', 'Integrar accesorios MEP en rejilla', 'sub', 20),
  t('Ceiling Grid / ACT', 'corridor', 4, 'GC Inspection — Ceiling grid', 'Inspección GC — Techo acústico', 'gc', 25, { is_gate: true, is_inspection: true }),

  // Office (4 tasks)
  t('Ceiling Grid / ACT', 'office', 1, 'Install suspension wire & main grid', 'Instalar alambre de suspensión y rejilla', 'sub', 30),
  t('Ceiling Grid / ACT', 'office', 2, 'Install acoustical ceiling tiles', 'Instalar losetas acústicas de techo', 'sub', 25),
  t('Ceiling Grid / ACT', 'office', 3, 'Integrate MEP fixtures in grid', 'Integrar accesorios MEP en rejilla', 'sub', 20),
  t('Ceiling Grid / ACT', 'office', 4, 'GC Inspection — Ceiling grid', 'Inspección GC — Techo acústico', 'gc', 25, { is_gate: true, is_inspection: true }),

  // ─── Trade 10: MEP Trim-Out ──────────────────────────────────
  // Bathroom (5 tasks)
  t('MEP Trim-Out', 'bathroom', 1, 'Install outlets & switches', 'Instalar tomacorrientes e interruptores', 'sub', 15),
  t('MEP Trim-Out', 'bathroom', 2, 'Install light fixtures', 'Instalar luminarias', 'sub', 20),
  t('MEP Trim-Out', 'bathroom', 3, 'Install plumbing fixtures (faucets, toilets)', 'Instalar accesorios de plomería (grifos, inodoros)', 'sub', 30),
  t('MEP Trim-Out', 'bathroom', 4, 'Install HVAC registers', 'Instalar registros de HVAC', 'sub', 15),
  t('MEP Trim-Out', 'bathroom', 5, 'GC Inspection — MEP trim-out', 'Inspección GC — Acabado MEP', 'gc', 20, { is_gate: true, is_inspection: true, verification_criteria: 'All fixtures operational, no leaks, proper electrical connections' }),

  // Kitchen (5 tasks)
  t('MEP Trim-Out', 'kitchen', 1, 'Install outlets & switches', 'Instalar tomacorrientes e interruptores', 'sub', 15),
  t('MEP Trim-Out', 'kitchen', 2, 'Install light fixtures', 'Instalar luminarias', 'sub', 20),
  t('MEP Trim-Out', 'kitchen', 3, 'Install plumbing fixtures (sink, disposal)', 'Instalar accesorios de plomería (fregadero, triturador)', 'sub', 25),
  t('MEP Trim-Out', 'kitchen', 4, 'Install HVAC registers & hood vent', 'Instalar registros HVAC y ventilación de campana', 'sub', 20),
  t('MEP Trim-Out', 'kitchen', 5, 'GC Inspection — MEP trim-out', 'Inspección GC — Acabado MEP', 'gc', 20, { is_gate: true, is_inspection: true }),

  // Corridor (4 tasks)
  t('MEP Trim-Out', 'corridor', 1, 'Install outlets & switches', 'Instalar tomacorrientes e interruptores', 'sub', 20),
  t('MEP Trim-Out', 'corridor', 2, 'Install light fixtures & exit signs', 'Instalar luminarias y señales de salida', 'sub', 30),
  t('MEP Trim-Out', 'corridor', 3, 'Install HVAC registers', 'Instalar registros de HVAC', 'sub', 25),
  t('MEP Trim-Out', 'corridor', 4, 'GC Inspection — MEP trim-out', 'Inspección GC — Acabado MEP', 'gc', 25, { is_gate: true, is_inspection: true }),

  // Office (5 tasks)
  t('MEP Trim-Out', 'office', 1, 'Install outlets & data jacks', 'Instalar tomacorrientes y jacks de datos', 'sub', 20),
  t('MEP Trim-Out', 'office', 2, 'Install light fixtures', 'Instalar luminarias', 'sub', 25),
  t('MEP Trim-Out', 'office', 3, 'Install plumbing fixtures', 'Instalar accesorios de plomería', 'sub', 15),
  t('MEP Trim-Out', 'office', 4, 'Install HVAC registers & thermostats', 'Instalar registros HVAC y termostatos', 'sub', 20),
  t('MEP Trim-Out', 'office', 5, 'GC Inspection — MEP trim-out', 'Inspección GC — Acabado MEP', 'gc', 20, { is_gate: true, is_inspection: true }),

  // ─── Trade 11: Doors & Hardware ──────────────────────────────
  // Bathroom (4 tasks)
  t('Doors & Hardware', 'bathroom', 1, 'Hang doors', 'Colgar puertas', 'sub', 30),
  t('Doors & Hardware', 'bathroom', 2, 'Install locksets & closers', 'Instalar cerraduras y cierrapuertas', 'sub', 30),
  t('Doors & Hardware', 'bathroom', 3, 'Install ADA accessories (grab bars, signage)', 'Instalar accesorios ADA (barras, señalización)', 'sub', 20),
  t('Doors & Hardware', 'bathroom', 4, 'GC Inspection — Doors & hardware', 'Inspección GC — Puertas y herrajes', 'gc', 20, { is_gate: true, is_inspection: true }),

  // Kitchen (4 tasks)
  t('Doors & Hardware', 'kitchen', 1, 'Hang doors', 'Colgar puertas', 'sub', 30),
  t('Doors & Hardware', 'kitchen', 2, 'Install locksets & closers', 'Instalar cerraduras y cierrapuertas', 'sub', 30),
  t('Doors & Hardware', 'kitchen', 3, 'Install door accessories', 'Instalar accesorios de puertas', 'sub', 20),
  t('Doors & Hardware', 'kitchen', 4, 'GC Inspection — Doors & hardware', 'Inspección GC — Puertas y herrajes', 'gc', 20, { is_gate: true, is_inspection: true }),

  // Corridor (4 tasks)
  t('Doors & Hardware', 'corridor', 1, 'Hang doors', 'Colgar puertas', 'sub', 25),
  t('Doors & Hardware', 'corridor', 2, 'Install locksets, closers & panic hardware', 'Instalar cerraduras, cierrapuertas y herraje antipánico', 'sub', 30),
  t('Doors & Hardware', 'corridor', 3, 'Install fire-rated door labels', 'Instalar etiquetas de puertas cortafuegos', 'sub', 20),
  t('Doors & Hardware', 'corridor', 4, 'GC Inspection — Doors & hardware', 'Inspección GC — Puertas y herrajes', 'gc', 25, { is_gate: true, is_inspection: true, verification_criteria: 'Fire labels present, panic hardware operational, ADA clearances met' }),

  // Office (4 tasks)
  t('Doors & Hardware', 'office', 1, 'Hang doors', 'Colgar puertas', 'sub', 30),
  t('Doors & Hardware', 'office', 2, 'Install locksets & closers', 'Instalar cerraduras y cierrapuertas', 'sub', 30),
  t('Doors & Hardware', 'office', 3, 'Install door accessories', 'Instalar accesorios de puertas', 'sub', 20),
  t('Doors & Hardware', 'office', 4, 'GC Inspection — Doors & hardware', 'Inspección GC — Puertas y herrajes', 'gc', 20, { is_gate: true, is_inspection: true }),

  // ─── Trade 12: Millwork & Countertops (Bath, Kitchen, Office) ─
  // Bathroom (4 tasks)
  t('Millwork & Countertops', 'bathroom', 1, 'Install vanity cabinets', 'Instalar gabinetes de tocador', 'sub', 30),
  t('Millwork & Countertops', 'bathroom', 2, 'Install countertops', 'Instalar encimeras', 'sub', 30),
  t('Millwork & Countertops', 'bathroom', 3, 'Install mirrors & accessories', 'Instalar espejos y accesorios', 'sub', 20),
  t('Millwork & Countertops', 'bathroom', 4, 'GC Inspection — Millwork', 'Inspección GC — Carpintería', 'gc', 20, { is_gate: true, is_inspection: true }),

  // Kitchen (5 tasks)
  t('Millwork & Countertops', 'kitchen', 1, 'Install base cabinets', 'Instalar gabinetes base', 'sub', 25),
  t('Millwork & Countertops', 'kitchen', 2, 'Install upper cabinets', 'Instalar gabinetes superiores', 'sub', 20),
  t('Millwork & Countertops', 'kitchen', 3, 'Install countertops', 'Instalar encimeras', 'sub', 25),
  t('Millwork & Countertops', 'kitchen', 4, 'Install hardware & accessories', 'Instalar herrajes y accesorios', 'sub', 10),
  t('Millwork & Countertops', 'kitchen', 5, 'GC Inspection — Millwork', 'Inspección GC — Carpintería', 'gc', 20, { is_gate: true, is_inspection: true }),

  // Office (4 tasks)
  t('Millwork & Countertops', 'office', 1, 'Install built-in casework', 'Instalar muebles empotrados', 'sub', 30),
  t('Millwork & Countertops', 'office', 2, 'Install countertops & work surfaces', 'Instalar encimeras y superficies de trabajo', 'sub', 30),
  t('Millwork & Countertops', 'office', 3, 'Install hardware & accessories', 'Instalar herrajes y accesorios', 'sub', 20),
  t('Millwork & Countertops', 'office', 4, 'GC Inspection — Millwork', 'Inspección GC — Carpintería', 'gc', 20, { is_gate: true, is_inspection: true }),

  // ─── Trade 13: Flooring (Kitchen, Corridor, Office) ──────────
  // Kitchen (4 tasks)
  t('Flooring', 'kitchen', 1, 'Subfloor prep & leveling', 'Preparación y nivelación de subpiso', 'sub', 25),
  t('Flooring', 'kitchen', 2, 'Install flooring material', 'Instalar material de piso', 'sub', 35),
  t('Flooring', 'kitchen', 3, 'Install transitions & trim', 'Instalar transiciones y molduras', 'sub', 15),
  t('Flooring', 'kitchen', 4, 'GC Inspection — Flooring', 'Inspección GC — Pisos', 'gc', 25, { is_gate: true, is_inspection: true }),

  // Corridor (4 tasks)
  t('Flooring', 'corridor', 1, 'Subfloor prep & leveling', 'Preparación y nivelación de subpiso', 'sub', 25),
  t('Flooring', 'corridor', 2, 'Install flooring material (LVT/carpet)', 'Instalar piso (LVT/alfombra)', 'sub', 35),
  t('Flooring', 'corridor', 3, 'Install transitions & trim', 'Instalar transiciones y molduras', 'sub', 15),
  t('Flooring', 'corridor', 4, 'GC Inspection — Flooring', 'Inspección GC — Pisos', 'gc', 25, { is_gate: true, is_inspection: true }),

  // Office (4 tasks)
  t('Flooring', 'office', 1, 'Subfloor prep & leveling', 'Preparación y nivelación de subpiso', 'sub', 25),
  t('Flooring', 'office', 2, 'Install flooring material (carpet/LVT)', 'Instalar piso (alfombra/LVT)', 'sub', 35),
  t('Flooring', 'office', 3, 'Install transitions & trim', 'Instalar transiciones y molduras', 'sub', 15),
  t('Flooring', 'office', 4, 'GC Inspection — Flooring', 'Inspección GC — Pisos', 'gc', 25, { is_gate: true, is_inspection: true }),

  // ─── Trade 14: Final Clean & Punch ───────────────────────────
  // Bathroom (4 tasks)
  t('Final Clean & Punch', 'bathroom', 1, 'Detailed cleaning', 'Limpieza detallada', 'sub', 30),
  t('Final Clean & Punch', 'bathroom', 2, 'Touch-up paint & caulk', 'Retoques de pintura y sellador', 'sub', 25),
  t('Final Clean & Punch', 'bathroom', 3, 'Compile punch list items', 'Compilar lista de pendientes', 'sub', 20),
  t('Final Clean & Punch', 'bathroom', 4, 'GC Final Walkthrough', 'Recorrido final GC', 'gc', 25, { is_gate: true, is_inspection: true, verification_criteria: 'All punch list items resolved, area ready for occupancy' }),

  // Kitchen (4 tasks)
  t('Final Clean & Punch', 'kitchen', 1, 'Detailed cleaning', 'Limpieza detallada', 'sub', 30),
  t('Final Clean & Punch', 'kitchen', 2, 'Touch-up paint & caulk', 'Retoques de pintura y sellador', 'sub', 25),
  t('Final Clean & Punch', 'kitchen', 3, 'Compile punch list items', 'Compilar lista de pendientes', 'sub', 20),
  t('Final Clean & Punch', 'kitchen', 4, 'GC Final Walkthrough', 'Recorrido final GC', 'gc', 25, { is_gate: true, is_inspection: true }),

  // Corridor (4 tasks)
  t('Final Clean & Punch', 'corridor', 1, 'Detailed cleaning', 'Limpieza detallada', 'sub', 30),
  t('Final Clean & Punch', 'corridor', 2, 'Touch-up paint & caulk', 'Retoques de pintura y sellador', 'sub', 25),
  t('Final Clean & Punch', 'corridor', 3, 'Compile punch list items', 'Compilar lista de pendientes', 'sub', 20),
  t('Final Clean & Punch', 'corridor', 4, 'GC Final Walkthrough', 'Recorrido final GC', 'gc', 25, { is_gate: true, is_inspection: true }),

  // Office (4 tasks)
  t('Final Clean & Punch', 'office', 1, 'Detailed cleaning', 'Limpieza detallada', 'sub', 30),
  t('Final Clean & Punch', 'office', 2, 'Touch-up paint & caulk', 'Retoques de pintura y sellador', 'sub', 25),
  t('Final Clean & Punch', 'office', 3, 'Compile punch list items', 'Compilar lista de pendientes', 'sub', 20),
  t('Final Clean & Punch', 'office', 4, 'GC Final Walkthrough', 'Recorrido final GC', 'gc', 25, { is_gate: true, is_inspection: true }),
];

// ═══════════════════════════════════════════════════════════════
// VALIDATION & EXECUTION
// ═══════════════════════════════════════════════════════════════

type WeightKey = string; // "trade_type|area_type"

function validateWeights(tasks: TaskTemplate[]): { valid: boolean; errors: string[] } {
  const sums = new Map<WeightKey, number>();
  for (const task of tasks) {
    const key = `${task.trade_type}|${task.area_type}`;
    sums.set(key, (sums.get(key) ?? 0) + task.weight);
  }

  const errors: string[] = [];
  for (const [key, sum] of sums) {
    if (sum !== 100) {
      const [trade, area] = key.split('|');
      errors.push(`${trade} / ${area}: weights sum to ${sum} (expected 100)`);
    }
  }

  return { valid: errors.length === 0, errors };
}

function printSummary(tasks: TaskTemplate[]) {
  const trades = new Set(tasks.map((t) => t.trade_type));
  const areas = new Set(tasks.map((t) => t.area_type));
  const gates = tasks.filter((t) => t.is_gate).length;
  const subTasks = tasks.filter((t) => t.task_owner === 'sub').length;
  const gcTasks = tasks.filter((t) => t.task_owner === 'gc').length;

  console.log('\n=== SEED SUMMARY ===');
  console.log(`Loaded ${trades.size} trades for ${areas.size} areas, total ${tasks.length} tasks`);
  console.log(`  SUB tasks: ${subTasks}`);
  console.log(`  GC tasks:  ${gcTasks}`);
  console.log(`  Gates:     ${gates}`);
  console.log(`  Trades:    ${[...trades].join(', ')}`);
  console.log(`  Areas:     ${[...areas].join(', ')}`);

  // Per-trade/area breakdown
  const combos = new Map<string, number>();
  for (const task of tasks) {
    const key = `${task.trade_type}|${task.area_type}`;
    combos.set(key, (combos.get(key) ?? 0) + 1);
  }
  console.log('\n  Trade / Area breakdown:');
  for (const trade of trades) {
    const areaCounts = [...areas]
      .map((a) => {
        const count = combos.get(`${trade}|${a}`);
        return count ? `${a}(${count})` : null;
      })
      .filter(Boolean)
      .join(', ');
    console.log(`    ${trade}: ${areaCounts}`);
  }
}

async function main() {
  const args = process.argv.slice(2);
  const force = args.includes('--force');
  const dryRun = args.includes('--dry-run');

  // Step 1: Validate weights
  console.log('Validating weights...');
  const { valid, errors } = validateWeights(TASKS);
  if (!valid) {
    console.error('\nWEIGHT VALIDATION FAILED:');
    for (const err of errors) console.error(`  - ${err}`);
    process.exit(1);
  }
  console.log(`All weights valid (${TASKS.length} tasks, every trade/area sums to 100)`);

  if (dryRun) {
    printSummary(TASKS);
    console.log('\n--dry-run: No data inserted.');
    return;
  }

  // Step 2: Connect to Supabase
  const supabase = createClient(SUPABASE_URL!, SERVICE_KEY!, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  // Step 3: Idempotency check
  const { count, error: countErr } = await supabase
    .from('trade_task_templates')
    .select('*', { count: 'exact', head: true })
    .is('org_id', null);

  if (countErr) {
    console.error('Failed to check existing templates:', countErr.message);
    process.exit(1);
  }

  if (count && count > 0 && !force) {
    console.log(`\nFound ${count} existing system templates. Use --force to replace.`);
    console.log('Aborting to prevent duplicates.');
    return;
  }

  // Step 4: Delete existing system templates if --force
  if (force && count && count > 0) {
    console.log(`Deleting ${count} existing system templates (--force)...`);
    const { error: delErr } = await supabase
      .from('trade_task_templates')
      .delete()
      .is('org_id', null);

    if (delErr) {
      console.error('Failed to delete existing templates:', delErr.message);
      process.exit(1);
    }
  }

  // Step 5: Insert all templates (batch — single transaction via PostgREST)
  console.log(`Inserting ${TASKS.length} task templates...`);
  const { data, error: insertErr } = await supabase
    .from('trade_task_templates')
    .insert(TASKS)
    .select('id');

  if (insertErr) {
    console.error('\nINSERT FAILED (transaction rolled back):');
    console.error(insertErr.message);
    process.exit(1);
  }

  console.log(`Inserted ${data?.length ?? 0} templates successfully.`);
  printSummary(TASKS);
}

main().catch((err) => {
  console.error('Unexpected error:', err);
  process.exit(1);
});
