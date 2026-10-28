import { Screen } from '../../components/Screen';
import { FeaturePlaceholder } from '../../components/FeaturePlaceholder';

/**
 * Starter screen. Owner: Mourede + Hoa; agree on one owner before editing.
 * need to implment: Read the same saved-advice state updated by the advice/network flows.
 * need to implment: Display saved advice with consistent author names and initials.
 * need to implment: Support opening and removing a saved item, plus an empty state.
 */
export default function SavedScreen() {
  return <Screen title="Advice worth keeping">
    {/* need to implment: replace this planning card with the module’s real UI and behavior. */}
    <FeaturePlaceholder owner="Mourede + Hoa (agree on ownership)" items={["Show advice saved by the user.", "Keep attribution consistent and support removing saved items."]} />
  </Screen>;
}
