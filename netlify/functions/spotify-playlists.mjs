// netlify/functions/spotify-playlists.mjs
//
// Returns a { "playlist name in lowercase": "spotifyPlaylistId" } map built from
// the public playlists on a Spotify account. The playlists page uses it to link
// each card straight to its Spotify twin instead of a search page.
//
// Credentials come from Netlify environment variables and never reach the browser:
//   SPOTIFY_CLIENT_ID
//   SPOTIFY_CLIENT_SECRET
//
// Any failure returns an empty map rather than an error status, so the page
// quietly falls back to its built-in map / search links instead of breaking.

const SPOTIFY_USER = "grifforama";

export default async () => {
  const id = process.env.SPOTIFY_CLIENT_ID;
  const secret = process.env.SPOTIFY_CLIENT_SECRET;

  if (!id || !secret) {
    return json({ map: {}, error: "SPOTIFY_CLIENT_ID / SPOTIFY_CLIENT_SECRET not set" });
  }

  try {
    // 1. App token (client credentials — no user login involved)
    const tokenRes = await fetch("https://accounts.spotify.com/api/token", {
      method: "POST",
      headers: {
        "content-type": "application/x-www-form-urlencoded",
        authorization: "Basic " + Buffer.from(id + ":" + secret).toString("base64")
      },
      body: "grant_type=client_credentials"
    });
    if (!tokenRes.ok) throw new Error("token request failed: " + tokenRes.status);
    const token = (await tokenRes.json()).access_token;
    if (!token) throw new Error("no access token returned");

    // 2. Walk the user's public playlists
    const map = {};
    let url = "https://api.spotify.com/v1/users/" +
      encodeURIComponent(SPOTIFY_USER) + "/playlists?limit=50";

    while (url) {
      const res = await fetch(url, { headers: { authorization: "Bearer " + token } });
      if (!res.ok) throw new Error("playlists request failed: " + res.status);
      const data = await res.json();
      for (const p of data.items || []) {
        if (p && p.name && p.id) map[normalize(p.name)] = p.id;
      }
      url = data.next;
    }

    return json({ map, count: Object.keys(map).length });
  } catch (err) {
    return json({ map: {}, error: String((err && err.message) || err) });
  }
};

// Must match the normalisation the page uses when looking names up.
function normalize(s) {
  return String(s).toLowerCase().replace(/\s+/g, " ").trim();
}

function json(body) {
  return new Response(JSON.stringify(body), {
    headers: {
      "content-type": "application/json",
      // cached at Netlify's edge for an hour so Spotify isn't hit per visitor
      "cache-control": "public, max-age=0, s-maxage=3600"
    }
  });
}
