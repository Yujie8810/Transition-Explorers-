import { Screen } from '../../components/Screen';
import { FeaturePlaceholder } from '../../components/FeaturePlaceholder';

/**
 * Starter screen. Owner: Aproteem.
 * need to implment: Add registration fields, validation, and UTD community eligibility text.
 * need to implment: Connect registration to the agreed simulated account/session flow.
 */
export default function SignupScreen() {
  return <Screen title="Join the community">
    {/* need to implment: replace this planning card with the module’s real UI and behavior. */}
    <FeaturePlaceholder owner="Aproteem" items={["Build registration UI and validation.", "Explain who can join the UTD community."]} />
  </Screen>;
}
