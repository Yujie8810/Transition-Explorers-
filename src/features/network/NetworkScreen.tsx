import { Screen } from '../../components/Screen';
import { FeaturePlaceholder } from '../../components/FeaturePlaceholder';
import { router } from 'expo-router';
import { AppButton } from '../../components/AppButton';

/**
 * Starter screen. Owner: Hoa.
 * need to implment: Display contacts and pending requests from shared state.
 * need to implment: Add mentor details, support history, and progress screens/routes.
 * need to implment: Open check-in scheduling for the selected mentor and show scheduled check-ins.
 */
export default function NetworkScreen() {
  return <Screen title="Your Circle">
    {/* need to implment: replace this planning card with the module’s real UI and behavior. */}
    <FeaturePlaceholder owner="Hoa" items={["Show connected people and pending requests.", "Open mentor details and track support history."]} />
    {/* Preview navigation only; it does not perform the feature action. */}
    <AppButton label="Preview check-in screen" onPress={() => router.push("/network/check-in")} />
  </Screen>;
}
