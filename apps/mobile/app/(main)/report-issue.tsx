/**
 * Report Issue Screen — Carlos Standard
 * 2 taps to submit. Bug or Feedback. Optional photo.
 * Saves via Supabase directly (syncs to feedback_reports table).
 */

import { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  Pressable,
  StyleSheet,
  Alert,
  ActivityIndicator,
  Platform,
  StatusBar,
  ScrollView,
} from 'react-native';
import { useRouter } from 'expo-router';
import * as Haptics from 'expo-haptics';
import Constants from 'expo-constants';
import { useAuth } from '../../src/providers/AuthProvider';

type IssueType = 'bug' | 'feedback';

const TYPE_OPTIONS: { key: IssueType; label: string; icon: string; desc: string }[] = [
  { key: 'bug', label: 'Bug', icon: '🐛', desc: 'Something is broken' },
  { key: 'feedback', label: 'Feedback', icon: '💬', desc: 'Ideas or suggestions' },
];

export default function ReportIssueScreen() {
  const router = useRouter();
  const { session, supabase } = useAuth();

  const [type, setType] = useState<IssueType>('bug');
  const [description, setDescription] = useState('');
  const [photoUri, setPhotoUri] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const user = session?.user;
  const appVersion = Constants.expoConfig?.version ?? '0.1.0';
  const deviceInfo = `${Platform.OS} ${Platform.Version} | Expo ${appVersion}`;

  async function handleSubmit() {
    if (!description.trim()) {
      Alert.alert('Describe the issue', 'Please write what happened before submitting.');
      return;
    }
    if (!user) {
      Alert.alert('Not signed in', 'Please sign in to submit a report.');
      return;
    }

    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setSubmitting(true);

    // Auto-generate title from first 50 chars
    const title = description.trim().slice(0, 50) + (description.trim().length > 50 ? '…' : '');

    // TODO: upload photo to Supabase Storage if photoUri is set
    // For now, submit without photo URL
    const { error } = await supabase.from('feedback_reports').insert({
      reported_by: user.id,
      reporter_name: user.user_metadata?.name ?? user.phone ?? null,
      reporter_role: user.user_metadata?.role ?? null,
      type,
      severity: 'medium',
      title,
      description: description.trim(),
      app_source: 'mobile',
      device_info: deviceInfo,
      screenshots: [],
      status: 'new',
    });

    setSubmitting(false);

    if (error) {
      Alert.alert('Failed to send', error.message);
      return;
    }

    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    setSubmitted(true);
  }

  if (submitted) {
    return (
      <View style={[styles.safe, styles.center]}>
        <Text style={styles.successIcon}>✅</Text>
        <Text style={styles.successTitle}>Report Sent!</Text>
        <Text style={styles.successDesc}>Thanks for the feedback. We&apos;ll review it shortly.</Text>
        <Pressable style={styles.doneButton} onPress={() => router.back()}>
          <Text style={styles.doneButtonText}>Done</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View style={styles.safe}>
      {/* Header */}
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.backButton}>
          <Text style={styles.backText}>←</Text>
        </Pressable>
        <Text style={styles.title}>Report an Issue</Text>
      </View>

      <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
        {/* Type selector */}
        <View style={styles.typeRow}>
          {TYPE_OPTIONS.map((opt) => (
            <Pressable
              key={opt.key}
              style={[styles.typeCard, type === opt.key && styles.typeCardActive]}
              onPress={() => {
                setType(opt.key);
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              }}
            >
              <Text style={styles.typeIcon}>{opt.icon}</Text>
              <Text style={[styles.typeLabel, type === opt.key && styles.typeLabelActive]}>
                {opt.label}
              </Text>
              <Text style={styles.typeDesc}>{opt.desc}</Text>
            </Pressable>
          ))}
        </View>

        {/* Description */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>What happened?</Text>
          <TextInput
            style={styles.textArea}
            multiline
            numberOfLines={4}
            placeholder="Describe the issue or your idea…"
            placeholderTextColor="#475569"
            value={description}
            onChangeText={setDescription}
            textAlignVertical="top"
            maxLength={1000}
          />
        </View>

        {/* Optional photo — placeholder (expo-camera integration available separately) */}
        <View style={styles.section}>
          <Pressable
            style={styles.photoButton}
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              setPhotoUri(photoUri ? null : 'pending');
            }}
          >
            <Text style={styles.photoIcon}>{photoUri ? '✅' : '📷'}</Text>
            <Text style={styles.photoLabel}>
              {photoUri ? 'Photo noted (upload coming soon)' : 'Take Photo (optional)'}
            </Text>
            {photoUri && (
              <Pressable onPress={() => setPhotoUri(null)} style={styles.removePhoto}>
                <Text style={styles.removePhotoText}>Remove</Text>
              </Pressable>
            )}
          </Pressable>
        </View>

        {/* Submit */}
        <Pressable
          style={[styles.submitButton, submitting && styles.submitButtonDisabled]}
          onPress={handleSubmit}
          disabled={submitting}
        >
          {submitting ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.submitText}>Send Report</Text>
          )}
        </Pressable>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: '#0f172a',
    paddingTop: Platform.OS === 'android' ? (StatusBar.currentHeight ?? 40) + 4 : 0,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 16,
    gap: 12,
  },
  backButton: {
    padding: 4,
  },
  backText: {
    fontSize: 22,
    color: '#94a3b8',
  },
  title: {
    fontSize: 22,
    fontWeight: '700',
    color: '#f8fafc',
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingBottom: 40,
    gap: 20,
  },
  // Type selector
  typeRow: {
    flexDirection: 'row',
    gap: 12,
  },
  typeCard: {
    flex: 1,
    alignItems: 'center',
    gap: 4,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#1e293b',
    backgroundColor: '#1e293b',
    paddingVertical: 18,
    paddingHorizontal: 12,
  },
  typeCardActive: {
    borderColor: '#f59e0b80',
    backgroundColor: '#f59e0b10',
  },
  typeIcon: {
    fontSize: 28,
  },
  typeLabel: {
    fontSize: 15,
    fontWeight: '700',
    color: '#94a3b8',
  },
  typeLabelActive: {
    color: '#f59e0b',
  },
  typeDesc: {
    fontSize: 11,
    color: '#475569',
    textAlign: 'center',
  },
  // Description
  section: {
    gap: 8,
  },
  sectionLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#94a3b8',
    letterSpacing: 0.2,
  },
  textArea: {
    backgroundColor: '#1e293b',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#334155',
    padding: 14,
    fontSize: 16,
    color: '#f8fafc',
    minHeight: 100,
  },
  // Photo
  photoButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: '#1e293b',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#334155',
    padding: 14,
  },
  photoIcon: {
    fontSize: 22,
  },
  photoLabel: {
    flex: 1,
    fontSize: 15,
    color: '#94a3b8',
  },
  removePhoto: {
    padding: 4,
  },
  removePhotoText: {
    fontSize: 12,
    color: '#ef4444',
  },
  // Submit
  submitButton: {
    backgroundColor: '#f59e0b',
    borderRadius: 14,
    height: 56,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8,
  },
  submitButtonDisabled: {
    opacity: 0.5,
  },
  submitText: {
    fontSize: 17,
    fontWeight: '700',
    color: '#0f172a',
  },
  // Success
  center: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    paddingHorizontal: 40,
  },
  successIcon: {
    fontSize: 56,
  },
  successTitle: {
    fontSize: 26,
    fontWeight: '700',
    color: '#f8fafc',
  },
  successDesc: {
    fontSize: 15,
    color: '#64748b',
    textAlign: 'center',
  },
  doneButton: {
    marginTop: 16,
    backgroundColor: '#1e293b',
    borderRadius: 12,
    paddingHorizontal: 40,
    paddingVertical: 14,
  },
  doneButtonText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#f8fafc',
  },
});
