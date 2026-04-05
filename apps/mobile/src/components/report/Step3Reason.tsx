/**
 * Step 3: Why Blocked? + Photo + GPS Evidence
 *
 * 1. Select reason code (grid of large icon buttons)
 * 2. Capture photo evidence (opens camera)
 * 3. GPS auto-captured in background
 * 4. Submit with all evidence
 *
 * Carlos Standard: large icons, one-tap select, color feedback, camera in 1 tap.
 */

import { View, Text, Pressable, StyleSheet, ScrollView, ActivityIndicator, Image, TextInput } from 'react-native';
import { useTranslation } from 'react-i18next';
import * as Haptics from 'expo-haptics';
import { useReportStore, type ReasonCode } from '@readyboard/shared';
import { useState } from 'react';
import PhotoCapture from './PhotoCapture';
import GpsIndicator from './GpsIndicator';
import { useFieldEvidence } from '../../hooks/useFieldEvidence';

const REASON_CODES: { code: ReasonCode; icon: string }[] = [
  { code: 'no_heat', icon: '\uD83C\uDF21' },
  { code: 'prior_trade', icon: '\uD83D\uDD28' },
  { code: 'no_access', icon: '\uD83D\uDEAB' },
  { code: 'inspection', icon: '\uD83D\uDCCB' },
  { code: 'plumbing', icon: '\uD83D\uDD27' },
  { code: 'material', icon: '\uD83D\uDCE6' },
  { code: 'moisture', icon: '\uD83D\uDCA7' },
  { code: 'other', icon: '\u2026' },
];

type Props = {
  /** Called when user confirms with a reason selected */
  onReadyToSubmit: () => void;
};

