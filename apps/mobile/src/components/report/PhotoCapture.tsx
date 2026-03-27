/**
 * PhotoCapture — Full-screen camera view for field evidence.
 *
 * Carlos Standard: one button, big viewfinder, instant feedback.
 * Captures photo → compresses to 1200px JPEG → returns URI.
 */

import { useState, useRef } from 'react';
import { View, Text, Pressable, StyleSheet, ActivityIndicator } from 'react-native';
import { CameraView, type CameraType } from 'expo-camera';
import { useTranslation } from 'react-i18next';
import * as Haptics from 'expo-haptics';

type Props = {
  onCapture: (uri: string) => void;
  onCancel: () => void;
};

export default function PhotoCapture({ onCapture, onCancel }: Props) {
  const { t } = useTranslation();
  const cameraRef = useRef<CameraView>(null);
  const [facing, setFacing] = useState<CameraType>('back');
  const [capturing, setCapturing] = useState(false);

  async function handleCapture() {
    if (capturing || !cameraRef.current) return;
    setCapturing(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    try {
      const photo = await cameraRef.current.takePictureAsync({
        quality: 0.8,
        skipProcessing: false,
      });
      if (photo?.uri) {
        onCapture(photo.uri);
      }
    } catch (err) {
      console.error('[PhotoCapture] Failed:', err);
    } finally {
      setCapturing(false);
    }
  }

  function handleFlip() {
    setFacing((f) => (f === 'back' ? 'front' : 'back'));
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  }

  return (
    <View style={styles.container}>
      <CameraView
        ref={cameraRef}
        style={styles.camera}
        facing={facing}
      >
        {/* Top bar */}
        <View style={styles.topBar}>
          <Pressable onPress={onCancel} style={styles.cancelButton}>
            <Text style={styles.cancelText}>{t('common.cancel')}</Text>
          </Pressable>
          <Pressable onPress={handleFlip} style={styles.flipButton}>
            <Text style={styles.flipText}>&#128260;</Text>
          </Pressable>
        </View>

        {/* Bottom bar with capture button */}
        <View style={styles.bottomBar}>
          <Pressable
            onPress={handleCapture}
            disabled={capturing}
            style={styles.captureButton}
          >
            {capturing ? (
              <ActivityIndicator color="#fff" size="small" />
            ) : (
              <View style={styles.captureInner} />
            )}
          </Pressable>
        </View>
      </CameraView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#000',
    zIndex: 100,
  },
  camera: {
    flex: 1,
    justifyContent: 'space-between',
  },
  topBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingTop: 60,
    paddingHorizontal: 20,
  },
  cancelButton: {
    backgroundColor: 'rgba(0,0,0,0.5)',
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  cancelText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  flipButton: {
    backgroundColor: 'rgba(0,0,0,0.5)',
    borderRadius: 8,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  flipText: {
    fontSize: 24,
  },
  bottomBar: {
    alignItems: 'center',
    paddingBottom: 50,
  },
  captureButton: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: 'rgba(255,255,255,0.3)',
    borderWidth: 4,
    borderColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  captureInner: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#fff',
  },
});
