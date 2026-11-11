import { router } from 'expo-router';
import { Pressable, Text } from 'react-native';
import { theme } from '../theme';

export function HomeButton() {
  return <Pressable accessibilityRole="button" accessibilityLabel="Go to home"
    onPress={() => router.dismissTo('/')}
    style={({ pressed }) => ({
      marginRight: 8, minWidth: 48, minHeight: 48,
      alignItems: 'center', justifyContent: 'center', opacity: pressed ? 0.5 : 1,
    })}>
    <Text accessibilityElementsHidden importantForAccessibility="no"
      style={{ color: theme.colors.green, fontSize: 30, lineHeight: 34 }}>⌂</Text>
  </Pressable>;
}
