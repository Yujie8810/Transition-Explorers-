import { Screen } from '../../components/Screen';
import { FeaturePlaceholder } from '../../components/FeaturePlaceholder';
import { router } from 'expo-router';
import { AppButton } from '../../components/AppButton';

/**
 * Starter screen. Owner: Unassigned; team must select an owner.
 * need to implment: Render graduates from shared sample data and add search/expertise filters.
 * need to implment: Navigate with the selected graduate ID instead of the fixed Taylor preview.
 * need to implment: Keep the support-circle entry available for the network flow.
 */
export default function PeopleScreen() {
  return <Screen title="Find your people">
    {/* need to implment: replace this planning card with the module’s real UI and behavior. */}
    <FeaturePlaceholder owner="Unassigned" items={["Search and filter graduates by expertise.", "Open the selected person\u2019s profile."]} />
    {/* Preview navigation only; it does not perform the feature action. */}
    <AppButton label="Preview graduate profile" onPress={() => router.push("/people/taylor")} />
    <AppButton label="Preview Your Circle" onPress={() => router.push("/network")} />
  </Screen>;
}
