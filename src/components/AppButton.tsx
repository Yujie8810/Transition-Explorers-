import { Text } from './Typography';
import { Pressable, StyleSheet } from 'react-native';
import { theme } from '../theme';

// Shared touch target: label is visible text; onPress is supplied by the screen.
// Press feedback lowers opacity. Feature logic belongs in the caller.
type Props = { label: string; onPress: () => void; disabled?: boolean; accessibilityLabel?: string; variant?: 'primary' | 'secondary' | 'danger' };
export function AppButton({ label, onPress, disabled = false, accessibilityLabel, variant = 'primary' }: Props) {
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={accessibilityLabel ?? label} onPress={onPress} disabled={disabled}
      accessibilityState={{ disabled }}
      style={({ pressed }) => [styles.button, variant === 'secondary' && styles.secondary,
        variant === 'danger' && { backgroundColor: theme.colors.danger }, (pressed || disabled) && { opacity: 0.5 }]}>
      <Text style={[styles.label, variant === 'secondary' && styles.secondaryLabel]}>{label}</Text>
    </Pressable>
  );
}
const styles = StyleSheet.create({
  button: { minHeight: 48, padding: 16, borderRadius: 14, backgroundColor: theme.colors.green,
    alignItems: 'center', justifyContent: 'center' },
  label: { color: theme.colors.surface, fontSize: 16, fontWeight: '600' },
  secondary: { backgroundColor: theme.colors.surface, borderWidth: 1, borderColor: theme.colors.border },
  secondaryLabel: { color: theme.colors.green },
});
