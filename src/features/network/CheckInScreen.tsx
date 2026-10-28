import { Screen } from '../../components/Screen';
import { FeaturePlaceholder } from '../../components/FeaturePlaceholder';

/**
 * Starter screen. Owner: Hoa.
 * need to implment: Receive the selected mentor and add topic and duration controls.
 * need to implment: Allow available date/time selection, then review and confirm the details.
 * need to implment: Save the check-in to shared state and show it in Your Circle.
 */
export default function CheckInScreen() {
  return <Screen title="Plan a check-in">
    {/* need to implment: replace this planning card with the module’s real UI and behavior. */}
    <FeaturePlaceholder owner="Hoa" items={["Choose a topic, duration, and available date/time.", "Review and confirm the check-in."]} />
  </Screen>;
}
