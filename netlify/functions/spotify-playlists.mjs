export default async () => {
  const id = process.env.SPOTIFY_CLIENT_ID;
  const secret = process.env.SPOTIFY_CLIENT_SECRET;
  const refresh = process.env.SPOTIFY_REFRESH_TOKEN;
  if (!id || !secret || !refresh) return fail("credentials not set");

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
    if (!tr.ok) return fail("token " + tr.status);
    const auth = { authorization: "Bearer " + (await tr.json()).access_token };

    const map = {};
    const limit = 50;
    let offset = 0, total = null, pages = 0;

    while (pages < 40) {
      const r = await fetch("https://api.spotify.com/v1/me/playlists?limit=" + limit + "&offset=" + offset, { headers: auth });
      if (r.status === 429) return fail("rate limited (retry-after " + (r.headers.get("retry-after") || "?") + "s)");
      if (!r.ok) return fail("playlists " + r.status);
      const d = await r.json();
      if (total === null) total = d.total;
      const items = (d.items || []).filter(Boolean);
      for (const p of items) if (p.name && p.id) map[norm(p.name)] = p.id;
      pages++;
      offset += limit;
      if (items.length === 0 || offset >= (total || 0)) break;
      await sleep(120);
    }

    if (offset < (total || 0)) return fail("incomplete read " + offset + "/" + total);

    return new Response(JSON.stringify({ map, count: Object.keys(map).length, total, pages }), {
      headers: { "content-type": "application/json", "cache-control": "public, max-age=0, s-maxage=900" }
    });
  } catch (e) {
    return fail(String(e.message || e));
  }
};

function fail(msg) {
  return new Response(JSON.stringify({ map: {}, error: msg }), {
    status: 200,
    headers: { "content-type": "application/json", "cache-control": "no-store" }
  });
}

function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}

function norm(s) {
  return String(s).toLowerCase().replace(/\s+/g, " ").trim();
}
