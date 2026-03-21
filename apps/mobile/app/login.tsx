/**
 * Login Screen — SMS Magic Link for Foreman
 *
 * Two steps:
 * 1. Phone input → "Send Code" button → OTP sent via Supabase
 * 2. OTP input → "Verify" button → session established → redirect to /
 *
 * Carlos Standard: large text, large buttons, high contrast, bilingual.
 * Zero-friction: no intermediate screens, no password, no account creation.
 *
 * Haptic feedback on every successful action (Submit / Verify).
 */

import { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  Pressable,
  StyleSheet,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import * as Haptics from 'expo-haptics';
import { useAuth } from '../src/providers/AuthProvider';

type Step = 'phone' | 'verify';

export default function LoginScreen() {
  const { t } = useTranslation();
  const { signInWithPhone, verifyOtp, session } = useAuth();
  const router = useRouter();

  const [step, setStep] = useState<Step>('phone');
  const [phone, setPhone] = useState('');
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // If already authenticated, redirect immediately
  if (session) {
    router.replace('/');
    return null;
  }

  async function handleSendCode() {
    setLoading(true);
    setError(null);
    const result = await signInWithPhone(phone);
    setLoading(false);

    if (result.error) {
      setError(result.error);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    } else {
      setStep('verify');
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    }
  }

  async function handleVerify() {
    setLoading(true);
    setError(null);
    const result = await verifyOtp(phone, code);
    setLoading(false);

    if (result.error) {
      setError(result.error);
      setCode('');
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    } else {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      router.replace('/');
    }
  }

  function handleBack() {
    setStep('phone');
    setCode('');
    setError(null);
  }

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <View style={styles.inner}>
        <Text style={styles.title}>{t('auth.loginTitle')}</Text>
        <Text style={styles.subtitle}>{t('auth.loginSubtitle')}</Text>

        {step === 'phone' ? (
          <>
            <Text style={styles.label}>{t('auth.phone')}</Text>
            <TextInput
              style={styles.input}
              value={phone}
              onChangeText={setPhone}
              placeholder="+1 (555) 000-0000"
              placeholderTextColor="#64748b"
              keyboardType="phone-pad"
              autoComplete="tel"
              textContentType="telephoneNumber"
              autoFocus
            />
            <Pressable
              style={[styles.button, (loading || phone.length < 10) && styles.buttonDisabled]}
              onPress={handleSendCode}
              disabled={loading || phone.length < 10}
            >
              {loading ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.buttonText}>{t('auth.login')}</Text>
              )}
            </Pressable>
          </>
        ) : (
          <>
            <Text style={styles.label}>
              {t('auth.codeSent', { phone: phone.slice(0, 4) + '****' })}
            </Text>
            <Text style={styles.hint}>{t('auth.enterCode')}</Text>
            <TextInput
              style={styles.input}
              value={code}
              onChangeText={setCode}
              placeholder="000000"
              placeholderTextColor="#64748b"
              keyboardType="number-pad"
              maxLength={6}
              autoFocus
            />
            <Pressable
              style={[styles.button, (loading || code.length < 6) && styles.buttonDisabled]}
              onPress={handleVerify}
              disabled={loading || code.length < 6}
            >
              {loading ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.buttonText}>{t('common.confirm')}</Text>
              )}
            </Pressable>
            <Pressable style={styles.backButton} onPress={handleBack}>
              <Text style={styles.backText}>{t('common.back')}</Text>
            </Pressable>
          </>
        )}

        {error && (
          <View style={styles.errorBox}>
            <Text style={styles.errorText}>{error}</Text>
            <Pressable style={styles.retryButton} onPress={() => setError(null)}>
              <Text style={styles.retryText}>{t('common.retry')}</Text>
            </Pressable>
          </View>
        )}
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0f172a',
  },
  inner: {
    flex: 1,
    padding: 24,
    justifyContent: 'center',
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    color: '#f8fafc',
    textAlign: 'center',
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 16,
    color: '#94a3b8',
    textAlign: 'center',
    marginBottom: 40,
  },
  label: {
    fontSize: 16,
    color: '#94a3b8',
    marginBottom: 8,
  },
  hint: {
    fontSize: 14,
    color: '#64748b',
    marginBottom: 12,
  },
  input: {
    backgroundColor: '#1e293b',
    borderRadius: 12,
    paddingVertical: 16,
    paddingHorizontal: 16,
    fontSize: 22,
    color: '#f8fafc',
    marginBottom: 16,
    textAlign: 'center',
    letterSpacing: 2,
  },
  button: {
    backgroundColor: '#2563eb',
    borderRadius: 12,
    paddingVertical: 18,
    alignItems: 'center',
    minHeight: 56,
    justifyContent: 'center',
  },
  buttonDisabled: {
    opacity: 0.4,
  },
  buttonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '600',
  },
  backButton: {
    alignItems: 'center',
    paddingVertical: 14,
    marginTop: 8,
  },
  backText: {
    color: '#3b82f6',
    fontSize: 16,
    fontWeight: '500',
  },
  errorBox: {
    backgroundColor: '#7f1d1d',
    borderRadius: 12,
    padding: 16,
    marginTop: 20,
    alignItems: 'center',
    gap: 10,
  },
  errorText: {
    color: '#fecaca',
    fontSize: 14,
    textAlign: 'center',
  },
  retryButton: {
    backgroundColor: '#991b1b',
    borderRadius: 8,
    paddingVertical: 8,
    paddingHorizontal: 20,
  },
  retryText: {
    color: '#fca5a5',
    fontSize: 14,
    fontWeight: '600',
  },
});
