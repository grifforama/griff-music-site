export default async () => {
  const id = process.env.SPOTIFY_CLIENT_ID;
  const secret = process.env.SPOTIFY_CLIENT_SECRET;
  const refresh = process.env.SPOTIFY_REFRESH_TOKEN;
  if (!id || !secret || !refresh) {
    return json({ map: {}, error: "SPOTIFY_REFRESH_TOKEN not set yet" });
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
    if (!tr.ok) throw new Error("token " + tr.status + " " + (await tr.text()).slice(0, 150));
    const token = (await tr.json()).access_token;

    const map = {};
    let url = "https://api.spotify.com/v1/me/playlists?limit=50";
    while (url) {
      const r = await fetch(url, { headers: { authorization: "Bearer " + token } });
      if (!r.ok) throw new Error("playlists " + r.status + " " + (await r.text()).slice(0, 150));
      const d = await r.json();
      for (const p of d.items || []) {
        if (p && p.name && p.id) map[norm(p.name)] = p.id;
      }
      url = d.next;
    }
    return json({ map, count: Object.keys(map).length });
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
