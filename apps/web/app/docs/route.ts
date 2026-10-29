// Scalar API reference, loaded from a pinned CDN build and pointed at our OpenAPI spec.
// Themed with the site's palette (src/styles/globals.css) so /docs feels like part of 3otla.
const SCALAR = "https://cdn.jsdelivr.net/npm/@scalar/api-reference@1.76.0";

const css = `
:root { --scalar-font: "Readex Pro", ui-sans-serif, system-ui, sans-serif; --scalar-radius: 0.5rem; --scalar-radius-lg: 0.875rem; }
.light-mode {
  --scalar-background-1: #fffaf1; --scalar-background-2: #f4eee3; --scalar-background-3: #ece2d1;
  --scalar-background-accent: #2f3fce1a;
  --scalar-color-1: #1e1b16; --scalar-color-2: #4f473b; --scalar-color-3: #6c6253;
  --scalar-color-accent: #2f3fce; --scalar-border-color: #ddd0ba;
  --scalar-sidebar-background-1: #f4eee3; --scalar-sidebar-color-active: #2f3fce;
  --scalar-sidebar-item-active-background: #2f3fce14; --scalar-sidebar-border-color: #ddd0ba;
}
.dark-mode {
  --scalar-background-1: #0c0f1e; --scalar-background-2: #141a2f; --scalar-background-3: #1c2340;
  --scalar-background-accent: #8d98ff1f;
  --scalar-color-1: #f2ece1; --scalar-color-2: #cfc7b9; --scalar-color-3: #a39b8d;
  --scalar-color-accent: #8d98ff; --scalar-border-color: #2a3254;
  --scalar-sidebar-background-1: #0c0f1e; --scalar-sidebar-color-active: #8d98ff;
  --scalar-sidebar-item-active-background: #8d98ff1f; --scalar-sidebar-border-color: #2a3254;
}
.otla-bar { display: flex; align-items: center; gap: 0.75rem; height: 3rem; padding-inline: 1rem;
  font: 500 14px/1 var(--scalar-font); background: #1b2486; color: #fffaf1; }
.otla-bar a { color: inherit; text-decoration: none; display: inline-flex; align-items: center; min-height: 2.75rem; }
.otla-bar a:hover { text-decoration: underline; text-underline-offset: 4px; }
.otla-bar a:focus-visible { outline: 2px solid #fffaf1; outline-offset: 2px; border-radius: 4px; }
.otla-bar .spacer { margin-inline-start: auto; }
`;

const html = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>API reference · 3otla — Moroccan holidays</title>
    <meta name="description" content="Free, open API for Moroccan public and school holidays: dates with their status and official sources, in Arabic, French and English. No API key." />
    <link rel="icon" href="/icon" />
    <link rel="preconnect" href="https://fonts.googleapis.com" />
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
    <link href="https://fonts.googleapis.com/css2?family=Readex+Pro:wght@400;500;600&display=swap" rel="stylesheet" />
    <style>${css}</style>
  </head>
  <body>
    <nav class="otla-bar" aria-label="3otla">
      <a href="/">← 3otla · <bdi lang="ar">عطلة</bdi></a>
      <a class="spacer" href="/api/openapi.json">openapi.json</a>
      <a href="https://github.com/Piipas/3otla">GitHub</a>
    </nav>
    <div id="app"></div>
    <script src="${SCALAR}"></script>
    <script>
      Scalar.createApiReference("#app", {
        url: "/api/openapi.json",
        theme: "none",
        withDefaultFonts: false,
        favicon: "/icon",
        defaultHttpClient: { targetKey: "shell", clientKey: "curl" },
        hiddenClients: { c: true, clojure: true, csharp: ["restsharp"], kotlin: true, objc: true, ocaml: true, r: true },
        documentDownloadType: "json",
        hideModels: false,
        defaultOpenAllTags: true,
        metaData: { title: "3otla API reference" },
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
