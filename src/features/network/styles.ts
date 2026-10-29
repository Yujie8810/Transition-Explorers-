import { StyleSheet } from 'react-native';
import { theme } from '../../theme';
export const styles = StyleSheet.create({
  card: { padding: 16, gap: 12, borderRadius: 16, backgroundColor: theme.colors.surface, borderWidth: 1, borderColor: theme.colors.border },
  title: { fontSize: 20, fontWeight: '700', color: theme.colors.ink },
  label: { fontSize: 16, fontWeight: '600', color: theme.colors.ink },
  body: { fontSize: 15, lineHeight: 22, color: theme.colors.muted },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  input: { padding: 14, borderRadius: 12, borderWidth: 1, borderColor: theme.colors.border, backgroundColor: theme.colors.surface, color: theme.colors.ink, fontSize: 16 },
  choice: { padding: 12, borderRadius: 12, minHeight: 48, justifyContent: 'center', backgroundColor: theme.colors.surface, borderWidth: 1, borderColor: theme.colors.border },
  selected: { backgroundColor: theme.colors.lime, borderColor: theme.colors.green },
  error: { color: '#B42318', fontSize: 15 },
});
