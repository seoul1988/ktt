import type { MetadataRoute } from "next";

type KTownManifest = MetadataRoute.Manifest & {
  share_target: {
    action: string;
    method: "GET";
    enctype: "application/x-www-form-urlencoded";
    params: {
      title: string;
      text: string;
      url: string;
    };
  };
};

export default function manifest(): KTownManifest {
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
        src: "/icon-192.png",
        sizes: "192x192",
        type: "image/png",
      },
      {
        src: "/icon-512.png",
        sizes: "512x512",
        type: "image/png",
      },
    ],

    share_target: {
      action: "/share/news",
      method: "GET",
      enctype: "application/x-www-form-urlencoded",
      params: {
        title: "title",
        text: "text",
        url: "url",
      },
    },

    related_applications: [
      {
        platform: "webapp",
        url: "/manifest.webmanifest",
        id: "/",
      },
    ],
  };
}