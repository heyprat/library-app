/**
 * OpenLibrary cover search utility.
 * Searches by title+author and returns the best cover URL.
 */

async function searchCover(title, author) {
  const q = encodeURIComponent((title + ' ' + (author || '')).trim());
  const url = 'https://openlibrary.org/search.json?q=' + q + '&limit=3&fields=cover_i,title,author_name';
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    const data = await res.json();
    if (data.docs && data.docs.length > 0) {
      const doc = data.docs.find(d => d.cover_i) || data.docs[0];
      if (doc && doc.cover_i) {
        return 'https://covers.openlibrary.org/b/id/' + doc.cover_i + '-M.jpg';
      }
    }
  } catch (e) {
    console.warn('OpenLibrary search failed for:', title, e);
  }
  return null;
}

/**
 * Batch fetch covers for an array of books [{t, a}, ...].
 * Adds `c` property with cover URL. Batches 5 at a time with 200ms delays.
 */
async function fetchCovers(books) {
  const batch = 5;
  for (let i = 0; i < books.length; i += batch) {
    const chunk = books.slice(i, i + batch);
    await Promise.all(chunk.map(async (book) => {
      if (book.c) return; // already has cover
      const url = await searchCover(book.t, book.a);
      if (url) book.c = url;
    }));
    if (i + batch < books.length) {
      await new Promise(r => setTimeout(r, 200));
    }
  }
  return books;
}
