import { redirect } from 'next/navigation';

import { createClient } from '@/lib/supabase/server';
import HonneApp from '@/components/HonneApp';

export const dynamic = 'force-dynamic';

export default async function Home() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect('/login');

  const [{ data: profiles }, { data: records }] = await Promise.all([
    supabase
      .from('boss_profiles')
      .select('id, name, traits, note, created_at')
      .order('created_at', { ascending: true }),
    supabase
      .from('outcome_records')
      .select('id, profile_id, situation, message, candidate_type, outcome, created_at')
      .order('created_at', { ascending: false })
      .limit(200),
  ]);

  return (
    <HonneApp
      userEmail={user.email ?? ''}
      initialProfiles={profiles ?? []}
      initialRecords={records ?? []}
    />
  );
}
