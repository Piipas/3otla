// Scalar API reference, loaded from a pinned CDN build and pointed at our OpenAPI spec.
const SCALAR = "https://cdn.jsdelivr.net/npm/@scalar/api-reference@1.76.0";

const html = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>3otla API — Moroccan holidays</title>
    <meta name="description" content="Free, open API for Moroccan public holidays: national and religious, with status and official sources." />
  </head>
  <body>
    <div id="app"></div>
    <script src="${SCALAR}"></script>
    <script>
      Scalar.createApiReference("#app", {
        url: "/api/openapi.json",
        defaultHttpClient: { targetKey: "shell", clientKey: "curl" },
      });
    </script>
  </body>
</html>`;

export const dynamic = "force-static";

export function GET() {
  return new Response(html, {
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": "public, max-age=3600, s-maxage=86400",
    },
  });
}
