export default async (req) => {
  const id = process.env.SPOTIFY_CLIENT_ID;
  const secret = process.env.SPOTIFY_CLIENT_SECRET;
  const refresh = process.env.SPOTIFY_REFRESH_TOKEN;
  if (!id || !secret || !refresh) return json({ error: "credentials not set" });

  const u = new URL(req.url);
  const mode = u.searchParams.get("mode") || "list";

  try {
    const tr = await fetch("https://accounts.spotify.com/api/token", {
      method: "POST",
      headers: {
        "content-type": "application/x-www-form-urlencoded",
        authorization: "Basic " + Buffer.from(id + ":" + secret).toString("base64")
      },
      body: new URLSearchParams({ grant_type: "refresh_token", refresh_token: refresh }).toString()
    });
    if (!tr.ok) throw new Error("token " + tr.status);
    const auth = { authorization: "Bearer " + (await tr.json()).access_token };

    if (mode === "list") {
      const offset = parseInt(u.searchParams.get("offset") || "0", 10);
      const r = await fetch("https://api.spotify.com/v1/me/playlists?limit=50&offset=" + offset, { headers: auth });
      if (!r.ok) throw new Error("list " + r.status);
      const d = await r.json();
      return json({
        total: d.total,
        items: (d.items || []).filter(Boolean).map(p => ({
          id: p.id,
          name: p.name,
          owner: p.owner && p.owner.id,
          tracks: p.tracks && p.tracks.total,
          desc: (p.description || "").slice(0, 60)
        }))
      });
    }

    const ids = (u.searchParams.get("ids") || "").split(",").filter(Boolean).slice(0, 6);
    const out = [];
    for (const pid of ids) {
      const f = "items(track(name,artists(name),album(name,id,total_tracks,release_date)))";
      const r = await fetch("https://api.spotify.com/v1/playlists/" + pid + "/tracks?limit=50&fields=" + encodeURIComponent(f), { headers: auth });
      if (!r.ok) { out.push({ id: pid, error: r.status }); continue; }
      const d = await r.json();
      const tracks = (d.items || []).map(i => i && i.track).filter(Boolean);
      const artists = [...new Set(tracks.flatMap(t => (t.artists || []).map(a => a.name)))];
      const albums = [...new Set(tracks.map(t => t.album && t.album.name).filter(Boolean))];
      const first = tracks[0] && tracks[0].album;
      out.push({
        id: pid, n: tracks.length,
        artistCount: artists.length, artists: artists.slice(0, 4),
        albumCount: albums.length, album: albums[0] || null,
        albumId: first ? first.id : null,
        albumTotal: first ? first.total_tracks : null,
        release: first ? first.release_date : null
      });
    }
    return json({ items: out });
  } catch (e) {
    return json({ error: String(e.message || e) });
  }
};

function json(b) {
  return new Response(JSON.stringify(b), {
    headers: { "content-type": "application/json", "cache-control": "no-store" }
  });
}
