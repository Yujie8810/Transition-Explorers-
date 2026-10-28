import { Screen } from '../../components/Screen';
import { FeaturePlaceholder } from '../../components/FeaturePlaceholder';

/**
 * Starter screen. Owner: Unassigned; team must select an owner.
 * need to implment: Receive the selected graduate ID and show the intended recipient.
 * need to implment: Add an editable message and help-type selection with validation.
 * need to implment: Add review/edit, send confirmation, and shared request/connection state.
 */
export default function HelpRequestScreen() {
  return <Screen title="Request guidance">
    {/* need to implment: replace this planning card with the module’s real UI and behavior. */}
    <FeaturePlaceholder owner="Unassigned" items={["Write an editable request and choose the help type.", "Review, send, and show confirmation."]} />
  </Screen>;
}
