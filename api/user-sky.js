import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

export default async function handler(req, res) {
  const { username } = req.query;

  if (!username) {
    return res.status(400).json({ error: 'Username required' });
  }

  // Look up user
  const { data: user, error: userErr } = await supabase
    .from('users')
    .select('id, username, display_name')
    .eq('username', username)
    .single();

  if (userErr || !user) {
    return res.status(404).json({ error: 'User not found' });
  }

  // Fetch their books
  const { data: books, error: booksErr } = await supabase
    .from('user_books')
    .select('title, author, genre, cover_url')
    .eq('user_id', user.id)
    .order('sort_order', { ascending: true });

  if (booksErr) {
    return res.status(500).json({ error: 'Failed to load books' });
  }

  // Transform to sky format
  const skyBooks = books.map(b => ({
    t: b.title,
    a: b.author || '',
    g: b.genre || '',
    ...(b.cover_url ? { c: b.cover_url } : {})
  }));

  res.setHeader('Cache-Control', 's-maxage=60, stale-while-revalidate=300');
  return res.status(200).json({
    username: user.username,
    displayName: user.display_name,
    books: skyBooks
  });
}
