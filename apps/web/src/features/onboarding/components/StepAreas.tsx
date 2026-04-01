'use client';

import { useState, useRef } from 'react';
import Papa from 'papaparse';
import { useOnboardingStore, type AreaEntry } from '../store/useOnboardingStore';

// ─── 25 common area types (toggleable chips) ─────────

const AREA_TYPES = [
  'Bathroom', 'Master Bath', 'Half Bath', 'Powder Room',
  'Kitchen', 'Kitchenette', 'Pantry',
  'Corridor', 'Hallway',
  'Office', 'Conference Room',
  'Lobby', 'Elevator Lobby',
  'Utility', 'Mechanical', 'Electrical',
  'Laundry', 'Storage', 'Closet',
  'Balcony', 'Terrace',
  'Living Room', 'Dining Room', 'Bedroom',
  'Server Room',
] as const;

function normalizeAreaType(type: string): string {
  const lower = type.toLowerCase();
  if (lower.includes('bath') || lower.includes('powder')) return 'bathroom';
  if (lower.includes('kitchen') || lower.includes('pantry')) return 'kitchen';
  if (lower.includes('corridor') || lower.includes('hallway')) return 'corridor';
  if (lower.includes('office') || lower.includes('conference')) return 'office';
  if (lower.includes('lobby')) return 'lobby';
  if (lower.includes('utility') || lower.includes('mechanical') || lower.includes('electrical')) return 'utility';
  return lower.replace(/\s+/g, '_');
}

// ─── Unit presets ────────────────────────────────────

const UNIT_PRESETS: Record<string, { label: string; areas: string[] }> = {
  standard_2br: {
    label: 'Standard 2BR',
    areas: ['Master Bath', 'Half Bath', 'Kitchen', 'Powder Room'],
  },
  studio: {
    label: 'Studio',
    areas: ['Bathroom', 'Kitchen'],
  },
  luxury_3br: {
    label: '3BR Luxury',
    areas: ['Master Bath', 'Half Bath', 'Bathroom', 'Kitchen', 'Powder Room', 'Laundry'],
  },
  office_suite: {
    label: 'Office Suite',
    areas: ['Kitchen', 'Bathroom', 'Server Room'],
  },
  common: {
    label: 'Common Areas',
    areas: ['Corridor', 'Elevator Lobby', 'Utility', 'Storage'],
  },
};

// ─── Component ───────────────────────────────────────

