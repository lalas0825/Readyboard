'use server';

import { createServiceClient } from '@/lib/supabase/service';
import { getSession } from '@/lib/auth/getSession';

/**
 * Clone all areas (and their units) from one floor to another floor.
 * Area names have the source floor prefix replaced with the target floor.
 * Skips areas that already exist on the target floor (by name).
 */
export async function cloneFloor(
  projectId: string,
  sourceFloor: string,
  targetFloor: string,
): Promise<{ ok: true; count: number } | { ok: false; error: string }> {
  const session = await getSession();
  if (!session) return { ok: false, error: 'Not authenticated' };

  if (sourceFloor === targetFloor) return { ok: false, error: 'Source and target floor must be different' };

  const supabase = createServiceClient();

  // Fetch all areas on source floor with unit info
  const { data: sourceAreas, error } = await supabase
    .from('areas')
    .select('id, name, floor, area_type, area_code, description, sort_order, unit_id, units(id, name, unit_type, sort_order)')
    .eq('project_id', projectId)
    .eq('floor', sourceFloor);

  if (error) return { ok: false, error: error.message };
  if (!sourceAreas || sourceAreas.length === 0) return { ok: false, error: `No areas found on floor ${sourceFloor}` };

  // Fetch existing area names on target floor (to deduplicate)
  const { data: targetExisting } = await supabase
    .from('areas')
    .select('name')
    .eq('project_id', projectId)
    .eq('floor', targetFloor);
  const existingNames = new Set((targetExisting ?? []).map((a) => a.name));

  // Build unit mapping: sourceUnitId → targetUnitId
  const unitMap = new Map<string, string>();

  for (const area of sourceAreas) {
    const unit = Array.isArray(area.units) ? null : area.units as { id: string; name: string; unit_type: string; sort_order: number } | null;
    if (!unit || unitMap.has(unit.id)) continue;

    // Rename unit: replace leading sourceFloor with targetFloor (e.g., "4A" → "5A")
    const newUnitName = unit.name.replace(
      new RegExp(`^${sourceFloor.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`),
      targetFloor,
    );

    // Find or create target unit
    const { data: existing } = await supabase
      .from('units')
      .select('id')
      .eq('project_id', projectId)
      .eq('floor', targetFloor)
      .eq('name', newUnitName)
      .maybeSingle();

    if (existing) {
      unitMap.set(unit.id, existing.id);
    } else {
      const { data: created } = await supabase
        .from('units')
        .insert({
          project_id: projectId,
          floor: targetFloor,
          name: newUnitName,
          unit_type: unit.unit_type,
          sort_order: unit.sort_order,
        })
        .select('id')
        .single();
      if (created) unitMap.set(unit.id, created.id);
    }
  }

  // Clone areas
  let count = 0;

  for (const area of sourceAreas) {
    // Replace floor prefix in name
    const newName = area.name.replace(
      new RegExp(`^${sourceFloor.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`),
      targetFloor,
    );

    if (existingNames.has(newName)) continue;

    const unitId = area.unit_id ? (unitMap.get(area.unit_id) ?? null) : null;

    const { data: newArea } = await supabase
      .from('areas')
      .insert({
        project_id: projectId,
        name: newName,
        floor: targetFloor,
        area_type: area.area_type,
        area_code: area.area_code ?? null,
        description: area.description ?? null,
        sort_order: area.sort_order ?? 0,
        unit_id: unitId,
      })
      .select('id')
      .single();

    if (!newArea) continue;
    count++;

    // Clone area_trade_status entries from source area
    const { data: srcStatus } = await supabase
      .from('area_trade_status')
      .select('trade_type')
      .eq('area_id', area.id);

    if (srcStatus && srcStatus.length > 0) {
      await supabase
        .from('area_trade_status')
        .insert(
          srcStatus.map((s) => ({
            area_id: newArea.id,
            trade_type: s.trade_type,
            effective_pct: 0,
            all_gates_passed: true,
          })),
        );
    }
  }

  // Auto-assign to existing project members
  if (count > 0) {
    const { data: members } = await supabase
      .from('project_members')
      .select('user_id')
      .eq('project_id', projectId)
      .in('role', ['sub_pm', 'superintendent', 'foreman']);

    for (const member of members ?? []) {
      await supabase.rpc('assign_user_to_project', {
        p_user_id: member.user_id,
        p_project_id: projectId,
      });
    }
  }

  return { ok: true, count };
}
