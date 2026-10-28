import { router } from 'expo-router';
import { Screen } from '../../components/Screen';
import { FeaturePlaceholder } from '../../components/FeaturePlaceholder';
import { AppButton } from '../../components/AppButton';

/**
 * Starter screen. Owner: Aproteem (home) + Mourede (advice).
 * need to implment: Aproteem: build the home layout using the shared theme.
 * need to implment: Mourede: connect sample discussions, topic filters, and search.
 * need to implment: Pass the selected discussion ID to the advice route instead of the fixed preview ID.
 */
export default function ExploreScreen() {
  return <Screen title="New job?" subtitle="Get help from people who have been there.">
    {/* need to implment: replace this planning card with the module’s real UI and behavior. */}
    <FeaturePlaceholder owner="Aproteem (home), Mourede (advice)" items={[
      'Build the home layout, topic filters, and discussion search.',
      'Display sample discussions and open the selected advice.',
    ]} />
    {/* Preview navigation only; it does not perform the feature action. */}
    <AppButton label="Preview advice screen" onPress={() => router.push('/advice/first-week')} />
  </Screen>;
}