export default function Step3Reason({ onReadyToSubmit }: Props) {
  const { t } = useTranslation();
  const context = useReportStore((s) => s.context);
  const selectedReason = useReportStore((s) => s.formData.reason_code);
  const isSubmitting = useReportStore((s) => s.isSubmitting);
  const setReason = useReportStore((s) => s.setReason);
  const setNotes = useReportStore((s) => s.setNotes);
  const setPhoto = useReportStore((s) => s.setPhoto);
  const setGps = useReportStore((s) => s.setGps);
  const prevStep = useReportStore((s) => s.prevStep);
  const currentNotes = useReportStore((s) => s.formData.notes);

  const [showCamera, setShowCamera] = useState(false);
  const evidence = useFieldEvidence();

  function handleSelectReason(code: ReasonCode) {
    if (isSubmitting) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setReason(code);
  }

  async function handleOpenCamera() {
    if (isSubmitting) return;

    // Request permission if not granted
    if (!evidence.cameraPermission) {
      const granted = await evidence.requestCameraPermission();
      if (!granted) return;
    }

    // Request location permission too (for GPS at capture time)
    if (!evidence.locationPermission) {
      await evidence.requestLocationPermission();
    }

    setShowCamera(true);
  }

  async function handlePhotoCaptured(uri: string) {
    setShowCamera(false);

    // Compress photo to 1200px JPEG
    const processed = await evidence.processPhoto(uri);
    if (processed) {
      setPhoto(processed.uri);
    }

    // Capture fresh GPS at photo time
    const gps = await evidence.captureGps();
    if (gps) {
      setGps(gps.lat, gps.lng);
    }
  }

  function handleSubmit() {
    if (!selectedReason || isSubmitting) return;
    if (selectedReason === 'other' && !currentNotes?.trim()) return; // require note for "other"

    // Set GPS from evidence if available and not already set
    if (evidence.gps) {
      setGps(evidence.gps.lat, evidence.gps.lng);
    }

    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    onReadyToSubmit();
  }

  function handleBack() {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    prevStep();
  }

  // Full-screen camera overlay
  if (showCamera) {
    return (
      <PhotoCapture
        onCapture={handlePhotoCaptured}
        onCancel={() => setShowCamera(false)}
      />
    );
  }

  return (
    <View style={styles.container}>
      {/* Context + GPS indicator */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <Text style={styles.areaName}>{context?.area_name}</Text>
          <Text style={styles.stepTitle}>{t('fieldReport.step3Title')}</Text>
        </View>
        <GpsIndicator
          gps={evidence.gps}
          loading={evidence.gpsLoading}
          hasPermission={evidence.locationPermission}
        />
      </View>

      {/* Reason code grid */}
      <ScrollView showsVerticalScrollIndicator={false}>
        <View style={styles.grid}>
          {REASON_CODES.map(({ code, icon }) => {
            const isSelected = selectedReason === code;
            return (
              <Pressable
                key={code}
                style={[styles.reasonCard, isSelected && styles.reasonSelected]}
                onPress={() => handleSelectReason(code)}
              >
                <Text style={styles.reasonIcon}>{icon}</Text>
                <Text style={[styles.reasonLabel, isSelected && styles.reasonLabelSelected]}>
                  {t(`reasonCodes.${code}`)}
                </Text>
              </Pressable>
            );
          })}
        </View>

        {/* Free-text input — only shown when "Other" is selected */}
        {selectedReason === 'other' && (
          <TextInput
            style={styles.otherInput}
            placeholder={t('reasonCodes.otherPlaceholder')}
            placeholderTextColor="#475569"
            value={currentNotes ?? ''}
            onChangeText={(text) => setNotes(text || null)}
            multiline
            numberOfLines={3}
            textAlignVertical="top"
            autoFocus
          />
        )}
      </ScrollView>

      {/* Photo preview or capture button */}
      {evidence.photo ? (
        <View style={styles.photoPreview}>
          <Image source={{ uri: evidence.photo.uri }} style={styles.thumbnail} />
          <View style={styles.photoInfo}>
            <Text style={styles.photoText}>Photo captured</Text>
            {evidence.gps && (
              <Text style={styles.gpsText}>
                {evidence.gps.lat.toFixed(4)}, {evidence.gps.lng.toFixed(4)}
              </Text>
            )}
          </View>
          <Pressable onPress={() => { evidence.clearPhoto(); setPhoto(null); }} style={styles.retakeButton}>
            <Text style={styles.retakeText}>Retake</Text>
          </Pressable>
        </View>
      ) : (
        <Pressable
          style={styles.cameraButton}
          onPress={handleOpenCamera}
          disabled={evidence.photoProcessing}
        >
          {evidence.photoProcessing ? (
            <ActivityIndicator color="#f59e0b" size="small" />
          ) : (
            <>
              <Text style={styles.cameraIcon}>&#128247;</Text>
              <Text style={styles.cameraText}>{t('fieldReport.takePhoto')}</Text>
            </>
          )}
        </Pressable>
      )}

      {/* Submit */}
      <Pressable
        style={[
          styles.submitButton,
          (!selectedReason || isSubmitting || (selectedReason === 'other' && !currentNotes?.trim())) && styles.submitDisabled,
        ]}
        onPress={handleSubmit}
        disabled={!selectedReason || isSubmitting || (selectedReason === 'other' && !currentNotes?.trim())}
      >
        {isSubmitting ? (
          <ActivityIndicator color="#fff" size="small" />
        ) : (
          <Text style={styles.submitText}>{t('fieldReport.submit')}</Text>
        )}
      </Pressable>

      {/* Back */}
      <Pressable style={styles.backButton} onPress={handleBack}>
        <Text style={styles.backText}>{t('common.back')}</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingHorizontal: 24,
    paddingTop: 20,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 20,
  },
  headerLeft: {
    flex: 1,
  },
  areaName: {
    fontSize: 16,
    color: '#94a3b8',
    marginBottom: 4,
  },
  stepTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: '#f8fafc',
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    justifyContent: 'center',
    paddingBottom: 16,
  },
  reasonCard: {
    backgroundColor: '#1e293b',
    borderRadius: 16,
    width: '45%',
    paddingVertical: 20,
    alignItems: 'center',
    gap: 8,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  reasonSelected: {
    borderColor: '#3b82f6',
    backgroundColor: '#172554',
  },
  reasonIcon: {
    fontSize: 32,
  },
  reasonLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#94a3b8',
    textAlign: 'center',
  },
  reasonLabelSelected: {
    color: '#93c5fd',
  },
  // ─── Photo ────────────────────────
  cameraButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#1e293b',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#f59e0b40',
    height: 52,
    marginBottom: 12,
  },
  cameraIcon: {
    fontSize: 20,
  },
  cameraText: {
    color: '#f59e0b',
    fontSize: 15,
    fontWeight: '600',
  },
  photoPreview: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: '#1e293b',
    borderRadius: 12,
    padding: 8,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#22c55e40',
  },
  thumbnail: {
    width: 48,
    height: 48,
    borderRadius: 8,
    backgroundColor: '#0f172a',
  },
  photoInfo: {
    flex: 1,
  },
  photoText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#22c55e',
  },
  gpsText: {
    fontSize: 10,
    color: '#64748b',
    fontFamily: 'monospace',
    marginTop: 2,
  },
  retakeButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: '#0f172a',
  },
  retakeText: {
    fontSize: 12,
    color: '#94a3b8',
    fontWeight: '500',
  },
  // ─── Other text input ─────────────
  otherInput: {
    backgroundColor: '#1e293b',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#3b82f6',
    color: '#f8fafc',
    fontSize: 16,
    padding: 14,
    marginTop: 4,
    marginBottom: 12,
    minHeight: 80,
  },
  // ─── Submit ───────────────────────
  submitButton: {
    backgroundColor: '#2563eb',
    borderRadius: 12,
    height: 56,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  submitDisabled: {
    opacity: 0.4,
  },
  submitText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '600',
  },
  backButton: {
    alignItems: 'center',
    paddingVertical: 14,
  },
  backText: {
    color: '#3b82f6',
    fontSize: 16,
    fontWeight: '500',
  },
});
