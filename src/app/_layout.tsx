import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { theme } from '../theme';
import { NetworkProvider } from '../features/network/NetworkProvider';
import { AdviceProvider } from '../features/advice/AdviceProvider';
import { SavedAdviceProvider } from '../state/SavedAdviceContext';
import { ProfileProvider } from '../state/ProfileContext';

// The root stack places detail/account screens above the main tab navigator.
// Pushing a screen adds native back navigation to the previous screen.
// ProfileProvider shares local demo identity; it does not authenticate users.
// need to implment: Aproteem + Aalvee, integrate authentication and account-based routing.
// need to implment: module owners, register new review/confirmation/detail
// screens here as your task flows grow; coordinate shared navigation edits.
export default function RootLayout() {
  return <ProfileProvider><NetworkProvider><AdviceProvider><SavedAdviceProvider>
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
      <Stack.Screen name="my-questions/index" options={{ title: 'Your posted questions' }} />
      <Stack.Screen name="my-questions/[id]" options={{ title: 'Edit question' }} />
      <Stack.Screen name="profile" options={{ title: 'My profile' }} />
      <Stack.Screen name="login" options={{ title: 'Log in' }} />
      <Stack.Screen name="signup" options={{ title: 'Sign up' }} />
    </Stack>
  </SavedAdviceProvider></AdviceProvider></NetworkProvider></ProfileProvider>;
}
