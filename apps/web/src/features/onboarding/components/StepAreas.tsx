'use client';

import { useState } from 'react';
import { useOnboardingStore, type AreaEntry } from '../store/useOnboardingStore';

const AREA_TYPES = [
  { value: 'bathroom', label: 'Bathroom' },
  { value: 'kitchen', label: 'Kitchen' },
  { value: 'corridor', label: 'Corridor' },
  { value: 'office', label: 'Office' },
  { value: 'lobby', label: 'Lobby' },
  { value: 'utility', label: 'Utility' },
] as const;

export function StepAreas() {
  const { areas, setAreas, removeArea, nextStep, prevStep } = useOnboardingStore();

  // Quick-Add state
  const [floorFrom, setFloorFrom] = useState('1');
  const [floorTo, setFloorTo] = useState('3');
  const [unitFrom, setUnitFrom] = useState('A');
  const [unitTo, setUnitTo] = useState('D');
  const [areaType, setAreaType] = useState<AreaEntry['area_type']>('office');

  // Single add state
  const [singleName, setSingleName] = useState('');
  const [singleFloor, setSingleFloor] = useState('');
  const [singleType, setSingleType] = useState<AreaEntry['area_type']>('bathroom');

  function generateAreas() {
    const from = parseInt(floorFrom, 10);
    const to = parseInt(floorTo, 10);
    if (isNaN(from) || isNaN(to) || from > to) return;

    const startChar = unitFrom.toUpperCase().charCodeAt(0);
    const endChar = unitTo.toUpperCase().charCodeAt(0);
    if (startChar > endChar || startChar < 65 || endChar > 90) return;

    const generated: AreaEntry[] = [];
    for (let floor = from; floor <= to; floor++) {
      for (let c = startChar; c <= endChar; c++) {
        const unit = String.fromCharCode(c);
        generated.push({
          name: `${floor}${unit}`,
          floor: String(floor),
          area_type: areaType,
        });
      }
    }

    // Deduplicate against existing
    const existingKeys = new Set(areas.map((a) => `${a.name}-${a.floor}`));
    const newAreas = generated.filter((a) => !existingKeys.has(`${a.name}-${a.floor}`));
    setAreas([...areas, ...newAreas]);
  }

  function addSingle() {
    if (!singleName.trim() || !singleFloor.trim()) return;
    const existingKeys = new Set(areas.map((a) => `${a.name}-${a.floor}`));
    if (existingKeys.has(`${singleName.trim()}-${singleFloor.trim()}`)) return;
    setAreas([
      ...areas,
      { name: singleName.trim(), floor: singleFloor.trim(), area_type: singleType },
    ]);
    setSingleName('');
    setSingleFloor('');
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold text-zinc-100">Floors & Areas</h2>
        <p className="mt-1 text-sm text-zinc-400">
          Quick-add generates areas by floor range and unit letters. Or add individually.
        </p>
      </div>

      {/* Quick-Add */}
      <div className="rounded-lg border border-zinc-700 bg-zinc-800/50 p-4 space-y-3">
        <p className="text-xs font-medium uppercase tracking-wider text-zinc-500">Quick Add</p>
        <div className="grid grid-cols-5 gap-3 items-end">
          <div>
            <label className="block text-xs text-zinc-400 mb-1">Floor From</label>
            <input
              type="number"
              min={1}
              value={floorFrom}
              onChange={(e) => setFloorFrom(e.target.value)}
              className="block w-full rounded border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-zinc-100 focus:border-emerald-500 focus:outline-none"
            />
          </div>
          <div>
            <label className="block text-xs text-zinc-400 mb-1">Floor To</label>
            <input
              type="number"
              min={1}
              value={floorTo}
              onChange={(e) => setFloorTo(e.target.value)}
              className="block w-full rounded border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-zinc-100 focus:border-emerald-500 focus:outline-none"
            />
          </div>
          <div>
            <label className="block text-xs text-zinc-400 mb-1">Unit From</label>
            <input
              type="text"
              maxLength={1}
              value={unitFrom}
              onChange={(e) => setUnitFrom(e.target.value.toUpperCase())}
              className="block w-full rounded border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-zinc-100 uppercase focus:border-emerald-500 focus:outline-none"
            />
          </div>
          <div>
            <label className="block text-xs text-zinc-400 mb-1">Unit To</label>
            <input
              type="text"
              maxLength={1}
              value={unitTo}
              onChange={(e) => setUnitTo(e.target.value.toUpperCase())}
              className="block w-full rounded border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-zinc-100 uppercase focus:border-emerald-500 focus:outline-none"
            />
          </div>
          <div>
            <label className="block text-xs text-zinc-400 mb-1">Type</label>
            <select
              value={areaType}
              onChange={(e) => setAreaType(e.target.value as AreaEntry['area_type'])}
              className="block w-full rounded border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-zinc-100 focus:border-emerald-500 focus:outline-none"
            >
              {AREA_TYPES.map((t) => (
                <option key={t.value} value={t.value}>{t.label}</option>
              ))}
            </select>
          </div>
        </div>
        <button
          type="button"
          onClick={generateAreas}
          className="rounded-lg border border-emerald-700 bg-emerald-950/30 px-4 py-2 text-sm font-medium text-emerald-400 transition-colors hover:bg-emerald-950/50"
        >
          Generate Areas
        </button>
      </div>

      {/* Single Add */}
      <div className="rounded-lg border border-zinc-700 bg-zinc-800/50 p-4 space-y-3">
        <p className="text-xs font-medium uppercase tracking-wider text-zinc-500">Add Single</p>
        <div className="grid grid-cols-4 gap-3 items-end">
          <div>
            <label className="block text-xs text-zinc-400 mb-1">Name</label>
            <input
              type="text"
              value={singleName}
              onChange={(e) => setSingleName(e.target.value)}
              placeholder="Lobby A"
              className="block w-full rounded border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-zinc-100 placeholder-zinc-500 focus:border-emerald-500 focus:outline-none"
            />
          </div>
          <div>
            <label className="block text-xs text-zinc-400 mb-1">Floor</label>
            <input
              type="text"
              value={singleFloor}
              onChange={(e) => setSingleFloor(e.target.value)}
              placeholder="1"
              className="block w-full rounded border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-zinc-100 placeholder-zinc-500 focus:border-emerald-500 focus:outline-none"
            />
          </div>
          <div>
            <label className="block text-xs text-zinc-400 mb-1">Type</label>
            <select
              value={singleType}
              onChange={(e) => setSingleType(e.target.value as AreaEntry['area_type'])}
              className="block w-full rounded border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-zinc-100 focus:border-emerald-500 focus:outline-none"
            >
              {AREA_TYPES.map((t) => (
                <option key={t.value} value={t.value}>{t.label}</option>
              ))}
            </select>
          </div>
          <button
            type="button"
            onClick={addSingle}
            disabled={!singleName.trim() || !singleFloor.trim()}
            className="rounded-lg border border-zinc-600 px-4 py-2 text-sm font-medium text-zinc-300 transition-colors hover:bg-zinc-700 disabled:opacity-40"
          >
            Add
          </button>
        </div>
      </div>

      {/* Area list */}
      {areas.length > 0 && (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <p className="text-xs font-medium uppercase tracking-wider text-zinc-500">
              {areas.length} area{areas.length !== 1 ? 's' : ''}
            </p>
            <button
              type="button"
              onClick={() => setAreas([])}
              className="text-xs text-red-400 hover:text-red-300"
            >
              Clear all
            </button>
          </div>
          <div className="max-h-[200px] overflow-y-auto space-y-1 pr-1">
            {areas.map((area, i) => (
              <div
                key={`${area.name}-${area.floor}-${i}`}
                className="flex items-center justify-between rounded border border-zinc-800 bg-zinc-900 px-3 py-2"
              >
                <div className="flex items-center gap-3">
                  <span className="text-sm text-zinc-200">{area.name}</span>
                  <span className="text-xs text-zinc-500">Floor {area.floor}</span>
                  <span className="rounded bg-zinc-800 px-1.5 py-0.5 text-[10px] uppercase text-zinc-400">
                    {area.area_type}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => removeArea(i)}
                  className="text-zinc-600 hover:text-red-400"
                >
                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="flex justify-between pt-4">
        <button
          onClick={prevStep}
          className="rounded-lg border border-zinc-700 px-6 py-3 text-sm font-medium text-zinc-400 transition-colors hover:bg-zinc-800"
        >
          Back
        </button>
        <div className="flex gap-3">
          <button
            onClick={nextStep}
            className="rounded-lg border border-zinc-700 px-6 py-3 text-sm font-medium text-zinc-400 transition-colors hover:bg-zinc-800"
          >
            Skip for now
          </button>
          <button
            onClick={nextStep}
            disabled={areas.length === 0}
            className="rounded-lg bg-emerald-600 px-6 py-3 text-sm font-semibold text-white transition-colors hover:bg-emerald-500 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Continue ({areas.length} areas)
          </button>
        </div>
      </div>
    </div>
  );
}
