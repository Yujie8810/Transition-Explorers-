import { Screen } from '../../components/Screen';
import { FeaturePlaceholder } from '../../components/FeaturePlaceholder';
import { router } from 'expo-router';
import { AppButton } from '../../components/AppButton';

/**
 * Starter screen. Owner: Aalvee; coordinate logout with Aproteem.
 * need to implment: Display the current user and UTD affiliation from the agreed session state.
 * need to implment: Add profile editing if included in the team’s scope.
 * need to implment: Replace the login preview with the appropriate account/logout controls.
 */
export default function ProfileScreen() {
  return <Screen title="Your profile">
    {/* need to implment: replace this planning card with the module’s real UI and behavior. */}
    <FeaturePlaceholder owner="Aalvee" items={["Display the current user and UTD affiliation.", "Coordinate account and logout behavior with Aproteem."]} />
    {/* Preview navigation only; it does not perform the feature action. */}
    <AppButton label="Preview login screen" onPress={() => router.push("/login")} />
  </Screen>;
}
