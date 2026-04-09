'use client';

import { useState } from 'react';
import { useOnboardingStore } from '../store/useOnboardingStore';

// Trade names in store are already human-readable (match DB exactly)

const DEFAULT_TRADE_NAMES = new Set([
  'Rough Plumbing',
  'Metal Stud Framing',
  'MEP Rough-In',
  'Fire Stopping',
  'Insulation & Drywall',
  'Waterproofing',
  'Tile / Stone',
  'Paint',
  'Ceiling Grid / ACT',
  'MEP Trim-Out',
  'Doors & Hardware',
  'Millwork & Countertops',
  'Flooring',
  'Final Clean & Punch',
]);

export function StepTradeSequence() {
  const { trades, toggleTrade, moveTrade, addCustomTrade, nextStep, prevStep } =
    useOnboardingStore();
  const [customName, setCustomName] = useState('');

  const enabledCount = trades.filter((t) => t.enabled).length;

  function handleAddCustom() {
    const name = customName.trim();
    if (!name) return;
    addCustomTrade(name);
    setCustomName('');
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold text-zinc-100">Trade Sequence</h2>
        <p className="mt-1 text-sm text-zinc-400">
          The 14-trade interior finish sequence. Toggle trades on/off and reorder as needed.
        </p>
      </div>

      <div className="space-y-1.5 max-h-[400px] overflow-y-auto pr-1">
        {trades.map((trade, index) => (
          <div
            key={trade.trade_name}
            className={`flex items-center gap-3 rounded-lg border px-3 py-2.5 transition-colors ${
              trade.enabled
                ? 'border-zinc-700 bg-zinc-800/80'
                : 'border-zinc-800 bg-zinc-900/50 opacity-50'
            }`}
          >
            {/* Order number */}
            <span className="w-6 text-center text-xs font-mono text-zinc-500">
              {trade.enabled ? trade.sequence_order : '—'}
            </span>

            {/* Toggle */}
            <button
              type="button"
              onClick={() => toggleTrade(trade.trade_name)}
              className={`relative h-5 w-9 rounded-full transition-colors ${
                trade.enabled ? 'bg-emerald-600' : 'bg-zinc-700'
              }`}
            >
              <span
                className={`absolute top-0.5 left-0.5 h-4 w-4 rounded-full bg-white transition-transform ${
                  trade.enabled ? 'translate-x-4' : 'translate-x-0'
                }`}
              />
            </button>

            {/* Trade name */}
            <span className="flex-1 text-sm text-zinc-200">
              {trade.trade_name}
              {!DEFAULT_TRADE_NAMES.has(trade.trade_name) && (
                <span className="ml-2 rounded bg-purple-500/20 px-1.5 py-0.5 text-[10px] font-medium text-purple-300">
                  Custom
                </span>
              )}
            </span>

            {/* Reorder buttons */}
            <div className="flex gap-1">
              <button
                type="button"
                disabled={index === 0}
                onClick={() => moveTrade(index, index - 1)}
                className="rounded p-1 text-zinc-500 hover:bg-zinc-700 hover:text-zinc-300 disabled:opacity-30 disabled:hover:bg-transparent"
              >
                <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 15.75l7.5-7.5 7.5 7.5" />
                </svg>
              </button>
              <button
                type="button"
                disabled={index === trades.length - 1}
                onClick={() => moveTrade(index, index + 1)}
                className="rounded p-1 text-zinc-500 hover:bg-zinc-700 hover:text-zinc-300 disabled:opacity-30 disabled:hover:bg-transparent"
              >
                <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
                </svg>
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* Add custom trade */}
      <div className="flex gap-2">
        <input
          type="text"
          value={customName}
          onChange={(e) => setCustomName(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              handleAddCustom();
            }
          }}
          placeholder="Add custom trade (e.g. Glass & Glazing)"
          className="flex-1 rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-zinc-100 outline-none focus:border-amber-500"
        />
        <button
          type="button"
          onClick={handleAddCustom}
          disabled={!customName.trim()}
          className="rounded-lg bg-green-500/20 px-4 py-2 text-sm font-bold text-green-400 disabled:opacity-30"
        >
          + Add
        </button>
      </div>

      <p className="text-xs text-zinc-500">
        {enabledCount} of {trades.length} trades enabled
      </p>

      <div className="flex justify-between pt-4">
        <button
          onClick={prevStep}
          className="rounded-lg border border-zinc-700 px-6 py-3 text-sm font-medium text-zinc-400 transition-colors hover:bg-zinc-800"
        >
          Back
        </button>
        <button
          onClick={nextStep}
          disabled={enabledCount === 0}
          className="rounded-lg bg-emerald-600 px-6 py-3 text-sm font-semibold text-white transition-colors hover:bg-emerald-500 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          Continue
        </button>
      </div>
    </div>
  );
}
