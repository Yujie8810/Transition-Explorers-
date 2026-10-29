import { StyleSheet, Text, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';

import { Screen } from '../../components/Screen';
import { AppButton } from '../../components/AppButton';
import { sampleGuides } from '../../data/sampleData';
import { theme } from '../../theme';

export default function GuideProfileScreen() {
  const { id } = useLocalSearchParams<{ id?: string | string[] }>();
  const graduateId = Array.isArray(id) ? id[0] : id;
  const graduate = sampleGuides.find((guide) => guide.id === graduateId);

  if (!graduate) {
    return (
      <Screen title="Graduate profile">
        <Text style={styles.emptyMessage}>Graduate not found</Text>
      </Screen>
    );
  }

  return (
    <Screen title="Graduate profile">
      <View style={styles.profileCard}>
        <Text style={styles.name}>{graduate.name}</Text>
        <Text style={styles.role}>{graduate.role}</Text>
        <Text style={styles.expertise}>{graduate.expertise.join(' · ')}</Text>
      </View>

      <View style={styles.aboutSection}>
        <Text style={styles.sectionTitle}>About</Text>
        <Text style={styles.aboutText}>
          {graduate.name} is a graduate who shares practical advice on
          starting a career, building confidence at work, and navigating
          common first-job questions.
        </Text>
      </View>

      <AppButton
        label="Ask for Guidance"
        onPress={() =>
          router.push({
            pathname: '/people/request',
            params: { id: graduate.id },
          })
        }
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  profileCard: {
    padding: 16,
    gap: 10,
    borderRadius: 16,
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  name: {
    fontSize: 20,
    fontWeight: '700',
    color: theme.colors.ink,
  },
  role: {
    fontSize: 16,
    color: theme.colors.muted,
  },
  expertise: {
    fontSize: 14,
    color: theme.colors.ink,
  },
  aboutSection: {
    gap: 8,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: theme.colors.ink,
  },
  aboutText: {
    fontSize: 15,
    lineHeight: 22,
    color: theme.colors.muted,
  },
  emptyMessage: {
    color: theme.colors.muted,
    fontSize: 15,
  },
});
