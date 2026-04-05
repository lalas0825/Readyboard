/**
 * Step 2: Any Blockers? + Optional Progress Photo
 *
 * Two full-width buttons:
 *   Green "No blockers" → status=working → ready to submit
 *   Red "Yes, blocked" → go to Step 3 for reason code
 *
 * Fix 3: Optional progress photo before answering blockers.
 * Photo is stored in formData.photo_url with photo_type='progress'.
 * Never required — report always submits without it.
 *
 * Carlos Standard: color does the talking, 56px+ buttons.
 */

import { useState } from 'react';
import { View, Text, Pressable, StyleSheet, Image, ActivityIndicator } from 'react-native';
import { useTranslation } from 'react-i18next';
import * as Haptics from 'expo-haptics';
import { useReportStore } from '@readyboard/shared';
import PhotoCapture from './PhotoCapture';
import { useFieldEvidence } from '../../hooks/useFieldEvidence';

type Props = {
  onReadyToSubmit: () => void;
};

export default function Step2Blockers({ onReadyToSubmit }: Props) {
  const { t } = useTranslation();
  const context = useReportStore((s) => s.context);
  const progress = useReportStore((s) => s.formData.progress_pct);
  const isSubmitting = useReportStore((s) => s.isSubmitting);
  const currentPhoto = useReportStore((s) => s.formData.photo_url);
  const setBlockers = useReportStore((s) => s.setBlockers);
  const setPhoto = useReportStore((s) => s.setPhoto);
  const nextStep = useReportStore((s) => s.nextStep);
  const prevStep = useReportStore((s) => s.prevStep);

  const [showCamera, setShowCamera] = useState(false);
  const evidence = useFieldEvidence();

  async function handleOpenCamera() {
    if (isSubmitting) return;
    if (!evidence.cameraPermission) {
      const granted = await evidence.requestCameraPermission();
      if (!granted) return;
    }
    setShowCamera(true);
  }

  async function handlePhotoCaptured(uri: string) {
    setShowCamera(false);
    const processed = await evidence.processPhoto(uri);
    if (processed) {
      setPhoto(processed.uri);
    }
  }

  function handleNoBlockers() {
    if (isSubmitting) return;
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    setBlockers(false);
    onReadyToSubmit();
  }

  function handleHasBlockers() {
    if (isSubmitting) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setBlockers(true);
    nextStep();
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
      {/* Context */}
      <Text style={styles.areaName}>{context?.area_name}</Text>
      <Text style={styles.progressLabel}>{progress}%</Text>
      <Text style={styles.stepTitle}>{t('fieldReport.step2Title')}</Text>

      {/* Optional progress photo */}
      <View style={styles.photoSection}>
        <Text style={styles.photoLabel}>
          {t('fieldReport.progressPhoto', 'Progress photo (optional)')}
        </Text>
        {currentPhoto ? (
          <View style={styles.photoPreview}>
            <Image source={{ uri: currentPhoto }} style={styles.thumbnail} />
            <View style={styles.photoInfo}>
              <Text style={styles.photoText}>Photo captured</Text>
            </View>
            <Pressable
              onPress={() => { evidence.clearPhoto(); setPhoto(null); }}
              style={styles.retakeButton}
            >
              <Text style={styles.retakeText}>Remove</Text>
            </Pressable>
          </View>
        ) : (
          <Pressable
            style={styles.cameraButton}
            onPress={handleOpenCamera}
            disabled={evidence.photoProcessing || isSubmitting}
          >
            {evidence.photoProcessing ? (
              <ActivityIndicator color="#60a5fa" size="small" />
            ) : (
              <>
                <Text style={styles.cameraIcon}>&#128247;</Text>
                <Text style={styles.cameraText}>
                  {t('fieldReport.addPhoto', 'Add photo')}
                </Text>
              </>
            )}
          </Pressable>
        )}
      </View>

      {/* Buttons */}
      <View style={styles.buttonsContainer}>
        <Pressable
          style={[styles.greenButton, isSubmitting && styles.buttonDisabled]}
          onPress={handleNoBlockers}
          disabled={isSubmitting}
        >
          <Text style={styles.buttonIcon}>{'\u2713'}</Text>
          <Text style={styles.buttonText}>{t('fieldReport.noBlockers')}</Text>
        </Pressable>

        <Pressable
          style={[styles.redButton, isSubmitting && styles.buttonDisabled]}
          onPress={handleHasBlockers}
          disabled={isSubmitting}
        >
          <Text style={styles.buttonIcon}>{'\u2717'}</Text>
          <Text style={styles.buttonText}>{t('fieldReport.hasBlockers')}</Text>
        </Pressable>
      </View>

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
    justifyContent: 'center',
  },
  areaName: {
    fontSize: 16,
    color: '#94a3b8',
    textAlign: 'center',
    marginBottom: 4,
  },
  progressLabel: {
    fontSize: 28,
    fontWeight: '700',
    color: '#f8fafc',
    textAlign: 'center',
    marginBottom: 8,
  },
  stepTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: '#f8fafc',
    textAlign: 'center',
    marginBottom: 20,
  },

  // ── Optional photo ──────────────────────────────────────────
  photoSection: {
    marginBottom: 24,
  },
  photoLabel: {
    fontSize: 13,
    fontWeight: '500',
    color: '#64748b',
    marginBottom: 8,
    textAlign: 'center',
  },
  cameraButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: 'rgba(96,165,250,0.08)',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(96,165,250,0.2)',
    height: 44,
  },
  cameraIcon: {
    fontSize: 18,
  },
  cameraText: {
    color: '#60a5fa',
    fontSize: 14,
    fontWeight: '600',
  },
  photoPreview: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: '#1e293b',
    borderRadius: 10,
    padding: 8,
    borderWidth: 1,
    borderColor: '#22c55e40',
  },
  thumbnail: {
    width: 44,
    height: 44,
    borderRadius: 6,
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
  retakeButton: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 6,
    backgroundColor: '#0f172a',
  },
  retakeText: {
    fontSize: 12,
    color: '#94a3b8',
    fontWeight: '500',
  },

  // ── Main buttons ────────────────────────────────────────────
  buttonsContainer: {
    gap: 16,
    marginBottom: 24,
  },
  greenButton: {
    backgroundColor: '#166534',
    borderRadius: 16,
    height: 80,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },
  redButton: {
    backgroundColor: '#991b1b',
    borderRadius: 16,
    height: 80,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },
  buttonIcon: {
    fontSize: 28,
    color: '#fff',
  },
  buttonText: {
    fontSize: 22,
    fontWeight: '700',
    color: '#fff',
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
  buttonDisabled: {
    opacity: 0.4,
  },
});
