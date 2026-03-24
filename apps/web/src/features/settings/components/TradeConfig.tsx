'use client';

import { useState, useEffect, useCallback } from 'react';
import { toast } from 'sonner';
import { fetchTradeConfigs, type TradeConfigItem } from '../services/fetchTradeConfigs';
import { updateTradeMode } from '../services/updateTradeMode';

type Props = {
  projectId: string;
};

/**
 * TradeConfig — GC PM configures reporting mode per trade.
 *
 * Each trade can be in 'percentage' (slider) or 'checklist' (task-by-task) mode.
 * Lock logic: switching to percentage is blocked when active tasks exist.
 * Historical data is never deleted — completed tasks remain read-only.
 */
export function TradeConfig({ projectId }: Props) {
  const [configs, setConfigs] = useState<TradeConfigItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [switchingTrade, setSwitchingTrade] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setIsLoading(true);
    const data = await fetchTradeConfigs(projectId);
    setConfigs(data);
    setIsLoading(false);
  }, [projectId]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  async function handleModeSwitch(tradeType: string, currentMode: string) {
    const newMode = currentMode === 'percentage' ? 'checklist' : 'percentage';
    setSwitchingTrade(tradeType);

    const result = await updateTradeMode(projectId, tradeType, newMode as 'percentage' | 'checklist');

    if (result.ok) {
      toast.success(
        `${tradeType} → ${newMode === 'checklist' ? 'Checklist' : 'Percentage'} mode (${result.areasUpdated} areas updated)`,
      );
      await refresh();
    } else {
      toast.error(result.error);
    }

    setSwitchingTrade(null);
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-16">
        <p className="text-sm text-zinc-500">Loading trade configurations...</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div>
        <h2 className="text-lg font-semibold text-zinc-100">Trade Configuration</h2>
        <p className="mt-1 text-xs text-zinc-500">
          Set reporting mode per trade. Checklist mode requires task-by-task verification.
          Percentage mode uses a simple 0-100% slider.
        </p>
      </div>

      {/* Trade list */}
      <div className="divide-y divide-zinc-800 rounded-lg border border-zinc-800">
        {configs.map((config) => {
          const isChecklist = config.reportingMode === 'checklist';
          const isSwitching = switchingTrade === config.tradeType;
          const hasActiveTasks = config.activeTaskCount > 0;
          // Block switching to percentage when active tasks exist
          const isLocked = isChecklist && hasActiveTasks;

          return (
            <div
              key={config.tradeType}
              className="flex items-center justify-between gap-4 px-4 py-3"
            >
              {/* Trade info */}
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-zinc-200">
                    {config.sequenceOrder}. {config.tradeType}
                  </span>
                  {/* Mode badge */}
                  <span
                    className={`rounded px-1.5 py-0.5 text-[10px] font-medium ${
                      isChecklist
                        ? 'bg-blue-900/40 text-blue-300'
                        : 'bg-zinc-800 text-zinc-400'
                    }`}
                  >
                    {isChecklist ? 'CHECKLIST' : 'PERCENTAGE'}
                  </span>
                </div>

                {/* Stats */}
                <div className="mt-0.5 flex gap-3 text-[11px] text-zinc-500">
                  {config.completedTaskCount > 0 && (
                    <span className="text-green-500">
                      {config.completedTaskCount} completed
                    </span>
                  )}
                  {config.activeTaskCount > 0 && (
                    <span className="text-amber-400">
                      {config.activeTaskCount} active
                    </span>
                  )}
                </div>
              </div>

              {/* Toggle button */}
              <div className="flex items-center gap-2">
                {isLocked && (
                  <span
                    className="text-[10px] text-orange-400"
                    title="Cannot switch to percentage mode with active tasks"
                  >
                    locked
                  </span>
                )}
                <button
                  onClick={() => handleModeSwitch(config.tradeType, config.reportingMode)}
                  disabled={isSwitching || isLocked}
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                    isChecklist
                      ? 'bg-blue-600'
                      : 'bg-zinc-700'
                  } ${isSwitching || isLocked ? 'cursor-not-allowed opacity-40' : 'cursor-pointer'}`}
                  title={
                    isLocked
                      ? `Cannot switch: ${config.activeTaskCount} active task(s). Complete or resolve them first.`
                      : isChecklist
                        ? 'Switch to Percentage mode'
                        : 'Switch to Checklist mode'
                  }
                >
                  <span
                    className={`inline-block h-4 w-4 rounded-full bg-white transition-transform ${
                      isChecklist ? 'translate-x-6' : 'translate-x-1'
                    }`}
                  />
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {/* Legend */}
      <div className="flex gap-4 text-[11px] text-zinc-600">
        <span>
          <span className="mr-1 inline-block h-2 w-2 rounded-full bg-blue-600" />
          Checklist — task-by-task verification
        </span>
        <span>
          <span className="mr-1 inline-block h-2 w-2 rounded-full bg-zinc-700" />
          Percentage — slider mode
        </span>
      </div>
    </div>
  );
}
