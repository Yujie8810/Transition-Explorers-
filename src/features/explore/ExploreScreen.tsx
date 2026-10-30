import { Screen } from '../../components/Screen';
import { AdviceFeed } from '../advice/AdviceFeed';

// Home owns the page layout; AdviceFeed owns Mourede's search, filters, and cards.
// Keep this integration small so both teammates can work independently.
export default function ExploreScreen() {
  return <Screen title="New job?" subtitle="Get help from people who have been there.">
    <AdviceFeed />
  </Screen>;
}
