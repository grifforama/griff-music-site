// netlify/functions/spotify-playlists.mjs
const SPOTIFY_USER = "grifforama";

export default async (req) => {
  const id = process.env.SPOTIFY_CLIENT_ID;
  const secret = process.env.SPOTIFY_CLIENT_SECRET;
  if (!id || !secret) {
    return json({ map: {}, error: "SPOTIFY_CLIENT_ID / SPOTIFY_CLIENT_SECRET not set" });
  }

  const names = (new URL(req.url).searchParams.get("names") || "")
    .split("|").map((n) => n.trim()).filter(Boolean);

  const diagnostics = {};

  try {
    const token = await getToken(id, secret);
    const auth = { authorization: "Bearer " + token };
    const base = "https://api.spotify.com/v1/search";

    // Does search work at all with this token?
    const sanity = await fetch(base + "?type=track&q=abba", { headers: auth });
    diagnostics.searchTrackSanity = sanity.ok
      ? "ok" : "status " + sanity.status + " — " + (await sanity.text()).slice(0, 200);

    if (!names.length) return json({ map: {}, diagnostics, error: "no names supplied" });

    const variants = [
      (q) => base + "?type=playlist&q=" + encodeURIComponent(q),
      (q) => base + "?q=" + encodeURIComponent(q) + "&type=playlist",
      (q) => base + "?type=playlist&q=" + encodeURIComponent(q) + "&limit=10",
      (q) => base + "?type=playlist&q=" + encodeURIComponent(q) + "&market=US"
    ];

    let working = null;
    for (let v = 0; v < variants.length && working === null; v++) {
      const probe = await fetch(variants[v](names[0]), { headers: auth });
      diagnostics["variant" + v] = probe.ok
        ? "ok" : "status " + probe.status + " — " + (await probe.text()).slice(0, 200);
      if (probe.ok) working =
