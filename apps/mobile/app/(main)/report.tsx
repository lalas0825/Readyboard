/**
 * Report Route — 3-step field report flow.
 *
 * Reads context from useReportStore (set by AreaCard onPress).
 * Delegates step rendering to ReportFlowNavigator.
 * On submit: saves to local SQLite via useFieldReport, then navigates back.
 *
 * Blindaje:
 *   - Unmount cleanup: resets store if user navigates away without submitting
 *   - Double-tap guard: isSubmitting blocks duplicate writes
 *   - Data integrity: validates formData before DB write
 *   - No DB writes until final confirm (Sensei rule)
 */

import { useEffect, useRef } from 'react';
import { useRouter } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { useReportStore, useFieldReport } from '@readyboard/shared';
import ReportFlowNavigator from '../../src/components/report/ReportFlowNavigator';

export default function ReportScreen() {
  const router = useRouter();
  const store = useReportStore();
  const { createReport, createDelayLog } = useFieldReport();
  const submittedRef = useRef(false);

  // Guard: if store has no context, redirect back (in useEffect, not during render)
  // Skip if already submitted — handleClose manages its own navigation
  useEffect(() => {
    if (!submittedRef.current && (!store.isActive || !store.context)) {
      router.back();
    }
  }, [store.isActive, store.context, router]);

  // Cleanup: reset store when screen unmounts (covers gesture back, hardware back)
  // Skip reset if we already submitted successfully (reset happens in handleSubmit)
  useEffect(() => {
    return () => {
      if (!submittedRef.current) {
        useReportStore.getState().reset();
      }
    };
  }, []);

  async function handleSubmit() {
    // Double-tap guard: abort if already submitting
    if (store.isSubmitting) return;
    if (!store.context) return;

    // Data integrity: validate minimum required fields
    const { formData } = store;
    if (formData.has_blockers === null) {
      console.warn('[Report] Aborted: blockers not answered');
      return;
    }
    if (formData.has_blockers && !formData.reason_code) {
      console.warn('[Report] Aborted: blocked but no reason_code');
      return;
    }

    store.setSubmitting(true);
    try {
      const status = store.getDerivedStatus();
      const id = await createReport({
        area_id: store.context.area_id,
        user_id: store.context.user_id,
        trade_name: store.context.trade_name,
        status,
        progress_pct: formData.progress_pct,
        reason_code: formData.reason_code ?? undefined,
        gps_lat: formData.gps_lat ?? undefined,
        gps_lng: formData.gps_lng ?? undefined,
        photo_url: formData.photo_url ?? undefined,
      });

      // Atomic delay_log: only if blocked, non-blocking if it fails
      if (status === 'blocked' && formData.reason_code) {
        try {
          await createDelayLog({
            area_id: store.context.area_id,
            trade_name: store.context.trade_name,
            reason_code: formData.reason_code,
          });
        } catch (delayError) {
          console.error('[Report] delay_log failed (report persists):', delayError);
        }
      }

      submittedRef.current = true;
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      store.setSubmitting(false);
      store.setSubmitted(true);
    } catch (error) {
      console.error('[Report] Save failed:', error);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      store.setSubmitting(false);
    }
  }

  // Render nothing while redirecting (guard effect handles navigation)
  if (!store.isActive || !store.context) {
    return null;
  }

  function handleClose() {
    store.reset();
    router.replace('/(main)');
  }

  return <ReportFlowNavigator onSubmit={handleSubmit} onClose={handleClose} />;
}
