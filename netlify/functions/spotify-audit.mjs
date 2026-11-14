export default async (req) => {
  const id = process.env.SPOTIFY_CLIENT_ID;
  const secret = process.env.SPOTIFY_CLIENT_SECRET;
  const refresh = process.env.SPOTIFY_REFRESH_TOKEN;
  if (!id || !secret || !refresh) return json({ error: "credentials not set" });

  const pid = new URL(req.url).searchParams.get("id");
  if (!pid) return json({ error: "pass ?id=<playlistId>" });

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
    const tok = await tr.json();
    const auth = { authorization: "Bearer " + tok.access_token };

    const tests = {
      tracksPlain: "https://api.spotify.com/v1/playlists/" + pid + "/tracks?limit=5",
      tracksFields: "https://api.spotify.com/v1/playlists/" + pid + "/tracks?limit=5&fields=items(track(name))",
      playlistObj: "https://api.spotify.com/v1/playlists/" + pid,
      mePlaylists: "https://api.spotify.com/v1/me/playlists?limit=1",
      meProfile: "https://api.spotify.com/v1/me"
    };

    const out = {};
    for (const k of Object.keys(tests)) {
      const r = await fetch(tests[k], { headers: auth });
      const body = (await r.text()).slice(0, 220);
      out[k] = { status: r.status, body: body };
    }
    out.scope = tok.scope || "(not reported)";
    return json(out);
  } catch (e) {
    return json({ error: String(e.message || e) });
  }
};

function json(b) {
  return new Response(JSON.stringify(b), {
    headers: { "content-type": "application/json", "cache-control": "no-store" }
  });
}
