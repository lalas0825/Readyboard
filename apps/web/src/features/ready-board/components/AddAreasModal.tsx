'use client';

import { useState, useRef } from 'react';
import Papa from 'papaparse';
import { addAreasToProject } from '../services/addAreasToProject';

// ─── Area types ─────────────────────────────────────

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

const UNIT_PRESETS: Record<string, { label: string; areas: string[] }> = {
  standard_2br: { label: 'Standard 2BR', areas: ['Master Bath', 'Half Bath', 'Kitchen', 'Powder Room'] },
  studio: { label: 'Studio', areas: ['Bathroom', 'Kitchen'] },
  luxury_3br: { label: '3BR Luxury', areas: ['Master Bath', 'Half Bath', 'Bathroom', 'Kitchen', 'Powder Room', 'Laundry'] },
  office_suite: { label: 'Office Suite', areas: ['Kitchen', 'Bathroom', 'Server Room'] },
  common: { label: 'Common Areas', areas: ['Corridor', 'Elevator Lobby', 'Utility', 'Storage'] },
};

const FLOOR_PRESETS: Record<string, { label: string; areas: string[] }> = {
  lobby: { label: 'Lobby', areas: ['Main Lobby', 'Mailroom', 'Package Room', 'Restroom M', 'Restroom F', 'Security Desk'] },
  amenity: { label: 'Amenity', areas: ['Gym', 'Pool Deck', 'Locker Room M', 'Locker Room F', 'Sauna', 'Kids Room'] },
  mechanical: { label: 'Mechanical', areas: ['Mechanical Room', 'Electrical Room', 'Boiler Room', 'Fire Pump Room'] },
  parking: { label: 'Parking', areas: ['Parking Level', 'Storage Units', 'Bike Room', 'Trash Room', 'Loading Dock'] },
};

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

type AreaToAdd = {
  name: string;
  floor: string;
  area_type: string;
  unit_name?: string;
  area_code?: string;
};

type Props = {
  projectId: string;
  onClose: () => void;
  onSuccess: () => void;
};

