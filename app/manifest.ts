import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    id: "/",

    name: "KTown Triangle",

    short_name: "KTT",

    start_url: "/",

    scope: "/",

    display: "standalone",

    background_color: "#F8F3EC",

    theme_color: "#172033",

    icons: [
      {
        src: "/icon-512.png",
        sizes: "512x512",
        type: "image/png",
      },
    ],

    related_applications: [
      {
        platform: "webapp",
        url: "/manifest.webmanifest",
        id: "/",
      },
    ],
  };
}