import { Text } from '../components/Typography';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { theme } from '../theme';
import { PeopleProvider } from '../features/people/PeopleProvider';
import { NetworkProvider } from '../features/network/NetworkProvider';
import { AdviceProvider } from '../features/advice/AdviceProvider';
import { SavedAdviceProvider } from '../state/SavedAdviceContext';
import { ProfileProvider } from '../state/ProfileContext';

import { Screen } from '../components/Screen';
import { AppButton } from '../components/AppButton';
import { HomeButton } from '../components/HomeButton';
import { AuthProvider, useAuth } from '../features/auth/AuthProvider';
import { AnswersProvider } from '../features/advice/AnswersProvider';
import type { Account } from '../features/auth/accountStore';
import { useContext, type ReactNode } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { useFonts } from 'expo-font';
import { DMSans_400Regular } from '@expo-google-fonts/dm-sans/400Regular';
import { DMSans_500Medium } from '@expo-google-fonts/dm-sans/500Medium';
import { DMSans_600SemiBold } from '@expo-google-fonts/dm-sans/600SemiBold';
import { DMSans_700Bold } from '@expo-google-fonts/dm-sans/700Bold';
import { DMSans_800ExtraBold } from '@expo-google-fonts/dm-sans/800ExtraBold';
import { FontsReadyContext, fonts } from '../components/Typography';

export default function RootLayout() {
  const [loaded, error] = useFonts({
    DMSans_400Regular, DMSans_500Medium, DMSans_600SemiBold,
    DMSans_700Bold, DMSans_800ExtraBold,
  });
  if (!loaded && !error) return <View style={{ flex: 1, justifyContent: 'center', backgroundColor: theme.colors.background }}>
    <ActivityIndicator accessibilityLabel="Loading fonts" color={theme.colors.green} />
  </View>;
  // Keep the app usable with system fonts if a bundled font fails to load.
  return <FontsReadyContext.Provider value={loaded}>
    <AuthProvider><StatusBar style="dark" /><SessionLayout /></AuthProvider>
  </FontsReadyContext.Provider>;
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
  const fontsReady = useContext(FontsReadyContext);
  return <Stack screenOptions={{
      headerTitleStyle: fontsReady ? { fontFamily: fonts.semibold, fontWeight: 'normal' } : undefined,
      headerStyle: { backgroundColor: theme.colors.background },
      headerTintColor: theme.colors.ink,
      headerRight: () => <HomeButton />,
      contentStyle: { backgroundColor: theme.colors.background },
    }}>
    <Stack.Protected guard={!!account}>
      <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
      <Stack.Screen name="advice/[id]" options={{ title: 'Advice' }} />
      <Stack.Screen name="people/[id]" options={{ title: 'Graduate profile' }} />
      <Stack.Screen name="people/request" options={{ title: 'Request guidance' }} />
      <Stack.Screen name="network/index" options={{ title: 'Your Circle' }} />
      <Stack.Screen name="network/requests-received" options={{ title: 'Requests received' }} />
      <Stack.Screen name="network/guidance-requests" options={{ title: 'Your guidance requests' }} />
      <Stack.Screen name="network/check-ins" options={{ title: 'Check-ins' }} />
      <Stack.Screen name="network/contacts" options={{ title: 'Contacts' }} />
      <Stack.Screen name="network/chat/[id]" options={{ title: 'Guidance chat' }} />
      <Stack.Screen name="network/propose-time" options={{ title: 'Propose a new time' }} />
      <Stack.Screen name="network/check-in" options={{ title: 'Schedule a check-in' }} />
      <Stack.Screen name="my-questions/index" options={{ title: 'Your posted questions' }} />
      <Stack.Screen name="my-questions/[id]" options={{ title: 'Edit question' }} />
      <Stack.Screen name="saved" options={{ title: 'Saved' }} />
    </Stack.Protected>
    <Stack.Protected guard={!account}>
      <Stack.Screen name="login" options={{ title: 'Log in' }} />
      <Stack.Screen name="signup" options={{ title: 'Sign up' }} />
    </Stack.Protected>
  </Stack>;
}
