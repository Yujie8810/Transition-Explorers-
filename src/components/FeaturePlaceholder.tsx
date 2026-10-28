import { StyleSheet, Text, View } from 'react-native';
import { theme } from '../theme';

// Development-only planning card showing ownership and unfinished work.
// need to implment: each module owner, replace usages of this card in your
// feature screens with real UI; this component itself performs no feature logic.
export function FeaturePlaceholder({ owner, items }: { owner: string; items: string[] }) {
  return (
    <View style={styles.card}>
      <Text style={styles.badge}>STARTER SCREEN · NOT IMPLEMENTED</Text>
      <Text style={styles.owner}>Module owner: {owner}</Text>
      {items.map(item => <Text key={item} style={styles.item}>• {item}</Text>)}
    </View>
  );
}
const styles = StyleSheet.create({
  card: { padding: 20, borderRadius: 16, backgroundColor: theme.colors.surface,
    borderWidth: 1, borderColor: theme.colors.border, gap: 12 },
  badge: { fontSize: 12, fontWeight: '700', color: theme.colors.green },
  owner: { fontSize: 16, fontWeight: '600', color: theme.colors.ink },
  item: { fontSize: 16, lineHeight: 24, color: theme.colors.muted },
});
