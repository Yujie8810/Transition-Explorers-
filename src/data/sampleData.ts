import { Advice, Guide } from '../types';

// Fictional seed data only. No feature is wired to this data yet.
// need to implment: module owners, expand this dataset to support all three
// tasks and import it into your screens instead of duplicating records.
// Keep IDs stable: Advice.authorId references Guide.id.
// need to implment: agree on a shared state/storage approach for user changes;
// changing these arrays alone does not create a reactive saved-items/session store.
export const sampleGuides: Guide[] = [
  { id: 'taylor', name: 'Taylor Morgan', role: 'Software engineer', expertise: ['Code reviews', 'First role'] },
];
export const sampleAdvice: Advice[] = [
  { id: 'first-week', title: 'First week nerves?', topic: 'First job',
    body: 'Write down unfamiliar terms and ask one focused question at a time.', authorId: 'taylor' },
];
