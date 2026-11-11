import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { theme } from '../theme';
import { PeopleProvider } from '../features/people/PeopleProvider';
import { NetworkProvider } from '../features/network/NetworkProvider';
import { AdviceProvider } from '../features/advice/AdviceProvider';
import { SavedAdviceProvider } from '../state/SavedAdviceContext';
import { ProfileProvider } from '../state/ProfileContext';
import { Text } from 'react-native';
import { Screen } from '../components/Screen';
import { AppButton } from '../components/AppButton';
import { AuthProvider, useAuth } from '../features/auth/AuthProvider';
import { AnswersProvider } from '../features/advice/AnswersProvider';
import type { Account } from '../features/auth/accountStore';
import type { ReactNode } from 'react';

export default function RootLayout() {
  return <AuthProvider><StatusBar style="dark" /><SessionLayout /></AuthProvider>;
}

function SessionLayout() {
  const { account, ready, loadError, reload } = useAuth();
  if (!ready) return <Screen title="Career Commons">
    <Text accessibilityRole={loadError ? 'alert' : undefined}>{loadError || 'Getting things ready…'}</Text>
    {loadError ? <AppButton label="Try again" onPress={reload} /> : null}
  </Screen>;

  // Destroy account data, forms, and navigation history on logout/account change.
  // Pending writes retain their original account's key; legacy keys are untouched.
  return account
    ? <AccountProviders key={account.id} account={account}><RootNavigator /></AccountProviders>
    : <RootNavigator />;
}

function AccountProviders({
  account,
  children,
}: {
  account: Account;
  children: ReactNode;
}) {
  return (
    <ProfileProvider
      accountId={account.id}
      initialProfile={account.initialProfile}
    >
      <PeopleProvider accountId={account.id}>
      <NetworkProvider accountId={account.id}>
        <AdviceProvider accountId={account.id}>
          {/* Root remounts these providers when the account changes. */}
          <AnswersProvider>
            <SavedAdviceProvider accountId={account.id}>
              {children}
            </SavedAdviceProvider>
          </AnswersProvider>
        </AdviceProvider>
      </NetworkProvider>
      </PeopleProvider>
    </ProfileProvider>
  );
}

function RootNavigator() {
  const { account } = useAuth();
  return <Stack screenOptions={{
      headerStyle: { backgroundColor: theme.colors.background },
      headerTintColor: theme.colors.ink,
      contentStyle: { backgroundColor: theme.colors.background },
    }}>
    <Stack.Protected guard={!!account}>
      <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
      <Stack.Screen name="advice/[id]" options={{ title: 'Advice' }} />
      <Stack.Screen name="people/[id]" options={{ title: 'Graduate profile' }} />
      <Stack.Screen name="people/request" options={{ title: 'Request guidance' }} />
      <Stack.Screen name="network/index" options={{ title: 'Your Circle' }} />
      <Stack.Screen name="network/chat/[id]" options={{ title: 'Guidance chat' }} />
      <Stack.Screen name="network/propose-time" options={{ title: 'Propose a new time' }} />
      <Stack.Screen name="network/check-in" options={{ title: 'Schedule a check-in' }} />
      <Stack.Screen name="my-questions/index" options={{ title: 'Your posted questions' }} />
      <Stack.Screen name="my-questions/[id]" options={{ title: 'Edit question' }} />
      <Stack.Screen name="profile" options={{ title: 'My profile' }} />
    </Stack.Protected>
    <Stack.Protected guard={!account}>
      <Stack.Screen name="login" options={{ title: 'Log in' }} />
      <Stack.Screen name="signup" options={{ title: 'Sign up' }} />
    </Stack.Protected>
  </Stack>;
}
