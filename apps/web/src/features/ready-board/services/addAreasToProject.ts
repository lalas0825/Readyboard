'use server';

import { createServiceClient } from '@/lib/supabase/service';
import { getSession } from '@/lib/auth/getSession';

type AreaInput = {
  name: string;
  floor: string;
  area_type: string;
  unit_name?: string;
  area_code?: string;
};

export async function addAreasToProject(
  projectId: string,
  areas: AreaInput[],
): Promise<{ ok: true; count: number } | { ok: false; error: string }> {
  const session = await getSession();
  if (!session) return { ok: false, error: 'Not authenticated' };

  const supabase = createServiceClient();
  let count = 0;

  for (const area of areas) {
    let unitId: string | null = null;

    // Create or find unit if unit_name provided
    if (area.unit_name) {
      const unitFullName = area.unit_name.length === 1
        ? `${area.floor}${area.unit_name}`
        : area.unit_name;

      const { data: existing } = await supabase
        .from('units')
        .select('id')
        .eq('project_id', projectId)
        .eq('name', unitFullName)
        .maybeSingle();

      if (existing) {
        unitId = existing.id;
      } else {
        const { data: created } = await supabase
          .from('units')
          .insert({ project_id: projectId, floor: area.floor, name: unitFullName, unit_type: 'standard_2br' })
          .select('id')
          .single();
        unitId = created?.id ?? null;
      }
    }

    // Insert area
    const { data: newArea, error: areaError } = await supabase
      .from('areas')
      .insert({
        project_id: projectId,
        name: area.name,
        floor: area.floor,
        area_type: area.area_type,
        unit_id: unitId,
        area_code: area.area_code ?? null,
      })
      .select('id')
      .single();

    if (areaError || !newArea) continue;
    count++;

    // Create area_trade_status — try matching area_type, fallback to corridor
    const { data: matchedTrades } = await supabase
      .from('trade_sequences')
      .select('trade_name')
      .eq('project_id', projectId)
      .eq('area_type', area.area_type);

    const trades = (matchedTrades && matchedTrades.length > 0)
      ? matchedTrades
      : await supabase
          .from('trade_sequences')
          .select('trade_name')
          .eq('project_id', projectId)
          .eq('area_type', 'corridor')
          .then(r => r.data ?? []);

    const uniqueTrades = [...new Set(trades.map(t => t.trade_name))];

    if (uniqueTrades.length > 0) {
      await supabase
        .from('area_trade_status')
        .insert(uniqueTrades.map(trade => ({
          area_id: newArea.id,
          trade_type: trade,
          effective_pct: 0,
          all_gates_passed: true,
        })));
    }
  }

  return { ok: true, count };
}
