import { Link, Tabs } from 'expo-router';
import { Text } from 'react-native';
import { theme } from '../../theme';

// These route names match the files in src/app/(tabs).
// Tabs automatically highlight the active destination; Profile opens a stack screen.
// need to implment: Aalvee + Aproteem, replace the temporary text icons with
// the team’s chosen icons and coordinate any shared navigation changes.
export default function TabLayout() {
  return (
    <Tabs screenOptions={{
      headerStyle: { backgroundColor: theme.colors.background },
      headerTintColor: theme.colors.ink,
      tabBarActiveTintColor: theme.colors.green,
      tabBarInactiveTintColor: theme.colors.muted,
      tabBarStyle: { backgroundColor: theme.colors.surface },
      headerRight: () => <Link href="/profile" accessibilityLabel="Open my profile"
        style={{ marginRight: 16, padding: 8, color: theme.colors.green }}>Profile</Link>,
    }}>
      <Tabs.Screen name="index" options={{ title: 'Explore',
        tabBarIcon: ({ color }) => <Text style={{ color, fontSize: 22 }}>◇</Text> }} />
      <Tabs.Screen name="ask" options={{ title: 'Ask',
        tabBarIcon: ({ color }) => <Text style={{ color, fontSize: 22 }}>?</Text> }} />
      <Tabs.Screen name="people" options={{ title: 'People',
        tabBarIcon: ({ color }) => <Text style={{ color, fontSize: 22 }}>◎</Text> }} />
      <Tabs.Screen name="saved" options={{ title: 'Saved',
        tabBarIcon: ({ color }) => <Text style={{ color, fontSize: 22 }}>▤</Text> }} />
    </Tabs>
  );
}
