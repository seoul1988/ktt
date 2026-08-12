"use client";

import { useEffect, useMemo, useState } from "react";
import { usePathname } from "next/navigation";

type TextAlign = "left" | "center" | "right";
type ImageFit = "contain" | "cover" | "fill";

type DisplayLocation =
  | "all"
  | "home"
  | "community"
  | "events";

type PublicBanner = {
  id: number;
  title?: string | null;
  subtitle?: string | null;
  button_text?: string | null;
  link_url?: string | null;
  image_url?: string | null;

  background_color?: string | null;
  title_color?: string | null;
  subtitle_color?: string | null;
  button_color?: string | null;
  button_text_color?: string | null;

  title_font_size?: number | null;
  subtitle_font_size?: number | null;
  button_font_size?: number | null;

  title_font_weight?: number | null;
  subtitle_font_weight?: number | null;
  text_align?: TextAlign | null;

  popup_width?: number | null;
  popup_height?: number | null;
  popup_radius?: number | null;
  popup_shadow?: string | null;
  style_preset?: string | null;

  image_position?: string | null;
  image_fit?: ImageFit | null;
  image_zoom?: number | null;

  text_x?: number | null;
  text_y?: number | null;
  text_width?: number | null;

  title_x?: number | null;
  title_y?: number | null;
  title_width?: number | null;

  subtitle_x?: number | null;
  subtitle_y?: number | null;
  subtitle_width?: number | null;

  button_x?: number | null;
  button_y?: number | null;
  button_width?: number | null;
  button_height?: number | null;

  button_enabled?: boolean | null;
  hide_24h_enabled?: boolean | null;
  hide_days?: number | null;

  is_active?: boolean | null;

  display_location?: DisplayLocation | null;
  display_order?: number | null;

  starts_at?: string | null;
  ends_at?: string | null;
};

type ApiResponse = {
  banners?: PublicBanner[];
  error?: string;
};

const HIDE_PREFIX =
  "ktown_popup_hide_until_";

function pxShadow(
  name?: string | null,
) {
  switch (name) {
    case "none":
      return "none";

    case "small":
      return "0 8px 24px rgba(15,23,42,.16)";

    case "large":
      return "0 30px 90px rgba(15,23,42,.34)";

    case "glass":
      return "0 24px 70px rgba(15,23,42,.22), inset 0 1px 0 rgba(255,255,255,.65)";

    default:
      return "0 18px 50px rgba(15,23,42,.24)";
  }
}

function isHiddenFor24Hours(
  id: number,
) {
  if (
    typeof window === "undefined"
  ) {
    return false;
  }

  const raw =
    localStorage.getItem(
      `${HIDE_PREFIX}${id}`,
    );

  if (!raw) {
    return false;
  }

  const hideUntil =
    Number(raw);

  if (
    !Number.isFinite(hideUntil)
  ) {
    localStorage.removeItem(
      `${HIDE_PREFIX}${id}`,
    );

    return false;
  }

  if (
    Date.now() >= hideUntil
  ) {
    localStorage.removeItem(
      `${HIDE_PREFIX}${id}`,
    );

    return false;
  }

  return true;
}

function safeNumber(
  value: unknown,
  fallback: number,
) {
  const parsed =
    Number(value);

  return Number.isFinite(parsed)
    ? parsed
    : fallback;
}

function normalizeUrl(
  url?: string | null,
) {
  const value =
    String(url || "").trim();

  if (!value) {
    return "";
  }

  if (
    value.startsWith("/") ||
    value.startsWith("http://") ||
    value.startsWith("https://") ||
    value.startsWith("mailto:") ||
    value.startsWith("tel:")
  ) {
    return value;
  }

  return `https://${value}`;
}

/*
 * 현재 페이지가 어느 Display Location에
 * 속하는지 판별합니다.
 *
 * Community는 /community 아래의 모든 페이지를
 * 포함합니다.
 */
function currentDisplayLocation(
  pathname: string,
): Exclude<
  DisplayLocation,
  "all"