export function StepAreas() {
  const { areas, setAreas, removeArea, nextStep, prevStep } = useOnboardingStore();

  // Quick-Add state
  const [floorFrom, setFloorFrom] = useState('1');
  const [floorTo, setFloorTo] = useState('3');
  const [unitFrom, setUnitFrom] = useState('A');
  const [unitTo, setUnitTo] = useState('D');
  const [selectedPreset, setSelectedPreset] = useState<string>('standard_2br');
  const [selectedTypes, setSelectedTypes] = useState<Set<string>>(new Set(['Bathroom', 'Kitchen']));
  const [customTypes, setCustomTypes] = useState<string[]>([]);
  const [customInput, setCustomInput] = useState('');

  // Single add state
  const [singleName, setSingleName] = useState('');
  const [singleFloor, setSingleFloor] = useState('');
  const [singleType, setSingleType] = useState('Bathroom');

  // CSV state
  const [csvError, setCsvError] = useState<string | null>(null);
  const [csvPreview, setCsvPreview] = useState<AreaEntry[] | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // ─── Type toggle ──────────────────────────────────

  function toggleType(type: string) {
    setSelectedTypes((prev) => {
      const next = new Set(prev);
      next.has(type) ? next.delete(type) : next.add(type);
      return next;
    });
    setSelectedPreset('');
  }

  function applyPreset(presetKey: string) {
    setSelectedPreset(presetKey);
    const preset = UNIT_PRESETS[presetKey];
    if (preset) {
      setSelectedTypes(new Set(preset.areas));
    }
  }

  function addCustomType() {
    const t = customInput.trim();
    if (!t || customTypes.includes(t) || AREA_TYPES.includes(t as typeof AREA_TYPES[number])) return;
    setCustomTypes([...customTypes, t]);
    setSelectedTypes((prev) => new Set([...prev, t]));
    setCustomInput('');
    setSelectedPreset('');
  }

  function removeCustomType(type: string) {
    setCustomTypes(customTypes.filter((t) => t !== type));
    setSelectedTypes((prev) => {
      const next = new Set(prev);
      next.delete(type);
      return next;
    });
  }

  // ─── Generate areas ───────────────────────────────

  function generateAreas() {
    const from = parseInt(floorFrom, 10);
    const to = parseInt(floorTo, 10);
    if (isNaN(from) || isNaN(to) || from > to) return;

    const startChar = unitFrom.toUpperCase().charCodeAt(0);
    const endChar = unitTo.toUpperCase().charCodeAt(0);
    if (startChar > endChar || startChar < 65 || endChar > 90) return;

    const allTypes = Array.from(selectedTypes);
    if (allTypes.length === 0) return;

    const generated: AreaEntry[] = [];

    for (let floor = from; floor <= to; floor++) {
      for (let c = startChar; c <= endChar; c++) {
        const unitLetter = String.fromCharCode(c);
        const unitName = `${floor}${unitLetter}`;

        for (const type of allTypes) {
          generated.push({
            name: `${unitName} ${type}`,
            floor: String(floor),
            area_type: normalizeAreaType(type),
            unit_name: unitLetter,
          });
        }
      }
    }

    // Deduplicate against existing
    const existingKeys = new Set(areas.map((a) => `${a.name}-${a.floor}`));
    const newAreas = generated.filter((a) => !existingKeys.has(`${a.name}-${a.floor}`));
    setAreas([...areas, ...newAreas]);
  }

  // ─── Single add ───────────────────────────────────

  function addSingle() {
    if (!singleName.trim() || !singleFloor.trim()) return;
    const key = `${singleName.trim()}-${singleFloor.trim()}`;
    if (areas.some((a) => `${a.name}-${a.floor}` === key)) return;
    setAreas([
      ...areas,
      {
        name: singleName.trim(),
        floor: singleFloor.trim(),
        area_type: normalizeAreaType(singleType),
      },
    ]);
    setSingleName('');
    setSingleFloor('');
  }

  // ─── CSV import ───────────────────────────────────

  function handleCSVUpload(file: File) {
    setCsvError(null);
    setCsvPreview(null);

    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: (result) => {
        if (result.errors.length > 0) {
          setCsvError(`Parse error: ${result.errors[0].message} (row ${result.errors[0].row})`);
          return;
        }

        const rows = result.data as Record<string, string>[];
        if (rows.length === 0) {
          setCsvError('CSV is empty');
          return;
        }

        // Normalize column names
        const first = rows[0];
        const cols = Object.keys(first).map((k) => k.trim().toLowerCase());
        if (!cols.includes('floor') || !cols.includes('type')) {
          setCsvError(`Missing required columns. Found: ${cols.join(', ')}. Need: floor, type`);
          return;
        }

        const parsed: AreaEntry[] = rows.map((row) => {
          // Normalize keys
          const norm: Record<string, string> = {};
          for (const [k, v] of Object.entries(row)) {
            norm[k.trim().toLowerCase()] = (v ?? '').trim();
          }

          const floor = norm['floor'] ?? '';
          const unit = norm['unit'] ?? '';
          const type = norm['type'] ?? '';
          const code = norm['code'] || undefined;
          const desc = norm['description'] || undefined;
          const unitName = unit || undefined;
          const areaName = unit ? `${floor}${unit} ${type}` : `${floor} ${type}`;

          return {
            name: areaName,
            floor,
            area_type: normalizeAreaType(type),
            unit_name: unitName,
            area_code: code,
            description: desc,
          };
        }).filter((a) => a.floor && a.area_type);

        if (parsed.length === 0) {
          setCsvError('No valid rows found after parsing');
          return;
        }

        setCsvPreview(parsed);
      },
      error: (err) => {
        setCsvError(`Failed to read file: ${err.message}`);
      },
    });
  }

  function confirmCSVImport() {
    if (!csvPreview) return;
    const existingKeys = new Set(areas.map((a) => `${a.name}-${a.floor}`));
    const newAreas = csvPreview.filter((a) => !existingKeys.has(`${a.name}-${a.floor}`));
    setAreas([...areas, ...newAreas]);
    setCsvPreview(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  }

  function downloadTemplate() {
    const csv = `floor,unit,type,code,description
2,A,Bathroom,B.2A.1,Master Bath - Marble double vanity
2,A,Kitchen,K.2A.1,Full Kitchen - Gas range
2,A,Corridor,,Main hallway
2,B,Bathroom,,Studio Bath
2,B,Kitchen,K.2B.1,Kitchenette
3,A,Bathroom,,,
3,A,Office,,,Corner office`;
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'readyboard-areas-template.csv';
    a.click();
    URL.revokeObjectURL(url);
  }

  // ─── Render ───────────────────────────────────────

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold text-zinc-100">Floors & Areas</h2>
        <p className="mt-1 text-sm text-zinc-400">
          Quick-add generates areas by floor range and unit letters. Or import from CSV.
        </p>
      </div>

      {/* ── Quick-Add ── */}
      <div className="rounded-lg border border-zinc-700 bg-zinc-800/50 p-4 space-y-4">
        <p className="text-xs font-medium uppercase tracking-wider text-zinc-500">Quick Add</p>

        {/* Floor & Unit range */}
        <div className="grid grid-cols-4 gap-3 items-end">
          <div>
            <label className="block text-xs text-zinc-400 mb-1">Floor From</label>
            <input type="number" min={1} value={floorFrom} onChange={(e) => setFloorFrom(e.target.value)}
              className="block w-full rounded border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-zinc-100 focus:border-emerald-500 focus:outline-none" />
          </div>
          <div>
            <label className="block text-xs text-zinc-400 mb-1">Floor To</label>
            <input type="number" min={1} value={floorTo} onChange={(e) => setFloorTo(e.target.value)}
              className="block w-full rounded border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-zinc-100 focus:border-emerald-500 focus:outline-none" />
          </div>
          <div>
            <label className="block text-xs text-zinc-400 mb-1">Unit From</label>
            <input type="text" maxLength={1} value={unitFrom} onChange={(e) => setUnitFrom(e.target.value.toUpperCase())}
              className="block w-full rounded border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-zinc-100 uppercase focus:border-emerald-500 focus:outline-none" />
          </div>
          <div>
            <label className="block text-xs text-zinc-400 mb-1">Unit To</label>
            <input type="text" maxLength={1} value={unitTo} onChange={(e) => setUnitTo(e.target.value.toUpperCase())}
              className="block w-full rounded border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-zinc-100 uppercase focus:border-emerald-500 focus:outline-none" />
          </div>
        </div>

        {/* Presets */}
        <div>
          <label className="block text-xs text-zinc-400 mb-1.5">Preset</label>
          <div className="flex flex-wrap gap-1.5">
            {Object.entries(UNIT_PRESETS).map(([key, preset]) => (
              <button key={key} type="button" onClick={() => applyPreset(key)}
                className={`rounded-md border px-2.5 py-1 text-xs font-medium transition-colors ${
                  selectedPreset === key
                    ? 'border-emerald-600 bg-emerald-950/40 text-emerald-400'
                    : 'border-zinc-700 bg-zinc-800 text-zinc-400 hover:border-zinc-600'
                }`}>
                {preset.label}
              </button>
            ))}
            <button type="button" onClick={() => setSelectedPreset('')}
              className={`rounded-md border px-2.5 py-1 text-xs font-medium transition-colors ${
                !selectedPreset
                  ? 'border-emerald-600 bg-emerald-950/40 text-emerald-400'
                  : 'border-zinc-700 bg-zinc-800 text-zinc-400 hover:border-zinc-600'
              }`}>
              Custom
            </button>
          </div>
        </div>

        {/* Area type chips (25 toggleable) */}
        <div>
          <label className="block text-xs text-zinc-400 mb-1.5">Area Types</label>
          <div className="flex flex-wrap gap-1.5">
            {AREA_TYPES.map((type) => (
              <button key={type} type="button" onClick={() => toggleType(type)}
                className={`rounded-full border px-2.5 py-1 text-xs font-medium transition-colors ${
                  selectedTypes.has(type)
                    ? 'border-emerald-600 bg-emerald-950/40 text-emerald-400'
                    : 'border-zinc-700 bg-zinc-800 text-zinc-500 hover:border-zinc-600'
                }`}>
                {type}
              </button>
            ))}
          </div>
        </div>

        {/* Custom type input */}
        <div className="flex gap-2">
          <input type="text" value={customInput} onChange={(e) => setCustomInput(e.target.value)}
            placeholder="Custom area type (e.g., Walk-in Closet)"
            onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addCustomType())}
            className="flex-1 rounded border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-zinc-100 placeholder-zinc-600 focus:border-emerald-500 focus:outline-none" />
          <button type="button" onClick={addCustomType} disabled={!customInput.trim()}
            className="rounded border border-zinc-600 px-3 py-2 text-sm text-zinc-400 hover:bg-zinc-700 disabled:opacity-40">
            + Add
          </button>
        </div>
        {customTypes.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {customTypes.map((type) => (
              <span key={type} className="flex items-center gap-1 rounded-full border border-amber-600 bg-amber-950/30 px-2.5 py-1 text-xs text-amber-400">
                {type}
                <button type="button" onClick={() => removeCustomType(type)} className="ml-0.5 text-amber-500 hover:text-amber-300">
                  &times;
                </button>
              </span>
            ))}
          </div>
        )}

        <button type="button" onClick={generateAreas} disabled={selectedTypes.size === 0}
          className="rounded-lg border border-emerald-700 bg-emerald-950/30 px-4 py-2 text-sm font-medium text-emerald-400 transition-colors hover:bg-emerald-950/50 disabled:opacity-40">
          Generate Areas
        </button>
      </div>

      {/* ── CSV Import ── */}
      <div className="rounded-lg border border-dashed border-zinc-700 bg-zinc-800/30 p-4 space-y-3">
        <p className="text-xs font-medium uppercase tracking-wider text-zinc-500">Import from CSV</p>
        <div className="flex items-center gap-3">
          <input ref={fileInputRef} type="file" accept=".csv" className="hidden" id="csv-import"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) handleCSVUpload(file);
            }} />
          <label htmlFor="csv-import"
            className="cursor-pointer rounded border border-zinc-600 px-4 py-2 text-sm text-zinc-300 hover:bg-zinc-700 transition-colors">
            Upload CSV
          </label>
          <button type="button" onClick={downloadTemplate} className="text-xs text-emerald-500 hover:text-emerald-400">
            Download template
          </button>
          <span className="text-[10px] text-zinc-600">Columns: floor, unit, type, code?, description?</span>
        </div>

        {csvError && (
          <p className="rounded bg-red-950/30 border border-red-900/50 px-3 py-2 text-xs text-red-400">{csvError}</p>
        )}

        {csvPreview && (
          <div className="space-y-2">
            <p className="text-xs text-zinc-300">{csvPreview.length} areas parsed</p>
            <div className="max-h-[120px] overflow-y-auto space-y-0.5">
              {csvPreview.slice(0, 8).map((a, i) => (
                <div key={i} className="flex items-center gap-2 text-xs text-zinc-400">
                  <span className="font-mono text-zinc-600">{a.area_code ?? '—'}</span>
                  <span>{a.name}</span>
                  <span className="text-zinc-600">Floor {a.floor}</span>
                </div>
              ))}
              {csvPreview.length > 8 && <p className="text-[10px] text-zinc-600">...and {csvPreview.length - 8} more</p>}
            </div>
            <div className="flex gap-2">
              <button type="button" onClick={confirmCSVImport}
                className="rounded bg-emerald-600 px-4 py-1.5 text-xs font-medium text-white hover:bg-emerald-500">
                Import {csvPreview.length} areas
              </button>
              <button type="button" onClick={() => { setCsvPreview(null); if (fileInputRef.current) fileInputRef.current.value = ''; }}
                className="rounded border border-zinc-700 px-4 py-1.5 text-xs text-zinc-400 hover:bg-zinc-800">
                Cancel
              </button>
            </div>
          </div>
        )}
      </div>

      {/* ── Single Add ── */}
      <div className="rounded-lg border border-zinc-700 bg-zinc-800/50 p-4 space-y-3">
        <p className="text-xs font-medium uppercase tracking-wider text-zinc-500">Add Single</p>
        <div className="grid grid-cols-4 gap-3 items-end">
          <div>
            <label className="block text-xs text-zinc-400 mb-1">Name</label>
            <input type="text" value={singleName} onChange={(e) => setSingleName(e.target.value)} placeholder="Lobby A"
              className="block w-full rounded border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-zinc-100 placeholder-zinc-500 focus:border-emerald-500 focus:outline-none" />
          </div>
          <div>
            <label className="block text-xs text-zinc-400 mb-1">Floor</label>
            <input type="text" value={singleFloor} onChange={(e) => setSingleFloor(e.target.value)} placeholder="1"
              className="block w-full rounded border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-zinc-100 placeholder-zinc-500 focus:border-emerald-500 focus:outline-none" />
          </div>
          <div>
            <label className="block text-xs text-zinc-400 mb-1">Type</label>
            <select value={singleType} onChange={(e) => setSingleType(e.target.value)}
              className="block w-full rounded border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-zinc-100 focus:border-emerald-500 focus:outline-none">
              {AREA_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>
          <button type="button" onClick={addSingle} disabled={!singleName.trim() || !singleFloor.trim()}
            className="rounded-lg border border-zinc-600 px-4 py-2 text-sm font-medium text-zinc-300 transition-colors hover:bg-zinc-700 disabled:opacity-40">
            Add
          </button>
        </div>
      </div>

      {/* ── Area list ── */}
      {areas.length > 0 && (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <p className="text-xs font-medium uppercase tracking-wider text-zinc-500">
              {areas.length} area{areas.length !== 1 ? 's' : ''}
            </p>
            <button type="button" onClick={() => setAreas([])} className="text-xs text-red-400 hover:text-red-300">
              Clear all
            </button>
          </div>
          <div className="max-h-[200px] overflow-y-auto space-y-1 pr-1">
            {areas.map((area, i) => (
              <div key={`${area.name}-${area.floor}-${i}`}
                className="flex items-center justify-between rounded border border-zinc-800 bg-zinc-900 px-3 py-2">
                <div className="flex items-center gap-3">
                  {area.area_code && (
                    <span className="font-mono text-[10px] text-zinc-500">{area.area_code}</span>
                  )}
                  <span className="text-sm text-zinc-200">{area.name}</span>
                  <span className="text-xs text-zinc-500">Floor {area.floor}</span>
                  <span className="rounded bg-zinc-800 px-1.5 py-0.5 text-[10px] uppercase text-zinc-400">
                    {area.area_type}
                  </span>
                </div>
                <button type="button" onClick={() => removeArea(i)} className="text-zinc-600 hover:text-red-400">
                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Navigation ── */}
      <div className="flex justify-between pt-4">
        <button onClick={prevStep}
          className="rounded-lg border border-zinc-700 px-6 py-3 text-sm font-medium text-zinc-400 transition-colors hover:bg-zinc-800">
          Back
        </button>
        <div className="flex gap-3">
          <button onClick={nextStep}
            className="rounded-lg border border-zinc-700 px-6 py-3 text-sm font-medium text-zinc-400 transition-colors hover:bg-zinc-800">
            Skip for now
          </button>
          <button onClick={nextStep} disabled={areas.length === 0}
            className="rounded-lg bg-emerald-600 px-6 py-3 text-sm font-semibold text-white transition-colors hover:bg-emerald-500 disabled:opacity-50 disabled:cursor-not-allowed">
            Continue ({areas.length} areas)
          </button>
        </div>
      </div>
    </div>
  );
}
