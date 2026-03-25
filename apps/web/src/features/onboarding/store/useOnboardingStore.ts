'use client';

import { create } from 'zustand';

// ─── Types ─────────────────────────────────────────

export type OnboardingStep = 1 | 2 | 3 | 4 | 5;

export type TradeEntry = {
  trade_name: string;
  sequence_order: number;
  enabled: boolean;
};

export type AreaEntry = {
  name: string;
  floor: string;
  area_type: 'bathroom' | 'kitchen' | 'corridor' | 'office' | 'lobby' | 'utility';
};

export type InviteEntry = {
  email?: string;
  phone?: string;
  role: 'gc_pm' | 'gc_super' | 'foreman';
};

// Step data
export type OrgData = {
  name: string;
  language: 'en' | 'es';
};

export type ProjectData = {
  name: string;
  address: string;
  laborRate: number;
  jurisdiction: string;
};

// ─── Store ─────────────────────────────────────────

type OnboardingState = {
  step: OnboardingStep;
  org: OrgData;
  project: ProjectData;
  trades: TradeEntry[];
  areas: AreaEntry[];
  invites: InviteEntry[];
  isSubmitting: boolean;
};

type OnboardingActions = {
  setStep: (step: OnboardingStep) => void;
  nextStep: () => void;
  prevStep: () => void;
  setOrg: (data: Partial<OrgData>) => void;
  setProject: (data: Partial<ProjectData>) => void;
  setTrades: (trades: TradeEntry[]) => void;
  toggleTrade: (tradeName: string) => void;
  moveTrade: (from: number, to: number) => void;
  setAreas: (areas: AreaEntry[]) => void;
  addArea: (area: AreaEntry) => void;
  removeArea: (index: number) => void;
  setInvites: (invites: InviteEntry[]) => void;
  addInvite: (invite: InviteEntry) => void;
  removeInvite: (index: number) => void;
  setIsSubmitting: (v: boolean) => void;
  reset: () => void;
};

const DEFAULT_TRADES: TradeEntry[] = [
  { trade_name: 'rough_plumbing', sequence_order: 1, enabled: true },
  { trade_name: 'metal_stud_framing', sequence_order: 2, enabled: true },
  { trade_name: 'mep_rough_in', sequence_order: 3, enabled: true },
  { trade_name: 'fire_stopping', sequence_order: 4, enabled: true },
  { trade_name: 'insulation_drywall', sequence_order: 5, enabled: true },
  { trade_name: 'waterproofing', sequence_order: 6, enabled: true },
  { trade_name: 'tile_stone', sequence_order: 7, enabled: true },
  { trade_name: 'paint', sequence_order: 8, enabled: true },
  { trade_name: 'ceiling_grid_act', sequence_order: 9, enabled: true },
  { trade_name: 'mep_trim_out', sequence_order: 10, enabled: true },
  { trade_name: 'doors_hardware', sequence_order: 11, enabled: true },
  { trade_name: 'millwork_countertops', sequence_order: 12, enabled: true },
  { trade_name: 'flooring', sequence_order: 13, enabled: true },
  { trade_name: 'final_clean_punch', sequence_order: 14, enabled: true },
];

const INITIAL_STATE: OnboardingState = {
  step: 1,
  org: { name: '', language: 'en' },
  project: { name: '', address: '', laborRate: 85, jurisdiction: 'NY' },
  trades: DEFAULT_TRADES,
  areas: [],
  invites: [],
  isSubmitting: false,
};

export const useOnboardingStore = create<OnboardingState & OnboardingActions>(
  (set, get) => ({
    ...INITIAL_STATE,

    setStep: (step) => set({ step }),
    nextStep: () => {
      const s = get().step;
      if (s < 5) set({ step: (s + 1) as OnboardingStep });
    },
    prevStep: () => {
      const s = get().step;
      if (s > 1) set({ step: (s - 1) as OnboardingStep });
    },

    setOrg: (data) => set((s) => ({ org: { ...s.org, ...data } })),
    setProject: (data) => set((s) => ({ project: { ...s.project, ...data } })),

    setTrades: (trades) => set({ trades }),
    toggleTrade: (tradeName) =>
      set((s) => ({
        trades: s.trades.map((t) =>
          t.trade_name === tradeName ? { ...t, enabled: !t.enabled } : t
        ),
      })),
    moveTrade: (from, to) =>
      set((s) => {
        const trades = [...s.trades];
        const [moved] = trades.splice(from, 1);
        trades.splice(to, 0, moved);
        return {
          trades: trades.map((t, i) => ({ ...t, sequence_order: i + 1 })),
        };
      }),

    setAreas: (areas) => set({ areas }),
    addArea: (area) => set((s) => ({ areas: [...s.areas, area] })),
    removeArea: (index) =>
      set((s) => ({ areas: s.areas.filter((_, i) => i !== index) })),

    setInvites: (invites) => set({ invites }),
    addInvite: (invite) =>
      set((s) => ({ invites: [...s.invites, invite] })),
    removeInvite: (index) =>
      set((s) => ({ invites: s.invites.filter((_, i) => i !== index) })),

    setIsSubmitting: (v) => set({ isSubmitting: v }),
    reset: () => set(INITIAL_STATE),
  })
);
