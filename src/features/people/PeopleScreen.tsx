import { useCallback, useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { useFocusEffect, router } from 'expo-router';

import { Screen } from '../../components/Screen';
import { AppButton } from '../../components/AppButton';
import { usePeople } from '../people/PeopleProvider';
import { theme } from '../../theme';

export default function PeopleScreen() {
  const { people: guides, loadError, ready, reload } = usePeople();
  useFocusEffect(useCallback(() => { reload(); }, [reload]));
  const [searchText, setSearchText] = useState('');
  const [selectedExpertise, setSelectedExpertise] = useState('All');

  const expertiseOptions = [
    'All',
    ...new Set(guides.flatMap((guide) => guide.expertise)),
  ];

  const filteredGuides = useMemo(() => {
    const query = searchText.trim().toLowerCase();

    return guides.filter((guide) => {
      const matchesSearch =
        guide.name.toLowerCase().includes(query) ||
        guide.role.toLowerCase().includes(query) ||
        guide.expertise.some((skill) =>
          skill.toLowerCase().includes(query),
        );

      const matchesExpertise =
        selectedExpertise === 'All' ||
        guide.expertise.includes(selectedExpertise);

      return matchesSearch && matchesExpertise;
    });
  }, [searchText, selectedExpertise, guides]);

  return (
    <Screen
      title="Find your people"
      subtitle="Connect with graduates who can help you navigate your first job."
    >
      <AppButton variant="secondary" label="Add or edit your People profile" onPress={() => router.push('/profile')} />
      {!ready && !loadError ? <Text>Loading community profiles…</Text> : null}
      {loadError ? <Text accessibilityRole="alert">{loadError}</Text> : null}
      <AppButton variant="secondary" label="Refresh people" onPress={reload} />
      <TextInput
        style={styles.searchInput}
        placeholder="Search name, role, or skill..."
        value={searchText}
        onChangeText={setSearchText}
        autoCapitalize="none"
        accessibilityLabel="Search graduates"
      />

      <Text style={styles.sectionTitle}>Filter by expertise</Text>

      <View style={styles.filterContainer} accessibilityRole="radiogroup" accessibilityLabel="Filter by expertise">
        {expertiseOptions.map((expertise) => {
          const isSelected = selectedExpertise === expertise;

          return (
            <Pressable
              key={expertise}
              accessibilityRole="radio"
              accessibilityState={{ checked: isSelected }}
              onPress={() => setSelectedExpertise(expertise)}
              style={[
                styles.filterOption,
                isSelected && styles.selectedFilter,
              ]}
            >
              <Text style={[styles.filterText, isSelected && styles.selectedFilterText]}>{expertise}</Text>
            </Pressable>
          );
        })}
      </View>

      <Text style={styles.resultCount}>
        {filteredGuides.length}{' '}
        {filteredGuides.length === 1 ? 'person' : 'people'} found
      </Text>

      {filteredGuides.map((guide) => (
        <View key={guide.id} style={styles.personCard}>
          <Text style={styles.personName}>{guide.name}</Text>

          <Text style={styles.personRole}>{guide.role}</Text>

          <Text style={styles.expertise}>
            {guide.expertise.join(' · ')}
          </Text>

          <AppButton
            label="View profile"
            onPress={() =>
              router.push({
                pathname: '/people/[id]',
                params: { id: guide.id },
              })
            }
          />
        </View>
      ))}

      {filteredGuides.length === 0 && (
        <Text style={styles.emptyMessage}>
          No people found. Try another search or filter.
        </Text>
      )}

      <AppButton
        variant="secondary"
        label="View Your Circle"
        onPress={() => router.push('/network')}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  searchInput: {
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: 12,
    padding: 14,
    fontSize: 16,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: theme.colors.ink,
    marginTop: 8,
  },
  filterContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  filterOption: {
    minHeight: 44,
    justifyContent: 'center',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 20,
    backgroundColor: theme.colors.surface,
    overflow: 'hidden',
  },
  filterText: { color: theme.colors.ink, fontSize: 14 },
  selectedFilterText: { color: theme.colors.surface },
  selectedFilter: {
    backgroundColor: theme.colors.green,
  },
  resultCount: {
    color: theme.colors.muted,
    fontSize: 14,
  },
  personCard: {
    padding: 16,
    gap: 10,
    borderRadius: 16,
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  personName: {
    fontSize: 20,
    fontWeight: '700',
    color: theme.colors.ink,
  },
  personRole: {
    fontSize: 16,
    color: theme.colors.muted,
  },
  expertise: {
    fontSize: 14,
    color: theme.colors.ink,
  },
  emptyMessage: {
    color: theme.colors.muted,
    fontSize: 15,
  },
});
