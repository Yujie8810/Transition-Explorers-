import { ReactNode } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { theme } from '../theme';

// Shared page wrapper: scrollable content, consistent heading, and spacing.
// children is the feature UI placed between <Screen> and </Screen>.
type Props = { title: string; subtitle?: string; children: ReactNode };

export function Screen({ title, subtitle, children }: Props) {
  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}
      keyboardShouldPersistTaps="handled">
      <Text accessibilityRole="header" style={styles.title}>{title}</Text>
      {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
      <View style={styles.body}>{children}</View>
    </ScrollView>
  );
}
const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: theme.colors.background },
  content: { padding: theme.spacing.lg, paddingBottom: 48 },
  title: { fontSize: 30, fontWeight: '700', color: theme.colors.ink },
  subtitle: { fontSize: 16, lineHeight: 24, marginTop: 8, color: theme.colors.muted },
  body: { gap: 16, marginTop: 24 },
});
