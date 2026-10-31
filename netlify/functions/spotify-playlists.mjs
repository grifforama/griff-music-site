// netlify/functions/spotify-playlists.mjs
//
// Returns { "playlist name in lowercase": "spotifyPlaylistId" } for the
// playlists named in the ?names= query string (pipe-separated).
//
// Credentials come from Netlify environment variables, never the browser:
//   SPOTIFY_CLIENT_ID
//   SPOTIFY_CLIENT_SECRET

const SPOTIFY_USER = "grifforama";

export default async (req) => {
  const id = process.env.SPOTIFY_CLIENT_ID;
  const secret = process.env.SPOTIFY_CLIENT_SECRET;

  if (!id || !secret) {
    return json({ map: {}, error: "SPOTIFY_CLIENT_ID / SPOTIFY_CLIENT_SECRET not set" });
  }

  const names = (new URL(req.url).searchParams.get("names") || "")
    .split("|")
    .map((n) => n.trim())
    .filter(Boolean);

  const diagnostics = {};

  try {
    const token = await getToken(id, secret);

    // --- Strategy 1: the user's public playlists ---------------------------
    try {
      const map = {};
      let url = "https://api.spotify.com/v1/users/" +
        encodeURIComponent(SPOTIFY_USER) + "/playlists?limit=50";
      while (url) {
        const res = await fetch(url, { headers: { authorization: "Bearer " + token } });
        if (!res.ok) throw new Error("status " + res.status);
        const data = await res.json();
        for (const p of data.items || []) {
          if (p && p.name && p.id) map[normalize(p.name)] = p.id;
        }
        url = data.next;
      }
      diagnostics.listPlaylists = "ok (" + Object.keys(map).length + ")";
      if (Object.keys(map).length) return json({ map, via: "list", diagnostics });
    } catch (e) {
      diagnostics.listPlaylists = "failed: " + (e.message || e);
    }

    // --- Strategy 2: search for each requested name ------------------------
    if (!names.length) {
      return json({ map: {}, via: "search", diagnostics, error: "no names supplied" });
    }

    const map = {};
    for (const name of names) {
      try {
        const url = "https://api.spotify.com/v1/search?type=playlist&limit=20&q=" +
          encodeURIComponent(name);
        const res = await fetch(url, { headers: { authorization: "Bearer " + token } });
        if (!res.ok) {
          diagnostics.search = diagnostics.search || ("failed: status " + res.status);
          break;
        }
        const data = await res.json();
        const items = ((data.playlists && data.playlists.items) || []).filter(Boolean);
        const wanted = normalize(name);

        const mine = items.filter(
          (p) => p.owner && String(p.owner.id || "").toLowerCase() === SPOTIFY_USER.toLowerCase()
        );
        const hit = mine.find((p) => normalize(p.name) === wanted) || mine[0];
        if (hit && hit.id) map[wanted] = hit.id;
      } catch (e) {
        diagnostics.search = diagnostics.search || ("failed: " + (e.message || e));
        break;
      }
    }
    if (!diagnostics.search) {
      diagnostics.search = "ok (" + Object.keys(map).length + "/" + names.length + ")";
    }

    return json({ map, via: "search", diagnostics });
  } catch (err) {
    return json({ map: {}, error: String((err && err.message) || err), diagnostics });
  }
};

async function getToken(id, secret) {
  const res = await fetch("https://accounts.spotify.com/api/token", {
    method: "POST",
    headers: {
      "content-type": "application/x-www-form-urlencoded",
      authorization: "Basic " + Buffer.from(id + ":" + secret).toString("base64")
    },
    body: "grant_type=client_credentials"
  });
  if (!res.ok) throw new Error("token request failed: " + res.status);
  const token = (await res.json()).access_token;
  if (!token) throw new Error("no access token returned");
  return token;
}

function normalize(s) {
  return String(s).toLowerCase().replace(/\s+/g, " ").trim();
}

function json(body) {
  return new Response(JSON.stringify(body), {
    headers: {
      "content-type": "application/json",
      "cache-control": "public, max-age=0, s-maxage=3600"
    }
  });
}
