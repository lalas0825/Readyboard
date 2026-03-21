/**
 * useReportStore — Zustand store for the 3-step Report Flow.
 *
 * Lifecycle:
 *   startReport(area, userId) → Step 1 (progress slider)
 *   → Step 2 (blockers? yes/no)
 *     → No blockers → status='working' → ready to submit
 *     → Has blockers → Step 3 (reason code + photo)
 *   → submit (caller saves to DB via useFieldReport)
 *   → reset()
 *
 * Rules:
 *   - Nothing saved to DB until final confirm (all data in memory)
 *   - User can navigate back without losing data
 *   - Store resets on app restart (no persistence — avoids corrupt state)
 *   - GPS captured at submit time, not during flow
 */

import { create } from 'zustand';
import type { ReasonCode, FieldReportStatus } from '../types';

export type ReportStep = 1 | 2 | 3;

/** Context from the AreaCard that initiated the report */
export type ReportContext = {
  area_id: string;
  area_name: string;
  floor: string;
  trade_name: string;
  user_id: string;
};

/** Accumulated form data across all steps */
export type ReportFormData = {
  progress_pct: number;
  has_blockers: boolean | null; // null = not answered yet
  reason_code: ReasonCode | null;
  photo_url: string | null;
  gps_lat: number | null;
  gps_lng: number | null;
};

type ReportStoreState = {
  /** Whether the report flow is active */
  isActive: boolean;
  /** Current step (1, 2, or 3) */
  currentStep: ReportStep;
  /** Area/trade/user context */
  context: ReportContext | null;
  /** Accumulated form data */
  formData: ReportFormData;
  /** True while saving to SQLite */
  isSubmitting: boolean;
  /** True after successful submit — triggers SuccessView */
  isSubmitted: boolean;
};

type ReportStoreActions = {
  /** Initialize report for an area — opens step 1 */
  startReport: (context: ReportContext) => void;
  /** Step 1: set progress percentage (0-100) */
  setProgress: (pct: number) => void;
  /** Step 2: set blockers response */
  setBlockers: (hasBlockers: boolean) => void;
  /** Step 3: set reason code */
  setReason: (code: ReasonCode) => void;
  /** Step 3: set photo URL */
  setPhoto: (url: string | null) => void;
  /** Set GPS coordinates (captured at submit time) */
  setGps: (lat: number, lng: number) => void;
  /** Navigate to next step */
  nextStep: () => void;
  /** Navigate to previous step (preserves data) */
  prevStep: () => void;
  /** Mark as submitting */
  setSubmitting: (value: boolean) => void;
  /** Mark as submitted (triggers SuccessView) */
  setSubmitted: (value: boolean) => void;
  /** Derive the final field_report status */
  getDerivedStatus: () => FieldReportStatus;
  /** Reset store to initial state (after submit or cancel) */
  reset: () => void;
};

const INITIAL_FORM_DATA: ReportFormData = {
  progress_pct: 0,
  has_blockers: null,
  reason_code: null,
  photo_url: null,
  gps_lat: null,
  gps_lng: null,
};

const INITIAL_STATE: ReportStoreState = {
  isActive: false,
  currentStep: 1,
  context: null,
  formData: INITIAL_FORM_DATA,
  isSubmitting: false,
  isSubmitted: false,
};

export const useReportStore = create<ReportStoreState & ReportStoreActions>(
  (set, get) => ({
    ...INITIAL_STATE,

    startReport: (context) => {
      set({
        isActive: true,
        currentStep: 1,
        context,
        formData: INITIAL_FORM_DATA,
        isSubmitting: false,
      });
    },

    setProgress: (pct) => {
      set((state) => ({
        formData: { ...state.formData, progress_pct: Math.max(0, Math.min(100, pct)) },
      }));
    },

    setBlockers: (hasBlockers) => {
      set((state) => ({
        formData: {
          ...state.formData,
          has_blockers: hasBlockers,
          // Clear reason if user switches back to "no blockers"
          reason_code: hasBlockers ? state.formData.reason_code : null,
          photo_url: hasBlockers ? state.formData.photo_url : null,
        },
      }));
    },

    setReason: (code) => {
      set((state) => ({
        formData: { ...state.formData, reason_code: code },
      }));
    },

    setPhoto: (url) => {
      set((state) => ({
        formData: { ...state.formData, photo_url: url },
      }));
    },

    setGps: (lat, lng) => {
      set((state) => ({
        formData: { ...state.formData, gps_lat: lat, gps_lng: lng },
      }));
    },

    nextStep: () => {
      set((state) => {
        const next = Math.min(state.currentStep + 1, 3) as ReportStep;
        return { currentStep: next };
      });
    },

    prevStep: () => {
      set((state) => {
        const prev = Math.max(state.currentStep - 1, 1) as ReportStep;
        return { currentStep: prev };
      });
    },

    setSubmitting: (value) => set({ isSubmitting: value }),
    setSubmitted: (value) => set({ isSubmitted: value }),

    getDerivedStatus: () => {
      const { formData } = get();
      if (formData.has_blockers) return 'blocked';
      if (formData.progress_pct >= 100) return 'done';
      return 'working';
    },

    reset: () => {
      set(INITIAL_STATE);
    },
  })
);
