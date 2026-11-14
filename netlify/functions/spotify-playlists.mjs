export default async () => {
  const id = process.env.SPOTIFY_CLIENT_ID;
  const secret = process.env.SPOTIFY_CLIENT_SECRET;
  const refresh = process.env.SPOTIFY_REFRESH_TOKEN;
  if (!id || !secret || !refresh) {
    return json({ map: {}, error: "SPOTIFY_REFRESH_TOKEN not set" });
  }

  try {
    const tr = await fetch("https://accounts.spotify.com/api/token", {
      method: "POST",
      headers: {
        "content-type": "application/x-www-form-urlencoded",
        authorization: "Basic " + Buffer.from(id + ":" + secret).toString("base64")
      },
      body: new URLSearchParams({
        grant_type: "refresh_token",
        refresh_token: refresh
      }).toString()
    });
    if (!tr.ok) throw new Error("token " + tr.status);
    const token = (await tr.json()).access_token;
    const auth = { authorization: "Bearer " + token };

    const map = {};
    const limit = 50;
    let offset = 0;
    let total = null;
    let pages = 0;

    while (pages < 40) {
      const url = "https://api.spotify.com/v1/me/playlists?limit=" + limit + "&offset=" + offset;
      const r = await fetch(url, { headers: auth });
      if (!r.ok) break;
      const d = await r.json();
      if (total === null) total = d.total;
      const items = (d.items || []).filter(Boolean);
      for (const p of items) {
        if (p.name && p.id) map[norm(p.name)] = p.id;
      }
      pages++;
      offset += limit;
      if (items.length === 0 || offset >= (total || 0)) break;
    }

    return json({ map, count: Object.keys(map).length, total: total, pages: pages });
  } catch (e) {
    return json({ map: {}, error: String(e.message || e) });
  }
};

function norm(s) {
  return String(s).toLowerCase().replace(/\s+/g, " ").trim();
}

function json(b) {
  return new Response(JSON.stringify(b), {
    headers: { "content-type": "application/json", "cache-control": "public, max-age=0, s-maxage=600" }
  });
}
