import { StyleSheet, Text, TextInput, TextInputProps, View } from 'react-native';
import { theme } from '../../theme';

export function AuthField({ label, ...props }: TextInputProps & { label: string }) {
  return <View style={{ gap: 8 }}>
    <Text style={authStyles.label}>{label}</Text>
    <TextInput accessibilityLabel={label} placeholderTextColor={theme.colors.muted}
      style={authStyles.input} {...props} />
  </View>;
}

export const authStyles = StyleSheet.create({
  label: { color: theme.colors.ink, fontSize: 16, fontWeight: '600' },
  body: { color: theme.colors.muted, fontSize: 15, lineHeight: 23 },
  input: { minHeight: 48, padding: 14, borderWidth: 1, borderColor: theme.colors.border,
    borderRadius: 12, backgroundColor: theme.colors.surface, color: theme.colors.ink, fontSize: 16 },
  error: { color: theme.colors.danger, fontSize: 16, lineHeight: 24 },
  choices: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  choice: { minHeight: 48, padding: 14, borderRadius: 12, borderWidth: 1,
    borderColor: theme.colors.border, backgroundColor: theme.colors.surface, justifyContent: 'center' },
  selected: { backgroundColor: theme.colors.lime, borderColor: theme.colors.green },
  link: { color: theme.colors.green, fontSize: 16, fontWeight: '600', textDecorationLine: 'underline',
    paddingVertical: 12, minHeight: 44, alignSelf: 'flex-start' },
});
