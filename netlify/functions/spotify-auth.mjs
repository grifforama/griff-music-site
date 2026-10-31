const REDIRECT = "https://griffs-record-collection.netlify.app/.netlify/functions/spotify-auth";
const SCOPES = "playlist-read-private playlist-read-collaborative";

export default async (req) => {
  const id = process.env.SPOTIFY_CLIENT_ID;
  const secret = process.env.SPOTIFY_CLIENT_SECRET;
  if (!id || !secret) return html("Missing SPOTIFY_CLIENT_ID or SPOTIFY_CLIENT_SECRET.");

  const code = new URL(req.url).searchParams.get("code");
  if (!code) {
    const auth = "https://accounts.spotify.com/authorize?response_type=code" +
      "&client_id=" + encodeURIComponent(id) +
      "&scope=" + encodeURIComponent(SCOPES) +
      "&redirect_uri=" + encodeURIComponent(REDIRECT);
    return Response.redirect(auth, 302);
  }

  const res = await fetch("https://accounts.spotify.com/api/token", {
    method: "POST",
    headers: {
      "content-type": "application/x-www-form-urlencoded",
      authorization: "Basic " + Buffer.from(id + ":" + secret).toString("base64")
    },
    body: new URLSearchParams({
      grant_type: "authorization_code",
      code: code,
      redirect_uri: REDIRECT
    }).toString()
  });
  const data = await res.json();
  if (!res.ok || !data.refresh_token) {
    return html("Failed: " + JSON.stringify(data).slice(0, 400));
  }
  return html(
    "<h2>Success</h2><p>Copy this into Netlify as <b>SPOTIFY_REFRESH_TOKEN</b>:</p>" +
    "<textarea rows='4' cols='70' style='font-size:14px'>" + data.refresh_token + "</textarea>"
  );
};

function html(body) {
  return new Response(
    "<html><body style='font-family:system-ui;padding:40px;line-height:1.5'>" + body + "</body></html>",
    { headers: { "content-type": "text/html; charset=utf-8" } }
  );
}
