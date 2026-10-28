import { Screen } from '../../components/Screen';
import { FeaturePlaceholder } from '../../components/FeaturePlaceholder';

/**
 * Starter screen. Owner: Mourede.
 * need to implment: Read the discussion ID with useLocalSearchParams and load its answers.
 * need to implment: Let users save a specific answer and show which answer was saved.
 * need to implment: Share saved state with SavedScreen so the answer can be reopened.
 */
export default function AdviceDetailScreen() {
  return <Screen title="Read advice">
    {/* need to implment: replace this planning card with the module’s real UI and behavior. */}
    <FeaturePlaceholder owner="Mourede" items={["Read the selected discussion and its answers.", "Save a specific answer with visible confirmation."]} />
  </Screen>;
}
