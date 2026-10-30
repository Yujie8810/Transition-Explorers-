import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { theme } from '../theme';
import { NetworkProvider } from '../features/network/NetworkProvider';
import { AdviceProvider } from '../features/advice/AdviceProvider';
import { SavedAdviceProvider } from '../state/SavedAdviceContext';

// The root stack places detail/account screens above the main tab navigator.
// Pushing a screen adds native back navigation to the previous screen.
// need to implment: Aproteem + Aalvee, add the agreed session provider and
// account-based routing here when the authentication module is ready.
// need to implment: module owners, register new review/confirmation/detail
// screens here as your task flows grow; coordinate shared navigation edits.
export default function RootLayout() {
  return <NetworkProvider><AdviceProvider><SavedAdviceProvider>
    <StatusBar style="dark" />
    <Stack screenOptions={{
      headerStyle: { backgroundColor: theme.colors.background },
      headerTintColor: theme.colors.ink,
      contentStyle: { backgroundColor: theme.colors.background },
    }}>
      <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
      <Stack.Screen name="advice/[id]" options={{ title: 'Advice' }} />
      <Stack.Screen name="people/[id]" options={{ title: 'Graduate profile' }} />
      <Stack.Screen name="people/request" options={{ title: 'Request guidance' }} />
      <Stack.Screen name="network/index" options={{ title: 'Your Circle' }} />
      <Stack.Screen name="network/check-in" options={{ title: 'Schedule a check-in' }} />
      <Stack.Screen name="profile" options={{ title: 'My profile' }} />
      <Stack.Screen name="login" options={{ title: 'Log in' }} />
      <Stack.Screen name="signup" options={{ title: 'Sign up' }} />
    </Stack>
  </SavedAdviceProvider></AdviceProvider></NetworkProvider>;
}
