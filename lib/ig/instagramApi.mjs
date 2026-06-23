// lib/ig/instagramApi.mjs
// Thin wrapper over the Instagram Graph API (Business/Creator accounts).

const V = process.env.IG_GRAPH_VERSION || 'v21.0';

// Fetch recent media for an IG business user id.
export async function fetchMedia(igUserId, token, limit) {
  const fields = 'id,caption,media_type,media_url,thumbnail_url,permalink,timestamp';
  const url =
    `https://graph.facebook.com/${V}/${igUserId}/media` +
    `?fields=${fields}&limit=${limit || 50}&access_token=${encodeURIComponent(token)}`;
  const res = await fetch(url);
  let j = {};
  try { j = await res.json(); } catch { /* ignore */ }
  if (!res.ok || j.error) {
    const err = new Error((j.error && j.error.message) || 'Instagram API ' + res.status);
    err.status = res.status;
    err.igError = j.error || null;
    throw err;
  }
  return j.data || [];
}

// Pick a usable image URL for a media item.
export function mediaImage(m) {
  if (m.media_type === 'VIDEO') return m.thumbnail_url || m.media_url || '';
  // IMAGE and CAROUSEL_ALBUM expose media_url (the first child for albums).
  return m.media_url || m.thumbnail_url || '';
}

// OPTIONAL: refresh a long-lived Facebook user/page token (valid ~60 days).
// Requires FB_APP_ID / FB_APP_SECRET. Returns { access_token, expires_in }.
export async function refreshToken(token) {
  const url =
    `https://graph.facebook.com/${V}/oauth/access_token` +
    `?grant_type=fb_exchange_token&client_id=${process.env.FB_APP_ID}` +
    `&client_secret=${process.env.FB_APP_SECRET}&fb_exchange_token=${encodeURIComponent(token)}`;
  const res = await fetch(url);
  const j = await res.json();
  if (!res.ok || j.error) throw new Error('Token refresh failed: ' + ((j.error && j.error.message) || res.status));
  return j;
}
