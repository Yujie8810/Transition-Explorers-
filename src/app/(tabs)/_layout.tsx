import { Text } from '../../components/Typography';
import { Tabs } from 'expo-router';
import { useContext, type ComponentRef, type Ref } from 'react';
import { Pressable, Text as SymbolText, View } from 'react-native';
import { FontsReadyContext, fonts } from '../../components/Typography';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { theme } from '../../theme';
import { HomeButton } from '../../components/HomeButton';

// These route names match the files in src/app/(tabs).
// Tabs automatically highlight the active destination.
// need to implment: Aalvee + Aproteem, replace the temporary text icons with
// the team’s chosen icons and coordinate any shared navigation changes.
export default function TabLayout() {
  const insets = useSafeAreaInsets();
  const fontsReady = useContext(FontsReadyContext);
  return (
    <Tabs screenOptions={({ route }) => ({
      headerStyle: { backgroundColor: theme.colors.background },
      headerTintColor: theme.colors.ink,
      headerTitleStyle: fontsReady ? { fontFamily: fonts.semibold, fontWeight: 'normal' } : undefined,
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
          people: { icon: '◎', label: 'People' }, profile: { icon: '', label: 'Profile' },
        }[route.name] ?? { icon: '◇', label: route.name };
        const color = selected ? theme.colors.green : theme.colors.muted;
        return <Pressable {...props} ref={props.ref as Ref<ComponentRef<typeof Pressable>>} style={[props.style, {
          flex: 1, padding: 0, justifyContent: 'center', alignItems: 'center', gap: 2,
          borderRadius: 12, backgroundColor: selected ? theme.colors.lime : 'transparent',
        }]}>
          {route.name === 'profile' ? <View accessibilityElementsHidden importantForAccessibility="no"
            style={{ width: 24, height: 24, alignItems: 'center', justifyContent: 'center', gap: 3 }}>
            <View style={{ width: 8, height: 8, borderRadius: 4, borderWidth: 1.5, borderColor: color }} />
            <View style={{ width: 18, height: 10, borderTopLeftRadius: 9, borderTopRightRadius: 9, borderWidth: 1.5, borderColor: color }} />
          </View> : <SymbolText accessibilityElementsHidden importantForAccessibility="no"
            style={{ color, fontSize: 22, lineHeight: 24, includeFontPadding: false }}>{tab.icon}</SymbolText>}
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
      headerRight: () => route.name === 'index' ? null : <HomeButton />,
    })}>
      <Tabs.Screen name="index" options={{ title: 'Explore' }} />
      <Tabs.Screen name="ask" options={{ title: 'Ask' }} />
      <Tabs.Screen name="people" options={{ title: 'People' }} />
      <Tabs.Screen name="profile" options={{ title: 'Profile' }} />
    </Tabs>
  );
}
