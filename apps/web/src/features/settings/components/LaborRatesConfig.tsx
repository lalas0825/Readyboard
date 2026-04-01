'use client';

import { useState, useEffect, useCallback } from 'react';
import { toast } from 'sonner';
import { fetchLaborRates, type LaborRateRow, type TradeOTConfig } from '../services/fetchLaborRates';
import { saveLaborRates } from '../services/saveLaborRates';

type Props = { projectId: string };

const ROLES = ['foreman', 'journeyperson', 'apprentice', 'helper'] as const;
const ROLE_LABELS: Record<string, string> = {
  foreman: 'Foreman', journeyperson: 'JP', apprentice: 'Appr.', helper: 'Helper',
};

function calcDailyCost(
  rates: Record<string, number>,
  crew: Record<string, number>,
  stHours: number,
): number {
  let total = 0;
  for (const [role, count] of Object.entries(crew)) {
    total += (count || 0) * (rates[role] || 0) * stHours;
  }
  return Math.round(total);
}

export function LaborRatesConfig({ projectId }: Props) {
  const [rates, setRates] = useState<LaborRateRow[]>([]);
  const [otConfigs, setOtConfigs] = useState<TradeOTConfig[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [dirty, setDirty] = useState(false);

  const refresh = useCallback(async () => {
    setIsLoading(true);
    const data = await fetchLaborRates(projectId);
    setRates(data.rates);
    setOtConfigs(data.otConfigs);
    setIsLoading(false);
    setDirty(false);
  }, [projectId]);

  useEffect(() => { refresh(); }, [refresh]);

  function updateRate(tradeName: string, role: string, value: string) {
    setRates((prev) =>
      prev.map((r) =>
        r.trade_name === tradeName && r.role === role
          ? { ...r, hourly_rate: parseFloat(value) || 0 }
          : r,
      ),
    );
    setDirty(true);
  }

  function updateOT(tradeName: string, field: keyof TradeOTConfig, value: string | number) {
    setOtConfigs((prev) =>
      prev.map((c) =>
        c.trade_name === tradeName ? { ...c, [field]: value } : c,
      ),
    );
    setDirty(true);
  }

  function updateCrew(tradeName: string, role: string, count: number) {
    setOtConfigs((prev) =>
      prev.map((c) => {
        if (c.trade_name !== tradeName) return c;
        const crew = { ...(c.typical_crew || { foreman: 1, journeyperson: 3, apprentice: 1, helper: 0 }) };
        crew[role] = count;
        return { ...c, typical_crew: crew };
      }),
    );
    setDirty(true);
  }

  async function handleSave() {
    setIsSaving(true);
    const result = await saveLaborRates(projectId, rates, otConfigs);
    setIsSaving(false);
    if (result.ok) {
      toast.success('Labor rates saved');
      setDirty(false);
    } else {
      toast.error(result.error);
    }
  }

  async function handleReset() {
    setIsSaving(true);
    const { createServiceClient } = await import('@/lib/supabase/service');
    const supabase = createServiceClient();
    await supabase.rpc('seed_labor_rates', { p_project_id: projectId });
    setIsSaving(false);
    toast.success('Reset to NYC union defaults');
    refresh();
  }

  if (isLoading) {
    return <div className="py-8 text-center text-sm text-zinc-500">Loading labor rates...</div>;
  }

  // Group rates by trade
  const trades = [...new Set(rates.map((r) => r.trade_name))].sort();
  const rateMap: Record<string, Record<string, number>> = {};
  for (const r of rates) {
    if (!rateMap[r.trade_name]) rateMap[r.trade_name] = {};
    rateMap[r.trade_name][r.role] = r.hourly_rate;
  }
  const otMap: Record<string, TradeOTConfig> = {};
  for (const c of otConfigs) otMap[c.trade_name] = c;

  return (
    <div className="space-y-8 mt-8">
      {/* ─── OT Rules ─── */}
      <div>
        <h3 className="text-base font-semibold text-zinc-100">Work Hours & Overtime Rules</h3>
        <p className="mt-1 text-xs text-zinc-500">
          Configure straight time hours and overtime multipliers per trade. Edit to match your subcontract terms.
        </p>

        <div className="mt-3 overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-zinc-800 text-[10px] uppercase text-zinc-500">
                <th className="text-left py-2 pr-4">Trade</th>
                <th className="text-center py-2 px-2">ST Hrs</th>
                <th className="text-center py-2 px-2">OT</th>
                <th className="text-center py-2 px-2">DT</th>
                <th className="text-center py-2 px-2">Saturday</th>
              </tr>
            </thead>
            <tbody>
              {trades.map((trade) => {
                const ot = otMap[trade] || { straight_time_hours: 8, ot_multiplier: 1.5, dt_multiplier: 2, saturday_rule: 'ot' };
                return (
                  <tr key={`ot-${trade}`} className="border-b border-zinc-800/50">
                    <td className="py-2 pr-4 text-xs font-medium text-zinc-300">{trade}</td>
                    <td className="py-2 px-2 text-center">
                      <input type="number" value={ot.straight_time_hours} step={0.5} min={4} max={12}
                        onChange={(e) => updateOT(trade, 'straight_time_hours', parseFloat(e.target.value) || 8)}
                        className="w-14 text-center rounded border border-zinc-700 bg-transparent px-1 py-0.5 text-xs text-zinc-100 focus:border-amber-500 focus:outline-none" />
                    </td>
                    <td className="py-2 px-2 text-center">
                      <input type="number" value={ot.ot_multiplier} step={0.1} min={1} max={3}
                        onChange={(e) => updateOT(trade, 'ot_multiplier', parseFloat(e.target.value) || 1.5)}
                        className="w-14 text-center rounded border border-zinc-700 bg-transparent px-1 py-0.5 text-xs text-zinc-100 focus:border-amber-500 focus:outline-none" />
                      <span className="text-[10px] text-zinc-600 ml-0.5">&times;</span>
                    </td>
                    <td className="py-2 px-2 text-center">
                      <input type="number" value={ot.dt_multiplier} step={0.1} min={1} max={4}
                        onChange={(e) => updateOT(trade, 'dt_multiplier', parseFloat(e.target.value) || 2)}
                        className="w-14 text-center rounded border border-zinc-700 bg-transparent px-1 py-0.5 text-xs text-zinc-100 focus:border-amber-500 focus:outline-none" />
                      <span className="text-[10px] text-zinc-600 ml-0.5">&times;</span>
                    </td>
                    <td className="py-2 px-2 text-center">
                      <select value={ot.saturday_rule || 'ot'}
                        onChange={(e) => updateOT(trade, 'saturday_rule', e.target.value)}
                        className="rounded border border-zinc-700 bg-transparent px-2 py-0.5 text-xs text-zinc-100 focus:border-amber-500 focus:outline-none">
                        <option value="ot">OT (1.5&times;)</option>
                        <option value="straight_makeup">Straight</option>
                        <option value="double">Double (2&times;)</option>
                      </select>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* ─── Labor Rates Matrix ─── */}
      <div>
        <h3 className="text-base font-semibold text-zinc-100">Labor Rates by Trade</h3>
        <p className="mt-1 text-xs text-zinc-500">
          Loaded rates (wage + benefits) used to calculate delay costs. Defaults: NYC union prevailing wage 2025-2026.
        </p>

        <div className="mt-3 overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-zinc-800 text-[10px] uppercase text-zinc-500">
                <th className="text-left py-2 pr-4">Trade</th>
                {ROLES.map((r) => (
                  <th key={r} className="text-right py-2 px-2">{ROLE_LABELS[r]}</th>
                ))}
                <th className="text-right py-2 px-2">Daily Cost</th>
              </tr>
            </thead>
            <tbody>
              {trades.map((trade) => {
                const tradeRates = rateMap[trade] || {};
                const ot = otMap[trade];
                const crew = ot?.typical_crew || { foreman: 1, journeyperson: 3, apprentice: 1, helper: 0 };
                const daily = calcDailyCost(tradeRates, crew, ot?.straight_time_hours || 8);

                return (
                  <tr key={`rate-${trade}`} className="border-b border-zinc-800/50">
                    <td className="py-2 pr-4 text-xs font-medium text-zinc-300">{trade}</td>
                    {ROLES.map((role) => (
                      <td key={role} className="py-2 px-2">
                        <div className="flex items-center justify-end">
                          <span className="text-[10px] text-zinc-600 mr-0.5">$</span>
                          <input type="number" value={tradeRates[role] ?? ''} step={1} min={0} placeholder="—"
                            onChange={(e) => updateRate(trade, role, e.target.value)}
                            className="w-16 text-right rounded border border-zinc-700 bg-transparent px-1 py-0.5 text-xs text-zinc-100 focus:border-amber-500 focus:outline-none" />
                        </div>
                      </td>
                    ))}
                    <td className="py-2 px-2 text-right font-mono text-xs text-amber-400">
                      ${daily.toLocaleString()}/day
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Crew composition */}
        <div className="mt-4">
          <p className="text-[10px] uppercase tracking-wider text-zinc-500 mb-2">Typical Crew per Trade</p>
          <div className="space-y-1">
            {trades.map((trade) => {
              const ot = otMap[trade];
              const crew = ot?.typical_crew || { foreman: 1, journeyperson: 3, apprentice: 1, helper: 0 };
              const total = Object.values(crew).reduce((s, n) => s + (n || 0), 0);
              return (
                <div key={`crew-${trade}`} className="flex items-center gap-3 text-xs text-zinc-400">
                  <span className="w-40 truncate text-zinc-500">{trade}</span>
                  {ROLES.map((role) => (
                    <div key={role} className="flex items-center gap-1">
                      <input type="number" value={crew[role] ?? 0} min={0} max={20}
                        onChange={(e) => updateCrew(trade, role, parseInt(e.target.value) || 0)}
                        className="w-8 text-center rounded border border-zinc-800 bg-transparent text-[11px] text-zinc-300 focus:border-amber-500 focus:outline-none" />
                      <span className="text-[10px] text-zinc-600">{ROLE_LABELS[role]}</span>
                    </div>
                  ))}
                  <span className="text-[10px] text-zinc-600 ml-1">= {total} workers</span>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* ─── Actions ─── */}
      <div className="flex gap-3 pt-2">
        <button onClick={handleSave} disabled={!dirty || isSaving}
          className="rounded bg-amber-500 px-4 py-2 text-sm font-bold text-black transition-colors hover:bg-amber-400 disabled:opacity-40">
          {isSaving ? 'Saving...' : 'Save Changes'}
        </button>
        <button onClick={handleReset} disabled={isSaving}
          className="rounded border border-zinc-700 px-4 py-2 text-sm text-zinc-400 hover:bg-zinc-800 disabled:opacity-40">
          Reset to NYC Defaults
        </button>
      </div>
    </div>
  );
}
