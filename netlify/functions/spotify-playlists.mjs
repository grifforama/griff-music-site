const SPOTIFY_USER = "grifforama";

export default async (req) => {
  const id = process.env.SPOTIFY_CLIENT_ID;
  const secret = process.env.SPOTIFY_CLIENT_SECRET;
  if (!id || !secret) return json({ map: {}, error: "credentials not set" });

  const names = (new URL(req.url).searchParams.get("names") || "")
    .split("|").map(n => n.trim()).filter(Boolean);

  try {
    const res = await fetch("https://accounts.spotify.com/api/token", {
      method: "POST",
      headers: {
        "content-type": "application/x-www-form-urlencoded",
        authorization: "Basic " + Buffer.from(id + ":" + secret).toString("base64")
      },
      body: "grant_type=client_credentials"
    });
    if (!res.ok) throw new Error("token " + res.status);
    const token = (await res.json()).access_token;
    const auth = { authorization: "Bearer " + token };

    const map = {};
    let note = "";
    for (const name of names) {
      const url = "https://api.spotify.com/v1/search?type=playlist&q=" + encodeURIComponent(name);
      const r = await fetch(url, { headers: auth });
      if (!r.ok) { note = "search " + r.status + ": " + (await r.text()).slice(0, 150); break; }
      const data = await r.json();
      const items = ((data.playlists && data.playlists.items) || []).filter(Boolean);
      const want = norm(name);
      const mine = items.filter(p => p.owner && String(p.owner.id).toLowerCase() === SPOTIFY_USER);
      const hit = mine.find(p => norm(p.name) === want) || mine[0];
      if (hit) map[want] = hit.id;
    }
    return json({ map, note, resolved: Object.keys(map).length + "/" + names.length });
  } catch (e) {
    return json({ map: {}, error: String(e.message || e) });
  }
};

function norm(s) {
  return String(s).toLowerCase().replace(/\s+/g, " ").trim();
}

function json(body) {
  return new Response(JSON.stringify(body), {
    headers: { "content-type": "application/json", "cache-control": "public, max-age=0, s-maxage=3600" }
  });
}
