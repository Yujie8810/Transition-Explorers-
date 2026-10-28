import { Screen } from '../../components/Screen';
import { FeaturePlaceholder } from '../../components/FeaturePlaceholder';

/**
 * Starter screen. Owner: Mourede.
 * need to implment: Add editable question input, topic selection, and visibility controls.
 * need to implment: Validate the question and add review, edit, publish, and confirmation steps.
 * need to implment: Keep the draft when returning from the review screen.
 */
export default function AskScreen() {
  return <Screen title="Ask the community">
    {/* need to implment: replace this planning card with the module’s real UI and behavior. */}
    <FeaturePlaceholder owner="Mourede" items={["Compose and edit a question.", "Select topic and visibility, review, and publish."]} />
  </Screen>;
}
