import { sampleAnswers, sampleGuides } from '../../data/sampleData';
import { Guide } from '../../types';

/**
 * Owner: Mourede.
 * Look up answers and their authors from the shared data, so every screen
 * (feed counts, advice detail, Saved) shows the same text and names.
 */

export const answersFor = (adviceId: string) => sampleAnswers.filter(answer => answer.adviceId === adviceId);
export const findAnswer = (answerId: string) => sampleAnswers.find(answer => answer.id === answerId);
export const findGuide = (guideId: string) => sampleGuides.find(guide => guide.id === guideId);

/** "Anika Kumar" -> "AK" */
export const initials = (name: string) => name.split(/\s+/).map(part => part[0]).join('').slice(0, 2).toUpperCase();
export const firstName = (name: string) => name.split(/\s+/)[0];

/** "UTD '24", with a non-breaking space so it never splits across lines. */
export const gradLabel = (year: number) => `UTD\u00A0'${String(year).slice(-2)}`;

/** "Anika Kumar · UTD '24" (no year shown when the guide has none). */
export const nameLine = (guide: Guide) =>
  guide.gradYear ? `${guide.name} · ${gradLabel(guide.gradYear)}` : guide.name;

/** "Software engineer · 2 years in" */
export const roleLine = (guide: Guide) => guide.yearsExperience
  ? `${guide.role} · ${guide.yearsExperience} ${guide.yearsExperience === 1 ? 'year' : 'years'} in`
  : guide.role;
