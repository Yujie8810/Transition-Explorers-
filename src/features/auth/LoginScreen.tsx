import { useState } from 'react';
import { Keyboard, Text } from 'react-native';
import { Link } from 'expo-router';
import { Screen } from '../../components/Screen';
import { AppButton } from '../../components/AppButton';
import { useAuth } from './AuthProvider';
import { normalizeEmail, validEmail } from './accountStore';
import { AuthField, authStyles } from './ui';

export default function LoginScreen() {
  const { signIn, busy } = useAuth();
  const [email, setEmail] = useState('');
  const [error, setError] = useState('');
  const submit = async () => {
    if (busy) return;
    if (!validEmail(normalizeEmail(email))) { setError('Enter a valid email address.'); return; }
    Keyboard.dismiss(); setError('');
    try { await signIn(email); }
    catch (cause) { setError(cause instanceof Error ? cause.message : 'We could not log you in. Please try again.'); }
  };
  return <Screen title="Welcome back" subtitle="Find advice and support for your next step.">
    <AuthField label="Email" value={email} onChangeText={value => { setEmail(value); setError(''); }}
      keyboardType="email-address" autoCapitalize="none" autoCorrect={false} autoComplete="email"
      maxLength={254} editable={!busy} returnKeyType="go" onSubmitEditing={() => void submit()} />
    {error ? <Text style={authStyles.error} accessibilityRole="alert">{error}</Text> : null}
    <AppButton label={busy ? 'Logging in…' : 'Log in'} disabled={busy} onPress={() => void submit()} />
    {!busy ? <Link href="/signup" style={authStyles.link}>New here? Create an account</Link> : null}
  </Screen>;
}
