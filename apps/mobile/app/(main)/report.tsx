/**
 * Report Route — 3-step field report flow with GPS + photo evidence.
 *
 * Reads context from useReportStore (set by AreaCard onPress).
 * Delegates step rendering to ReportFlowNavigator.
 * On submit: captures GPS → saves to local SQLite via useFieldReport → syncs to Supabase.
 *
 * Blindaje:
 *   - Unmount cleanup: resets store if user navigates away without submitting
 *   - Double-tap guard: isSubmitting blocks duplicate writes
 *   - Data integrity: validates formData before DB write
 *   - GPS captured at submit time (most accurate)
 *   - No DB writes until final confirm (Sensei rule)
 */

import { useEffect, useRef } from 'react';
import { useRouter } from 'expo-router';
import * as Haptics from 'expo-haptics';
import * as Location from 'expo-location';
import { useReportStore, useFieldReport } from '@readyboard/shared';
import { useAuth } from '../../src/providers/AuthProvider';
import { uploadPhoto } from '../../src/services/uploadPhoto';
import ReportFlowNavigator from '../../src/components/report/ReportFlowNavigator';

export default function ReportScreen() {
  const router = useRouter();
  const store = useReportStore();
  const { createReport, createDelayLog } = useFieldReport();
  const { supabase } = useAuth();
  const submittedRef = useRef(false);

  // Guard: if store has no context, redirect back
  useEffect(() => {
    if (!submittedRef.current && (!store.isActive || !store.context)) {
      router.back();
    }
  }, [store.isActive, store.context, router]);

  // Cleanup: reset store when screen unmounts
  useEffect(() => {
    return () => {
      if (!submittedRef.current) {
        useReportStore.getState().reset();
      }
    };
  }, []);

  async function handleSubmit() {
    // Double-tap guard
    if (store.isSubmitting) return;
    if (!store.context) return;

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
      // Capture GPS at submit time if not already set (non-blocked reports)
      let gpsLat = formData.gps_lat;
      let gpsLng = formData.gps_lng;

      if (gpsLat === null || gpsLng === null) {
        try {
          const { granted } = await Location.getForegroundPermissionsAsync();
          if (granted) {
            const loc = await Location.getCurrentPositionAsync({
              accuracy: Location.Accuracy.Balanced,
              timeInterval: 3000,
            });
            gpsLat = loc.coords.latitude;
            gpsLng = loc.coords.longitude;
            store.setGps(gpsLat, gpsLng);
          }
        } catch {
          // GPS failure never blocks report submission
        }
      }

      const status = store.getDerivedStatus();

      // Upload photo to Supabase Storage (falls back to local URI if offline)
      let photoUrl = formData.photo_url ?? undefined;
      if (photoUrl) {
        try {
          const uploadResult = await uploadPhoto(
            photoUrl,
            supabase,
            store.context.area_id,
          );
          photoUrl = uploadResult.url;
        } catch {
          // Photo upload failure never blocks report submission
          console.warn('[Report] Photo upload failed, using local URI');
        }
      }

      await createReport({
        area_id: store.context.area_id,
        user_id: store.context.user_id,
        trade_name: store.context.trade_name,
        status,
        progress_pct: formData.progress_pct,
        reason_code: formData.reason_code ?? undefined,
        notes: formData.notes ?? undefined,
        gps_lat: gpsLat ?? undefined,
        gps_lng: gpsLng ?? undefined,
        photo_url: photoUrl,
        photo_type: formData.has_blockers ? 'blocker' : 'progress',
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

  if (!store.isActive || !store.context) {
    return null;
  }

  function handleClose() {
    store.reset();
    router.replace('/(main)');
  }

  return <ReportFlowNavigator onSubmit={handleSubmit} onClose={handleClose} />;
}
