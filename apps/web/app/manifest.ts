import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "3otla — عطلة · Jours fériés au Maroc",
    short_name: "3otla",
    description: "Moroccan public holidays with status and official sources.",
    start_url: "/",
    display: "standalone",
    background_color: "#f4eee3",
    theme_color: "#2f3fce",
    icons: [
      { src: "/icon/192", sizes: "192x192", type: "image/png" },
      { src: "/icon/512", sizes: "512x512", type: "image/png" },
      { src: "/icon/512", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