export function AddAreasModal({ projectId, onClose, onSuccess }: Props) {
  const [addMode, setAddMode] = useState<'unit' | 'floor' | 'csv'>('unit');
  const [floorFrom, setFloorFrom] = useState('');
  const [floorTo, setFloorTo] = useState('');
  const [unitFrom, setUnitFrom] = useState('A');
  const [unitTo, setUnitTo] = useState('D');
  const [selectedTypes, setSelectedTypes] = useState<Set<string>>(new Set());
  const [selectedPreset, setSelectedPreset] = useState('');
  const [typeCodes, setTypeCodes] = useState<Record<string, string>>({});
  const [preview, setPreview] = useState<AreaToAdd[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [csvError, setCsvError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  function toggleType(type: string) {
    setSelectedTypes((prev) => {
      const next = new Set(prev);
      next.has(type) ? next.delete(type) : next.add(type);
      return next;
    });
    setSelectedPreset('');
  }

  function applyPreset(key: string, presets: Record<string, { label: string; areas: string[] }>) {
    setSelectedPreset(key);
    if (presets[key]) setSelectedTypes(new Set(presets[key].areas));
  }

  function generatePreview() {
    const from = parseInt(floorFrom, 10);
    const to = parseInt(floorTo, 10);
    if (isNaN(from) || isNaN(to) || from > to) return;
    const types = Array.from(selectedTypes);
    if (types.length === 0) return;

    const generated: AreaToAdd[] = [];

    if (addMode === 'unit') {
      const startChar = unitFrom.toUpperCase().charCodeAt(0);
      const endChar = unitTo.toUpperCase().charCodeAt(0);
      if (startChar > endChar || startChar < 65 || endChar > 90) return;

      for (let floor = from; floor <= to; floor++) {
        for (let c = startChar; c <= endChar; c++) {
          const unitLetter = String.fromCharCode(c);
          for (const type of types) {
            generated.push({
              name: `${floor}${unitLetter} ${type}`,
              floor: String(floor),
              area_type: normalizeAreaType(type),
              unit_name: unitLetter,
              area_code: typeCodes[type] || undefined,
            });
          }
        }
      }
    } else {
      for (let floor = from; floor <= to; floor++) {
        for (const type of types) {
          generated.push({
            name: type,
            floor: String(floor),
            area_type: normalizeAreaType(type),
            area_code: typeCodes[type] || undefined,
          });
        }
      }
    }

    setPreview(generated);
  }

  function handleCSV(file: File) {
    setCsvError(null);
    Papa.parse(file, {
      header: true, skipEmptyLines: true,
      complete: (result) => {
        if (result.errors.length > 0) { setCsvError(result.errors[0].message); return; }
        const rows = result.data as Record<string, string>[];
        const cols = Object.keys(rows[0] || {}).map((k) => k.trim().toLowerCase());
        if (!cols.includes('floor') || !cols.includes('type')) { setCsvError('Missing columns: floor, type'); return; }

        const parsed: AreaToAdd[] = rows.map((row) => {
          const norm: Record<string, string> = {};
          for (const [k, v] of Object.entries(row)) norm[k.trim().toLowerCase()] = (v ?? '').trim();
          const unit = norm['unit'] || '';
          const type = norm['type'] || '';
          return {
            name: unit ? `${norm['floor']}${unit} ${type}` : type,
            floor: norm['floor'],
            area_type: normalizeAreaType(type),
            unit_name: unit || undefined,
            area_code: norm['code'] || undefined,
          };
        }).filter((a) => a.floor && a.area_type);

        setPreview(parsed);
      },
    });
  }

  async function handleSubmit() {
    if (preview.length === 0) return;
    setIsSubmitting(true);
    setError(null);
    const result = await addAreasToProject(projectId, preview);
    setIsSubmitting(false);
    if (!result.ok) { setError(result.error); return; }
    onSuccess();
    onClose();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
      <div className="w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-xl border border-zinc-700 bg-zinc-900 p-6 shadow-2xl">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-zinc-100">Add Areas</h2>
          <button onClick={onClose} className="text-zinc-500 hover:text-zinc-300 text-xl">&times;</button>
        </div>

        {/* Mode tabs */}
        <div className="flex gap-2 mb-4">
          {(['unit', 'floor', 'csv'] as const).map((m) => (
            <button key={m} onClick={() => { setAddMode(m); setPreview([]); }}
              className={`rounded-md border px-3 py-1.5 text-xs font-medium transition-colors ${
                addMode === m ? 'border-emerald-600 bg-emerald-950/40 text-emerald-400' : 'border-zinc-700 text-zinc-400 hover:border-zinc-600'
              }`}>
              {m === 'unit' ? 'Units + Areas' : m === 'floor' ? 'Floor Areas' : 'CSV Import'}
            </button>
          ))}
        </div>

        {addMode !== 'csv' && (
          <div className="space-y-3">
            {/* Floor range */}
            <div className={`grid ${addMode === 'unit' ? 'grid-cols-4' : 'grid-cols-2'} gap-3`}>
              <div>
                <label className="block text-xs text-zinc-400 mb-1">Floor From</label>
                <input type="number" min={1} value={floorFrom} onChange={(e) => setFloorFrom(e.target.value)}
                  className="block w-full rounded border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-zinc-100 focus:border-emerald-500 focus:outline-none" />
              </div>
              <div>
                <label className="block text-xs text-zinc-400 mb-1">Floor To</label>
                <input type="number" min={1} value={floorTo} onChange={(e) => setFloorTo(e.target.value)}
                  className="block w-full rounded border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-zinc-100 focus:border-emerald-500 focus:outline-none" />
              </div>
              {addMode === 'unit' && (
                <>
                  <div>
                    <label className="block text-xs text-zinc-400 mb-1">Unit From</label>
                    <input type="text" maxLength={1} value={unitFrom} onChange={(e) => setUnitFrom(e.target.value.toUpperCase())}
                      className="block w-full rounded border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-zinc-100 uppercase focus:border-emerald-500 focus:outline-none" />
                  </div>
                  <div>
                    <label className="block text-xs text-zinc-400 mb-1">Unit To</label>
                    <input type="text" maxLength={1} value={unitTo} onChange={(e) => setUnitTo(e.target.value.toUpperCase())}
                      className="block w-full rounded border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-zinc-100 uppercase focus:border-emerald-500 focus:outline-none" />
                  </div>
                </>
              )}
            </div>

            {/* Presets */}
            <div className="flex flex-wrap gap-1.5">
              {Object.entries(addMode === 'unit' ? UNIT_PRESETS : FLOOR_PRESETS).map(([key, p]) => (
                <button key={key} type="button"
                  onClick={() => applyPreset(key, addMode === 'unit' ? UNIT_PRESETS : FLOOR_PRESETS)}
                  className={`rounded-md border px-2 py-1 text-xs ${
                    selectedPreset === key ? 'border-emerald-600 bg-emerald-950/40 text-emerald-400' : 'border-zinc-700 text-zinc-500 hover:border-zinc-600'
                  }`}>
                  {p.label}
                </button>
              ))}
            </div>

            {/* Type chips */}
            <div className="flex flex-wrap gap-1">
              {AREA_TYPES.map((t) => (
                <button key={t} type="button" onClick={() => toggleType(t)}
                  className={`rounded-full border px-2 py-0.5 text-[11px] ${
                    selectedTypes.has(t) ? 'border-emerald-600 bg-emerald-950/40 text-emerald-400' : 'border-zinc-700 text-zinc-600'
                  }`}>
                  {t}
                </button>
              ))}
            </div>

            {/* Per-type area codes */}
            {selectedTypes.size > 0 && (
              <div className="space-y-1">
                <label className="block text-[10px] text-zinc-500 uppercase">Area codes (optional)</label>
                {Array.from(selectedTypes).map((type) => (
                  <div key={type} className="flex items-center gap-2">
                    <span className="w-28 text-xs text-zinc-400 truncate">{type}</span>
                    <input type="text" value={typeCodes[type] ?? ''} placeholder="e.g., B-1.0.1"
                      onChange={(e) => setTypeCodes((p) => ({ ...p, [type]: e.target.value }))}
                      className="flex-1 rounded border border-zinc-700 bg-zinc-800 px-2 py-1 text-xs font-mono text-zinc-100 placeholder-zinc-600 focus:border-emerald-500 focus:outline-none" />
                  </div>
                ))}
              </div>
            )}

            <button type="button" onClick={generatePreview} disabled={selectedTypes.size === 0 || !floorFrom || !floorTo}
              className="rounded border border-emerald-700 bg-emerald-950/30 px-4 py-1.5 text-sm text-emerald-400 hover:bg-emerald-950/50 disabled:opacity-40">
              Preview
            </button>
          </div>
        )}

        {/* CSV mode */}
        {addMode === 'csv' && (
          <div className="space-y-3">
            <input ref={fileInputRef} type="file" accept=".csv"
              onChange={(e) => { const f = e.target.files?.[0]; if (f) handleCSV(f); }}
              className="block w-full text-sm text-zinc-400 file:mr-3 file:rounded file:border-0 file:bg-zinc-800 file:px-3 file:py-1.5 file:text-xs file:text-zinc-300" />
            <p className="text-[10px] text-zinc-600">Columns: floor, unit (optional), type, code (optional), description (optional)</p>
            {csvError && <p className="text-xs text-red-400">{csvError}</p>}
          </div>
        )}

        {/* Preview */}
        {preview.length > 0 && (
          <div className="mt-4 space-y-2">
            <p className="text-xs text-zinc-300">{preview.length} areas to add</p>
            <div className="max-h-[200px] overflow-y-auto space-y-0.5 rounded border border-zinc-800 bg-zinc-950 p-2">
              {preview.slice(0, 10).map((a, i) => (
                <div key={i} className="flex items-center gap-2 text-xs text-zinc-400">
                  {a.area_code && <span className="font-mono text-zinc-500">{a.area_code}</span>}
                  <span>{a.name}</span>
                  <span className="text-zinc-600">F{a.floor}</span>
                  {a.unit_name && <span className="text-zinc-600">U{a.unit_name}</span>}
                </div>
              ))}
              {preview.length > 10 && <p className="text-[10px] text-zinc-600">...and {preview.length - 10} more</p>}
            </div>
          </div>
        )}

        {error && <p className="mt-2 text-xs text-red-400">{error}</p>}

        {/* Actions */}
        <div className="flex justify-end gap-3 mt-6 pt-4 border-t border-zinc-800">
          <button onClick={onClose} className="rounded border border-zinc-700 px-4 py-2 text-sm text-zinc-400 hover:bg-zinc-800">
            Cancel
          </button>
          <button onClick={handleSubmit} disabled={preview.length === 0 || isSubmitting}
            className="rounded bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-500 disabled:opacity-50">
            {isSubmitting ? 'Adding...' : `Add ${preview.length} Areas`}
          </button>
        </div>
      </div>
    </div>
  );
}
