/**
 * Login Screen — Email + SMS for all roles.
 *
 * Tab 1: Email/password (PM, Super, Admin)
 * Tab 2: SMS magic link (Foreman)
 *
 * Carlos Standard: large text, large buttons, high contrast, bilingual.
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
  Image,
} from 'react-native';
import { Redirect } from 'expo-router';
import { useTranslation } from 'react-i18next';
import * as Haptics from 'expo-haptics';
import { useAuth } from '../src/providers/AuthProvider';

type AuthMode = 'email' | 'phone';
type PhoneStep = 'input' | 'verify';

export default function LoginScreen() {
  const { t } = useTranslation();
  const { signInWithEmail, signInWithPhone, verifyOtp, session } = useAuth();

  const [mode, setMode] = useState<AuthMode>('email');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [phone, setPhone] = useState('');
  const [code, setCode] = useState('');
  const [phoneStep, setPhoneStep] = useState<PhoneStep>('input');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (session) {
    return <Redirect href="/" />;
  }

  async function handleEmailLogin() {
    setLoading(true);
    setError(null);
    const result = await signInWithEmail(email, password);
    setLoading(false);
    if (result.error) {
      setError(result.error);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    } else {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    }
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
      setPhoneStep('verify');
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
    }
  }

  function switchMode(newMode: AuthMode) {
    setMode(newMode);
    setError(null);
    setPhoneStep('input');
  }

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <View style={styles.inner}>
        {/* Logo */}
        <Image
          source={require('../assets/icon.png')}
          style={styles.logo}
          resizeMode="contain"
        />
        <Text style={styles.title}>ReadyBoard</Text>
        <Text style={styles.subtitle}>{t('auth.loginSubtitle')}</Text>

        {/* Mode tabs */}
        <View style={styles.tabs}>
          <Pressable
            style={[styles.tab, mode === 'email' && styles.tabActive]}
            onPress={() => switchMode('email')}
          >
            <Text style={[styles.tabText, mode === 'email' && styles.tabTextActive]}>Email</Text>
          </Pressable>
          <Pressable
            style={[styles.tab, mode === 'phone' && styles.tabActive]}
            onPress={() => switchMode('phone')}
          >
            <Text style={[styles.tabText, mode === 'phone' && styles.tabTextActive]}>SMS</Text>
          </Pressable>
        </View>

        {/* Email login */}
        {mode === 'email' && (
          <>
            <TextInput
              style={styles.input}
              value={email}
              onChangeText={setEmail}
              placeholder="you@company.com"
              placeholderTextColor="#64748b"
              keyboardType="email-address"
              autoCapitalize="none"
              autoComplete="email"
              autoFocus
            />
            <TextInput
              style={styles.input}
              value={password}
              onChangeText={setPassword}
              placeholder="Password"
              placeholderTextColor="#64748b"
              secureTextEntry
              autoComplete="password"
            />
            <Pressable
              style={[styles.button, (loading || !email || !password) && styles.buttonDisabled]}
              onPress={handleEmailLogin}
              disabled={loading || !email || !password}
            >
              {loading ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.buttonText}>Sign In</Text>
              )}
            </Pressable>
          </>
        )}

        {/* Phone login */}
        {mode === 'phone' && phoneStep === 'input' && (
          <>
            <TextInput
              style={styles.input}
              value={phone}
              onChangeText={setPhone}
              placeholder="+1 (555) 000-0000"
              placeholderTextColor="#64748b"
              keyboardType="phone-pad"
              autoComplete="tel"
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
                <Text style={styles.buttonText}>Send Code</Text>
              )}
            </Pressable>
          </>
        )}

        {/* OTP verify */}
        {mode === 'phone' && phoneStep === 'verify' && (
          <>
            <Text style={styles.hint}>Code sent to {phone.slice(0, 4)}****</Text>
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
                <Text style={styles.buttonText}>Verify</Text>
              )}
            </Pressable>
            <Pressable style={styles.backButton} onPress={() => setPhoneStep('input')}>
              <Text style={styles.backText}>Back</Text>
            </Pressable>
          </>
        )}

        {/* Error */}
        {error && (
          <View style={styles.errorBox}>
            <Text style={styles.errorText}>{error}</Text>
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
  logo: {
    width: 80,
    height: 80,
    alignSelf: 'center',
    marginBottom: 12,
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    color: '#f8fafc',
    textAlign: 'center',
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 15,
    color: '#94a3b8',
    textAlign: 'center',
    marginBottom: 32,
  },
  tabs: {
    flexDirection: 'row',
    backgroundColor: '#1e293b',
    borderRadius: 10,
    padding: 3,
    marginBottom: 24,
  },
  tab: {
    flex: 1,
    paddingVertical: 10,
    alignItems: 'center',
    borderRadius: 8,
  },
  tabActive: {
    backgroundColor: '#334155',
  },
  tabText: {
    color: '#64748b',
    fontSize: 15,
    fontWeight: '600',
  },
  tabTextActive: {
    color: '#f8fafc',
  },
  input: {
    backgroundColor: '#1e293b',
    borderRadius: 12,
    paddingVertical: 16,
    paddingHorizontal: 16,
    fontSize: 17,
    color: '#f8fafc',
    marginBottom: 12,
  },
  hint: {
    fontSize: 14,
    color: '#64748b',
    marginBottom: 12,
    textAlign: 'center',
  },
  button: {
    backgroundColor: '#f59e0b',
    borderRadius: 12,
    paddingVertical: 18,
    alignItems: 'center',
    minHeight: 56,
    justifyContent: 'center',
    marginTop: 4,
  },
  buttonDisabled: {
    opacity: 0.4,
  },
  buttonText: {
    color: '#0f172a',
    fontSize: 18,
    fontWeight: '700',
  },
  backButton: {
    alignItems: 'center',
    paddingVertical: 14,
    marginTop: 8,
  },
  backText: {
    color: '#f59e0b',
    fontSize: 16,
    fontWeight: '500',
  },
  errorBox: {
    backgroundColor: '#7f1d1d',
    borderRadius: 12,
    padding: 16,
    marginTop: 20,
    alignItems: 'center',
  },
  errorText: {
    color: '#fecaca',
    fontSize: 14,
    textAlign: 'center',
  },
});
