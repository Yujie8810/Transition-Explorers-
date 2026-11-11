import { supabase } from '../../lib/supabase';
import type { Guide } from '../../types';

export type DirectoryRow = {
  id: string; full_name: string | null; current_role: string | null;
  major: string | null; bio: string | null; expertise: string[]; listed_in_people: boolean;
};
const columns = 'id, full_name, current_role, major, bio, expertise, listed_in_people';
export const mapDirectoryProfile = (row: DirectoryRow): Guide => ({
  id: row.id, name: row.full_name?.trim() || 'Community member',
  role: row.current_role?.trim() || row.major?.trim() || 'UTD community',
  expertise: row.expertise ?? [], bio: row.bio ?? '', listed: row.listed_in_people,
});
export async function fetchDirectory(): Promise<Guide[]> {
  if (!supabase) throw new Error('Supabase is not configured.');
  // Profiles are already readable by authenticated users. Keep unlisted profiles
  // available for existing Circle contacts, but exclude them from People search.
  const { data, error } = await supabase.from('Profiles').select(columns).order('full_name');
  if (error) throw error;
  return ((data ?? []) as DirectoryRow[]).map(mapDirectoryProfile);
}
export async function saveDirectoryProfile(accountId: string, input: {
  role: string; expertise: string[]; bio: string; listed: boolean;
}): Promise<Guide> {
  if (!supabase) throw new Error('Supabase is not configured.');
  const role = input.role.trim(), bio = input.bio.trim();
  const expertise = [...new Set(input.expertise.map(value => value.trim()).filter(Boolean))];
  if (role.length > 120 || bio.length > 1000 || expertise.length > 10
      || expertise.some(value => value.length > 60) || (input.listed && !role)) {
    throw new Error('Add a role (up to 120 characters), up to 10 skills (60 characters each), and a bio up to 1000 characters.');
  }
  const { data, error } = await supabase.from('Profiles').update({
    current_role: role, expertise, bio, listed_in_people: input.listed,
  }).eq('id', accountId).select(columns).single();
  if (error) throw error;
  if (!data) throw new Error('Your directory profile could not be saved.');
  return mapDirectoryProfile(data as DirectoryRow);
}
