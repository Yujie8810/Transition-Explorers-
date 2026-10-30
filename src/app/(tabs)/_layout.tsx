import { Link, Tabs } from 'expo-router';
import type { ComponentRef, Ref } from 'react';
import { Pressable, Text } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { theme } from '../../theme';

// These route names match the files in src/app/(tabs).
// Tabs automatically highlight the active destination; Profile opens a stack screen.
// need to implment: Aalvee + Aproteem, replace the temporary text icons with
// the team’s chosen icons and coordinate any shared navigation changes.
export default function TabLayout() {
  const insets = useSafeAreaInsets();
  return (
    <Tabs screenOptions={({ route }) => ({
      headerStyle: { backgroundColor: theme.colors.background },
      headerTintColor: theme.colors.ink,
      tabBarActiveTintColor: theme.colors.green,
      // Highlight the full active tab (icon and label) using the shared lime accent.
      tabBarActiveBackgroundColor: theme.colors.lime,
      tabBarInactiveTintColor: theme.colors.muted,
      // Put spacing on the bar, not vertical item margins, so labels stay inside the highlight.
      // Center icon and label together, rather than relying on platform-specific offsets.
      tabBarButton: props => {
        const selected = !!props['aria-selected'];
        const tab = {
          index: { icon: '◇', label: 'Explore' }, ask: { icon: '?', label: 'Ask' },
          people: { icon: '◎', label: 'People' }, saved: { icon: '▤', label: 'Saved' },
        }[route.name] ?? { icon: '◇', label: route.name };
        const color = selected ? theme.colors.green : theme.colors.muted;
        return <Pressable {...props} ref={props.ref as Ref<ComponentRef<typeof Pressable>>} style={[props.style, {
          flex: 1, padding: 0, justifyContent: 'center', alignItems: 'center', gap: 2,
          borderRadius: 12, backgroundColor: selected ? theme.colors.lime : 'transparent',
        }]}>
          <Text accessibilityElementsHidden importantForAccessibility="no"
            style={{ color, fontSize: 22, lineHeight: 24, includeFontPadding: false }}>{tab.icon}</Text>
          <Text style={{ color, fontSize: 12, lineHeight: 16, fontWeight: selected ? '700' : '500' }}>{tab.label}</Text>
        </Pressable>;
      },
      tabBarItemStyle: { borderRadius: 12, marginHorizontal: 4, overflow: 'hidden' },
      tabBarStyle: {
        backgroundColor: theme.colors.surface,
        height: 68 + insets.bottom,
        paddingTop: 6,
        paddingBottom: 6 + insets.bottom,
      },
      headerRight: () => <Link href="/profile" accessibilityLabel="Open my profile"
        style={{ marginRight: 16, padding: 8, color: theme.colors.green }}>Profile</Link>,
    })}>
      <Tabs.Screen name="index" options={{ title: 'Explore' }} />
      <Tabs.Screen name="ask" options={{ title: 'Ask' }} />
      <Tabs.Screen name="people" options={{ title: 'People' }} />
      <Tabs.Screen name="saved" options={{ title: 'Saved' }} />
    </Tabs>
  );
}
