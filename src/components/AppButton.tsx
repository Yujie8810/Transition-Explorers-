import { Pressable, StyleSheet, Text } from 'react-native';
import { theme } from '../theme';

// Shared touch target: label is visible text; onPress is supplied by the screen.
// Press feedback lowers opacity. Feature logic belongs in the caller.
type Props = { label: string; onPress: () => void; disabled?: boolean };
export function AppButton({ label, onPress, disabled = false }: Props) {
  return (
    <Pressable accessibilityRole="button" onPress={onPress} disabled={disabled}
      accessibilityState={{ disabled }}
      style={({ pressed }) => [styles.button, (pressed || disabled) && { opacity: 0.5 }]}>
      <Text style={styles.label}>{label}</Text>
    </Pressable>
  );
}
const styles = StyleSheet.create({
  button: { minHeight: 48, padding: 16, borderRadius: 14, backgroundColor: theme.colors.green,
    alignItems: 'center', justifyContent: 'center' },
  label: { color: theme.colors.surface, fontSize: 16, fontWeight: '600' },
});