> | null {
  /*
   * HOME
   */
  if (pathname === "/") {
    return "home";
  }

  /*
   * COMMUNITY
   *
   * 포함:
   * /community
   * /community/map
   * /community/hub
   * /community/events
   * /community/manual
   * /community/search
   * /community/... 모든 하위 페이지
   */
  if (
    pathname === "/community" ||
    pathname.startsWith(
      "/community/",
    )
  ) {
    return "community";
  }

  /*
   * EVENTS
   */
  if (
    pathname === "/events" ||
    pathname.startsWith(
      "/events/",
    ) ||
    pathname ===
      "/business-events" ||
    pathname.startsWith(
      "/business-events/",
    ) ||
    pathname ===
      "/grand-openings" ||
    pathname.startsWith(
      "/grand-openings/",
    )
  ) {
    return "events";
  }

  /*
   * 위 그룹에 포함되지 않는 페이지에서는
   * 현재 popup 시스템을 표시하지 않습니다.
   */
  return null;
}

/*
 * Banner가 현재 페이지의 Display Location과
 * 일치하는지 확인합니다.
 *
 * all:
 * Home / Community / Events 모두 표시
 *
 * home:
 * 메인 홈만
 *
 * community:
 * /community 및 모든 하위 페이지
 *
 * events:
 * 이벤트 그룹
 */
function bannerMatchesLocation(
  banner: PublicBanner,
  location: Exclude<
    DisplayLocation,
    "all"
  > | null,
) {
  if (!location) {
    return false;
  }

  const target =
    banner.display_location;

  if (!target) {
    return false;
  }

  return (
    target === "all" ||
    target === location
  );
}

