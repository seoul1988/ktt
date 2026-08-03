import type { CSSProperties } from "react";

export type PublicBanner = {
  id: number;
  banner_type:
    | "announcement"
    | "hero"
    | "coupon"
    | "image"
    | "split"
    | "popup";
  title: string;
  subtitle: string | null;
  button_text: string | null;
  link_url: string | null;
  image_url: string | null;
  background_color: string;
  text_color: string;
  button_color: string;
  button_text_color: string;
};

type Props = {
  banners: PublicBanner[];
};

export default function BusinessBannerRenderer({
  banners,
}: Props) {
  if (!banners.length) return null;

  return (
    <div className="space-y-4">
      {banners
        .filter(
          (banner) =>
            banner.banner_type !== "popup",
        )
        .map((banner) => {
          const style: CSSProperties = {
            backgroundColor:
              banner.background_color,
            color: banner.text_color,
          };

          return (
            <section
              key={banner.id}
              className={`overflow-hidden rounded-2xl ${
                banner.banner_type ===
                "announcement"
                  ? "px-4 py-3"
                  : banner.banner_type === "split"
                    ? "grid md:grid-cols-2"
                    : ""
              }`}
              style={style}
            >
              {banner.image_url &&
                banner.banner_type !==
                  "announcement" && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={banner.image_url}
                    alt={banner.title}
                    className={`w-full object-cover ${
                      banner.banner_type === "split"
                        ? "h-full min-h-56"
                        : "max-h-[440px]"
                    }`}
                  />
                )}

              <div className="p-5 sm:p-7">
                <h2 className="text-2xl font-black">
                  {banner.title}
                </h2>

                {banner.subtitle && (
                  <p className="mt-2 text-sm font-medium leading-6 opacity-90">
                    {banner.subtitle}
                  </p>
                )}

                {banner.button_text &&
                  banner.link_url && (
                    <a
                      href={banner.link_url}
                      className="mt-4 inline-flex rounded-xl px-4 py-2.5 text-sm font-black"
                      style={{
                        backgroundColor:
                          banner.button_color,
                        color:
                          banner.button_text_color,
                      }}
                    >
                      {banner.button_text}
                    </a>
                  )}
              </div>
            </section>
          );
        })}
    </div>
  );
}
