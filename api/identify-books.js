import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Verify auth
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const token = authHeader.replace('Bearer ', '');
  const anonClient = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_ANON_KEY
  );
  const { data: { user }, error: authErr } = await anonClient.auth.getUser(token);
  if (authErr || !user) {
    return res.status(401).json({ error: 'Invalid token' });
  }

  // Get user's unprocessed photos
  const { data: photos, error: photoErr } = await supabase
    .from('user_photos')
    .select('id, storage_path')
    .eq('user_id', user.id)
    .eq('processed', false);

  if (photoErr || !photos?.length) {
    return res.status(400).json({ error: 'No photos to process' });
  }

  // Download photos and convert to base64
  const imageData = [];
  for (const photo of photos) {
    const { data, error } = await supabase.storage
      .from('bookshelf-photos')
      .download(photo.storage_path);
    if (error) continue;
    const buffer = Buffer.from(await data.arrayBuffer());
    const base64 = buffer.toString('base64');
    const mimeType = photo.storage_path.endsWith('.png') ? 'image/png' : 'image/jpeg';
    imageData.push({ base64, mimeType });
  }

  if (!imageData.length) {
    return res.status(400).json({ error: 'Could not download photos' });
  }

  // Call Gemini Flash
  const parts = [];
  for (const img of imageData) {
    parts.push({
      inlineData: { mimeType: img.mimeType, data: img.base64 }
    });
  }
  parts.push({
    text: 'Look at these bookshelf photos. List every book title and author you can identify. Return ONLY a JSON array of objects with "title" and "author" fields. If you cannot identify the author, use an empty string. Example: [{"title":"Sapiens","author":"Yuval Noah Harari"}]. Return ONLY the JSON array, no markdown, no explanation.'
  });

  try {
    const geminiRes = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-lite:generateContent?key=${process.env.GEMINI_API_KEY}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts }],
          generationConfig: { temperature: 0.1, maxOutputTokens: 4096 }
        })
      }
    );

    if (!geminiRes.ok) {
      const errText = await geminiRes.text();
      console.error('Gemini error:', geminiRes.status, errText);
      return res.status(500).json({ error: 'AI identification failed', status: geminiRes.status, detail: errText });
    }

    const geminiData = await geminiRes.json();
    let text = geminiData.candidates?.[0]?.content?.parts?.[0]?.text || '';

    // Strip markdown code fences if present
    text = text.replace(/```json\s*/g, '').replace(/```\s*/g, '').trim();

    let books;
    try {
      books = JSON.parse(text);
    } catch {
      console.error('Failed to parse Gemini response:', text);
      return res.status(500).json({ error: 'Failed to parse AI response' });
    }

    if (!Array.isArray(books)) {
      return res.status(500).json({ error: 'Invalid AI response format' });
    }

    // Deduplicate by title (case-insensitive)
    const seen = new Set();
    books = books.filter(b => {
      const key = (b.title || '').toLowerCase().trim();
      if (!key || seen.has(key)) return false;
      seen.add(key);
      return true;
    });

    // Mark photos as processed
    const photoIds = photos.map(p => p.id);
    await supabase
      .from('user_photos')
      .update({ processed: true })
      .in('id', photoIds);

    return res.status(200).json({ books });
  } catch (err) {
    console.error('Identify books error:', err);
    return res.status(500).json({ error: 'Processing failed' });
  }
}

export const config = {
  maxDuration: 60
};
