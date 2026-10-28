import { Screen } from '../../components/Screen';
import { FeaturePlaceholder } from '../../components/FeaturePlaceholder';
import { router } from 'expo-router';
import { AppButton } from '../../components/AppButton';

/**
 * Starter screen. Owner: Aproteem.
 * need to implment: Add login inputs and validation with clear error messages.
 * need to implment: Agree on simulated session state and connect successful login to the main tabs.
 * need to implment: Coordinate login, signup, and logout behavior with the profile module.
 */
export default function LoginScreen() {
  return <Screen title="Welcome back">
    {/* need to implment: replace this planning card with the module’s real UI and behavior. */}
    <FeaturePlaceholder owner="Aproteem" items={["Build login UI and validation.", "Agree on a simulated session approach before storing account data."]} />
    {/* Preview navigation only; it does not perform the feature action. */}
    <AppButton label="Preview signup screen" onPress={() => router.push("/signup")} />
  </Screen>;
}
