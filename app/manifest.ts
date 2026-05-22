import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "KTown Triangle",

    short_name: "KTT",

    start_url: "/",

    display: "standalone",

    background_color: "#F8F3EC",

    theme_color: "#172033",

    icons: [
      {
        src: "/logo.png",
        sizes: "512x512",
        type: "image/png",
      },
    ],
  };
}