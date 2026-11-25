import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "HAFFYE — Coffee on the Move.",
    short_name: "HAFFYE",
    description:
      "Smart mobile coffee platform. Discover nearby carts, order ahead, and track your brew live.",
    start_url: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#FFFDF9",
    theme_color: "#3B2418",
    icons: [
      {
        src: "/icons/icon-192.png",
        sizes: "192x192",
        type: "image/png",
      },
      {
        src: "/icons/icon-512.png",
        sizes: "512x512",
        type: "image/png",
      },
      {
        src: "/icons/icon-maskable-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
      {
        src: "/icons/icon.svg",
        sizes: "any",
        type: "image/svg+xml",
      },
    ],
  };
}
