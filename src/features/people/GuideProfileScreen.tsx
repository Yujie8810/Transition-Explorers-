import { Screen } from '../../components/Screen';
import { FeaturePlaceholder } from '../../components/FeaturePlaceholder';
import { router } from 'expo-router';
import { AppButton } from '../../components/AppButton';

/**
 * Starter screen. Owner: Unassigned; team must select an owner.
 * need to implment: Read the graduate ID from the route and display that person’s details.
 * need to implment: Pass the selected graduate ID into the help-request screen.
 */
export default function GuideProfileScreen() {
  return <Screen title="Graduate profile">
    {/* need to implment: replace this planning card with the module’s real UI and behavior. */}
    <FeaturePlaceholder owner="Unassigned" items={["Show the selected graduate\u2019s background and expertise.", "Start a request for guidance."]} />
    {/* Preview navigation only; it does not perform the feature action. */}
    <AppButton label="Preview help request screen" onPress={() => router.push("/people/request")} />
  </Screen>;
}
