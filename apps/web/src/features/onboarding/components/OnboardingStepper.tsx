'use client';

import { useOnboardingStore } from '../store/useOnboardingStore';
import { StepOrganization } from './StepOrganization';
import { StepProject } from './StepProject';
import { StepTradeSequence } from './StepTradeSequence';
import { StepAreas } from './StepAreas';
import { StepTeam } from './StepTeam';

const STEPS = [
  { num: 1, label: 'Organization' },
  { num: 2, label: 'Project' },
  { num: 3, label: 'Trades' },
  { num: 4, label: 'Areas' },
  { num: 5, label: 'Team' },
] as const;

export function OnboardingStepper() {
  const step = useOnboardingStore((s) => s.step);

  return (
    <div className="flex min-h-screen items-center justify-center bg-zinc-950 p-8">
      <div className="w-full max-w-xl">
        {/* Logo */}
        <div className="mb-8 flex items-center justify-center gap-2">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/readyboard-icon-animated.svg" alt="" className="h-8 w-8" />
          <span className="text-lg font-semibold text-zinc-100">ReadyBoard</span>
        </div>

        {/* Step indicator */}
        <div className="mb-8 flex items-center justify-center gap-2">
          {STEPS.map((s, i) => (
            <div key={s.num} className="flex items-center gap-2">
              <div
                className={`flex h-8 w-8 items-center justify-center rounded-full text-xs font-semibold transition-colors ${
                  step === s.num
                    ? 'bg-emerald-600 text-white'
                    : step > s.num
                      ? 'bg-emerald-900/50 text-emerald-400'
                      : 'bg-zinc-800 text-zinc-500'
                }`}
              >
                {step > s.num ? (
                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                  </svg>
                ) : (
                  s.num
                )}
              </div>
              {i < STEPS.length - 1 && (
                <div
                  className={`h-px w-8 transition-colors ${
                    step > s.num ? 'bg-emerald-700' : 'bg-zinc-800'
                  }`}
                />
              )}
            </div>
          ))}
        </div>

        {/* Step labels */}
        <div className="mb-6 flex justify-between px-1">
          {STEPS.map((s) => (
            <span
              key={s.num}
              className={`text-[10px] uppercase tracking-wider ${
                step === s.num ? 'text-emerald-400' : 'text-zinc-600'
              }`}
            >
              {s.label}
            </span>
          ))}
        </div>

        {/* Step content */}
        <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-6">
          {step === 1 && <StepOrganization />}
          {step === 2 && <StepProject />}
          {step === 3 && <StepTradeSequence />}
          {step === 4 && <StepAreas />}
          {step === 5 && <StepTeam />}
        </div>
      </div>
    </div>
  );
}
