/**
 * Supabase client — loaded via CDN, configured from meta tags or env.
 *
 * Pages should include:
 *   <script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/dist/umd/supabase.min.js"></script>
 *   <meta name="supabase-url" content="...">
 *   <meta name="supabase-anon-key" content="...">
 */

const SUPABASE_URL = document.querySelector('meta[name="supabase-url"]')?.content;
const SUPABASE_ANON_KEY = document.querySelector('meta[name="supabase-anon-key"]')?.content;

let _supabase = null;

function getSupabase() {
  if (_supabase) return _supabase;
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    throw new Error('Missing Supabase config. Add meta tags: supabase-url, supabase-anon-key');
  }
  _supabase = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  return _supabase;
}

async function getSession() {
  const sb = getSupabase();
  const { data: { session } } = await sb.auth.getSession();
  return session;
}

async function getUser() {
  const session = await getSession();
  return session?.user || null;
}

async function signInWithGoogle() {
  const sb = getSupabase();
  const { error } = await sb.auth.signInWithOAuth({
    provider: 'google',
    options: { redirectTo: window.location.origin + '/onboard' }
  });
  if (error) throw error;
}

async function signOut() {
  const sb = getSupabase();
  await sb.auth.signOut();
}