export default function KTownPopupBanner() {
  const pathname =
    usePathname();

  const [banners, setBanners] =
    useState<PublicBanner[]>(
      [],
    );

  const [
    currentIndex,
    setCurrentIndex,
  ] = useState(0);

  const [closed, setClosed] =
    useState(false);

  const [
    hideForPeriod,
    setHideForPeriod,
  ] = useState(false);

  const [loading, setLoading] =
    useState(true);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        setLoading(true);

        const pageLocation =
          currentDisplayLocation(
            pathname,
          );

        /*
         * Home / Community / Events 그룹에
         * 속하지 않는 페이지는 popup 조회 자체를
         * 하지 않습니다.
         */
        if (!pageLocation) {
          if (!cancelled) {
            setBanners([]);
            setCurrentIndex(0);
            setClosed(false);
            setHideForPeriod(false);
            setLoading(false);
          }

          return;
        }

        const response =
          await fetch(
            `/api/banners?location=${encodeURIComponent(
              pageLocation,
            )}`,
            {
              method: "GET",
              cache: "no-store",
            },
          );

        const payload =
          (await response.json()) as ApiResponse;

        if (!response.ok) {
          throw new Error(
            payload.error ||
              "Unable to load popup.",
          );
        }

        const visible =
          (
            payload.banners ||
            []
          )
            .filter((item) =>
              bannerMatchesLocation(
                item,
                pageLocation,
              ),
            )
            .filter(
              (item) =>
                !isHiddenFor24Hours(
                  item.id,
                ),
            )
            .sort(
              (a, b) =>
                safeNumber(
                  a.display_order,
                  9999,
                ) -
                safeNumber(
                  b.display_order,
                  9999,
                ),
            );

        if (!cancelled) {
          setBanners(visible);
          setCurrentIndex(0);
          setClosed(false);
          setHideForPeriod(false);
        }
      } catch (error) {
        console.error(
          "KTownPopupBanner load error:",
          error,
        );

        if (!cancelled) {
          setBanners([]);
          setCurrentIndex(0);
          setClosed(false);
          setHideForPeriod(false);
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    void load();

    return () => {
      cancelled = true;
    };
  }, [pathname]);

  const banner = useMemo(
    () =>
      banners[currentIndex] ||
      null,
    [
      banners,
      currentIndex,
    ],
  );

  if (
    loading ||
    closed ||
    !banner
  ) {
    return null;
  }

  const popupWidth =
    safeNumber(
      banner.popup_width,
      720,
    );

  const popupHeight =
    safeNumber(
      banner.popup_height,
      520,
    );

  const popupRadius =
    safeNumber(
      banner.popup_radius,
      28,
    );

  /*
   * Circle popup은 정원 유지
   */
  const isCirclePopup =
    banner.style_preset ===
    "circle";

  const popupAspectRatio =
    isCirclePopup
      ? "1 / 1"
      : popupWidth > 0 &&
          popupHeight > 0
        ? `${popupWidth} / ${popupHeight}`
        : "1 / 1";

  const baseTextX =
    safeNumber(
      banner.text_x,
      8,
    );

  const baseTextY =
    safeNumber(
      banner.text_y,
      16,
    );

  const baseTextWidth =
    safeNumber(
      banner.text_width,
      84,
    );

  const titleX =
    safeNumber(
      banner.title_x,
      baseTextX,
    );

  const titleY =
    safeNumber(
      banner.title_y,
      baseTextY,
    );

  const titleWidth =
    safeNumber(
      banner.title_width,
      baseTextWidth,
    );

  const subtitleX =
    safeNumber(
      banner.subtitle_x,
      baseTextX,
    );

  const subtitleY =
    safeNumber(
      banner.subtitle_y,
      baseTextY + 15,
    );

  const subtitleWidth =
    safeNumber(
      banner.subtitle_width,
      baseTextWidth,
    );

  const buttonX =
    safeNumber(
      banner.button_x,
      baseTextX,
    );

  const buttonY =
    safeNumber(
      banner.button_y,
      baseTextY + 33,
    );

  const buttonWidth =
    safeNumber(
      banner.button_width,
      28,
    );

  const buttonHeight =
    safeNumber(
      banner.button_height,
      9,
    );

  const imageZoom =
    Math.max(
      25,
      Math.min(
        300,
        safeNumber(
          banner.image_zoom,
          100,
        ),
      ),
    );

  const imageFit =
    banner.image_fit ||
    "cover";

  const link =
    normalizeUrl(
      banner.link_url,
    );

  const hideDays =
    Math.max(
      1,
      Math.min(
        31,
        safeNumber(
          banner.hide_days,
          1,
        ),
      ),
    );

  function closePopup() {
    if (
      hideForPeriod &&
      banner.hide_24h_enabled !==
        false
    ) {
      localStorage.setItem(
        `${HIDE_PREFIX}${banner.id}`,
        String(
          Date.now() +
            hideDays *
              24 *
              60 *
              60 *
              1000,
        ),
      );
    }

    const next =
      banners.findIndex(
        (item, index) =>
          index >
            currentIndex &&
          !isHiddenFor24Hours(
            item.id,
          ),
      );

    if (next >= 0) {
      setCurrentIndex(next);
      setHideForPeriod(false);

      return;
    }

    setClosed(true);
  }

  const backgroundStyle:
    React.CSSProperties = {};

  return (
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/55 p-3 sm:p-5"
      role="dialog"
      aria-modal="true"
      aria-label={
        banner.title ||
        "KTownTriangle popup"
      }
      onMouseDown={(
        event,
      ) => {
        if (
          event.currentTarget ===
          event.target
        ) {
          closePopup();
        }
      }}
    >
      <div
        className="relative w-[calc(100vw-24px)] max-w-[460px] overflow-hidden border border-black/10 sm:w-[calc(100vw-40px)]"
        style={{
          aspectRatio:
            popupAspectRatio,

          maxHeight:
            "calc(100dvh - 32px)",

          borderRadius:
            `${popupRadius}px`,

          backgroundColor:
            banner.background_color ||
            "#ffffff",

          boxShadow:
            pxShadow(
              banner.popup_shadow,
            ),

          ...backgroundStyle,
        }}
      >
        {banner.image_url &&
          banner.image_position ===
            "background" && (
            <div className="pointer-events-none absolute inset-0 z-0 overflow-hidden">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={
                  banner.image_url
                }
                alt=""
                className="h-full w-full"
                style={{
                  objectFit:
                    imageFit,

                  transform:
                    `scale(${
                      imageZoom /
                      100
                    })`,

                  transformOrigin:
                    "center",
                }}
              />
            </div>
          )}

        {banner.image_url &&
          banner.image_position !==
            "background" && (
            <div className="absolute inset-0 z-0 flex items-center justify-center overflow-hidden">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={
                  banner.image_url
                }
                alt=""
                className="h-full w-full"
                style={{
                  objectFit:
                    imageFit,

                  transform:
                    imageFit ===
                    "fill"
                      ? undefined
                      : `scale(${
                          imageZoom /
                          100
                        })`,

                  transformOrigin:
                    "center",
                }}
              />
            </div>
          )}

        <button
          type="button"
          onClick={
            closePopup
          }
          className="absolute right-3 top-3 z-50 flex h-10 w-10 items-center justify-center rounded-full bg-black/70 text-2xl font-black leading-none text-white shadow-lg transition hover:bg-black"
          aria-label="Close popup"
        >
          ×
        </button>

        {!!banner.title && (
          <div
            className="absolute z-20 whitespace-pre-wrap break-words"
            style={{
              left:
                `${titleX}%`,

              top:
                `${titleY}%`,

              width:
                `${titleWidth}%`,

              color:
                banner.title_color ||
                "#ffffff",

              fontSize:
                `${safeNumber(
                  banner.title_font_size,
                  32,
                )}px`,

              fontWeight:
                safeNumber(
                  banner.title_font_weight,
                  900,
                ),

              lineHeight:
                1.1,

              textAlign:
                banner.text_align ||
                "left",
            }}
          >
            {banner.title}
          </div>
        )}

        {!!banner.subtitle && (
          <div
            className="absolute z-20 whitespace-pre-wrap break-words"
            style={{
              left:
                `${subtitleX}%`,

              top:
                `${subtitleY}%`,

              width:
                `${subtitleWidth}%`,

              color:
                banner.subtitle_color ||
                "#ffffff",

              fontSize:
                `${safeNumber(
                  banner.subtitle_font_size,
                  16,
                )}px`,

              fontWeight:
                safeNumber(
                  banner.subtitle_font_weight,
                  500,
                ),

              lineHeight:
                1.4,

              textAlign:
                banner.text_align ||
                "left",
            }}
          >
            {banner.subtitle}
          </div>
        )}

        {banner.button_enabled !==
          false &&
          !!banner.button_text &&
          (link ? (
            <a
              href={link}
              target={
                link.startsWith(
                  "http",
                )
                  ? "_blank"
                  : undefined
              }
              rel={
                link.startsWith(
                  "http",
                )
                  ? "noreferrer"
                  : undefined
              }
              className="absolute z-30 flex items-center justify-center overflow-hidden px-3 text-center font-black shadow-md transition hover:brightness-105 active:scale-[0.98]"
              style={{
                left:
                  `${buttonX}%`,

                top:
                  `${buttonY}%`,

                width:
                  `${buttonWidth}%`,

                height:
                  `${buttonHeight}%`,

                minHeight:
                  "34px",

                backgroundColor:
                  banner.button_color ||
                  "#172033",

                color:
                  banner.button_text_color ||
                  "#ffffff",

                fontSize:
                  `${safeNumber(
                    banner.button_font_size,
                    14,
                  )}px`,

                borderRadius:
                  "12px",
              }}
            >
              {
                banner.button_text
              }
            </a>
          ) : (
            <div
              className="absolute z-30 flex items-center justify-center overflow-hidden px-3 text-center font-black shadow-md"
              style={{
                left:
                  `${buttonX}%`,

                top:
                  `${buttonY}%`,

                width:
                  `${buttonWidth}%`,

                height:
                  `${buttonHeight}%`,

                minHeight:
                  "34px",

                backgroundColor:
                  banner.button_color ||
                  "#172033",

                color:
                  banner.button_text_color ||
                  "#ffffff",

                fontSize:
                  `${safeNumber(
                    banner.button_font_size,
                    14,
                  )}px`,

                borderRadius:
                  "12px",
              }}
            >
              {
                banner.button_text
              }
            </div>
          ))}

        {banner.hide_24h_enabled !==
          false && (
          <label className="absolute bottom-3 left-1/2 z-50 flex -translate-x-1/2 cursor-pointer items-center gap-2 whitespace-nowrap rounded-full bg-black/70 px-4 py-2 text-xs font-bold text-white shadow-lg backdrop-blur">
            <input
              type="checkbox"
              checked={
                hideForPeriod
              }
              onChange={(
                event,
              ) =>
                setHideForPeriod(
                  event.target
                    .checked,
                )
              }
              className="h-4 w-4 accent-white"
            />

            Don't show again for{" "}
            {hideDays}{" "}
            {hideDays === 1
              ? "day"
              : "days"}
          </label>
        )}
      </div>
    </div>
  );
}