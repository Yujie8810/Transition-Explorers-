import { useState } from 'react';
import { Keyboard, Pressable, Text, View } from 'react-native';
import { Link } from 'expo-router';
import { Screen } from '../../components/Screen';
import { AppButton } from '../../components/AppButton';
import type { UserProfile } from '../../state/ProfileContext';
import { useAuth } from './AuthProvider';
import { validateRegistration } from './accountStore';
import { AuthField, authStyles } from './ui';

export default function SignupScreen() {
  const { signUp, busy } = useAuth();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [program, setProgram] = useState('');
  const [affiliation, setAffiliation] = useState<UserProfile['affiliation'] | null>(null);
  const [error, setError] = useState('');
  const submit = async () => {
    if (busy) return;
    setError('');
    if (!affiliation) { setError('Select Student or Graduate.'); return; }
    try {
      const input = validateRegistration({ name, email, program, affiliation });
      Keyboard.dismiss();
      await signUp(input);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Your account could not be saved. Please try again.');
    }
  };
  return <Screen title="Join the community" subtitle="A place for UTD students and recent graduates.">
    <AuthField label="Name" value={name} onChangeText={value => { setName(value); setError(''); }}
      maxLength={80} autoCapitalize="words" autoComplete="name" editable={!busy} />
    <AuthField label="Email" value={email} onChangeText={value => { setEmail(value); setError(''); }}
      keyboardType="email-address" autoCapitalize="none" autoCorrect={false} autoComplete="email" maxLength={254} editable={!busy} />
    <AuthField label="Program or field of study" value={program}
      onChangeText={value => { setProgram(value); setError(''); }} maxLength={100} editable={!busy} />
    <Text style={authStyles.label}>UTD affiliation</Text>
    <View style={authStyles.choices} accessibilityRole="radiogroup" accessibilityLabel="UTD affiliation">
      {(['Student', 'Graduate'] as const).map(value => <Pressable key={value}
        accessibilityRole="radio" accessibilityState={{ checked: affiliation === value, disabled: busy }}
        disabled={busy} onPress={() => { setAffiliation(value); setError(''); }}
        style={[authStyles.choice, affiliation === value && authStyles.selected]}>
        <Text style={authStyles.label}>{value}</Text>
      </Pressable>)}
    </View>
    {error ? <Text style={authStyles.error} accessibilityRole="alert">{error}</Text> : null}
    <AppButton label={busy ? 'Creating account…' : 'Create account'} disabled={busy} onPress={() => void submit()} />
    {!busy ? <Link href="/login" replace style={authStyles.link}>Already registered? Log in</Link> : null}
  </Screen>;
}
