"use client";

import { useEffect, useMemo, useState } from "react";
import { usePathname } from "next/navigation";

type TextAlign = "left" | "center" | "right";
type ImageFit = "contain" | "cover" | "fill";

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

  /*
   * 기존 공용 Text 위치
   */
  text_x?: number | null;
  text_y?: number | null;
  text_width?: number | null;

  /*
   * 개별 요소 위치
   */
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

  /*
   * 이제 고정된 home/community/events 타입이 아니라
   * 실제 URL 경로를 저장합니다.
   *
   * 예:
   * /
   * /community
   * /community/manual
   * /community/map
   *
   * 빈 값 또는 all = 모든 페이지
   */
  display_location?: string | null;

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

/*
 * Popup Shadow
 */
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

/*
 * 사용자가 일정 기간 숨김을 선택했는지 확인
 */
function isHiddenForPeriod(
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
    !Number.isFinite(
      hideUntil,
    )
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

/*
 * 숫자 안전 처리
 */
function safeNumber(
  value: unknown,
  fallback: number,
) {
  const parsed =
    Number(value);

  return Number.isFinite(
    parsed,
  )
    ? parsed
    : fallback;
}

/*
 * 링크 URL 정리
 */
function normalizeUrl(
  url?: string | null,
) {
  const value =
    String(
      url || "",
    ).trim();

  if (!value) {
    return "";
  }

  if (
    value.startsWith("/") ||
    value.startsWith(
      "http://",
    ) ||
    value.startsWith(
      "https://",
    ) ||
    value.startsWith(
      "mailto:",
    ) ||
    value.startsWith(
      "tel:",
    )
  ) {
    return value;
  }

  return `https://${value}`;
}

/*
 * Display Location 정리
 *
 * 새로운 방식:
 *
 * 빈칸 = 모든 페이지
 * all = 모든 페이지
 *
 * / = 메인만
 * /community = Community 메인만
 * /community/manual = Manual 페이지에서만
 *
 * 정확하게 같은 주소에서만 표시합니다.
 *
 * 기존 DB 데이터와의 호환을 위해
 * home/community/events도 처리합니다.
 */
function normalizeDisplayLocation(
  value?: string | null,
) {
  const target =
    String(
      value || "",
    ).trim();

  /*
   * 중요:
   * 빈 값은 더 이상 "모든 페이지"로 취급하지 않습니다.
   * 잘못 저장된 빈 display_location 때문에 모든 페이지에
   * 팝업이 노출되는 문제를 막습니다.
   *
   * 모든 페이지 노출은 DB에 "all"이 명시된 경우에만 허용합니다.
   */
  if (!target) {
    return null;
  }

  if (target.toLowerCase() === "all") {
    return "all";
  }

  /*
   * 기존 값 호환
   */
  if (
    target.toLowerCase() ===
    "home"
  ) {
    return "/";
  }

  if (
    target.toLowerCase() ===
    "community"
  ) {
    return "/community";
  }

  if (
    target.toLowerCase() ===
    "events"
  ) {
    return "/events";
  }

  /*
   * URL 앞에 /가 없는 경우 자동 추가
   */
  if (
    !target.startsWith("/")
  ) {
    return `/${target}`;
  }

  /*
   * 끝의 / 제거
   * 단 메인 /는 유지
   */
  if (
    target.length > 1 &&
    target.endsWith("/")
  ) {
    return target.replace(
      /\/+$/,
      "",
    );
  }

  return target;
}

/*
 * 현재 pathname도 비교하기 쉽게 정리
 */
function normalizeCurrentPath(
  pathname: string,
) {
  if (
    pathname === "/"
  ) {
    return "/";
  }

  return pathname.replace(
    /\/+$/,
    "",
  );
}

/*
 * 핵심:
 * Popup이 현재 주소에서 보여야 하는지 확인
 *
 * 예:
 *
 * display_location = /community/manual
 *
 * /community/manual      → 표시
 * /community             → 표시 안 함
 * /community/map         → 표시 안 함
 * /community/manual/abc  → 표시 안 함
 * /                      → 표시 안 함
 *
 * display_location 빈칸
 * → 모든 페이지 표시
 */
function bannerMatchesPath(
  banner: PublicBanner,
  pathname: string,
) {
  const target =
    normalizeDisplayLocation(
      banner.display_location,
    );

  /*
   * 빈 display_location은 노출하지 않습니다.
   * "all"이 명시된 경우에만 모든 페이지에 표시합니다.
   */
  if (!target) {
    return false;
  }

  if (target === "all") {
    return true;
  }

  const currentPath =
    normalizeCurrentPath(
      pathname,
    );

  /*
   * 정확한 URL 일치만 허용
   */
  return (
    currentPath === target
  );
}

export default function KTownPopupBanner() {
  const pathname =
    usePathname();

  const [
    banners,
    setBanners,
  ] =
    useState<
      PublicBanner[]
    >([]);

  const [
    currentIndex,
    setCurrentIndex,
  ] = useState(0);

  const [
    closed,
    setClosed,
  ] = useState(false);

  const [
    hideForPeriod,
    setHideForPeriod,
  ] = useState(false);

  const [
    loading,
    setLoading,
  ] = useState(true);

  /*
   * pathname이 바뀔 때마다
   * Popup 목록을 다시 확인합니다.
   */
  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        setLoading(true);

        /*
         * 중요:
         *
         * 예전처럼
         * ?location=home
         * ?location=community
         *
         * 를 보내지 않습니다.
         *
         * 전체 활성 Popup을 받은 뒤
         * 현재 실제 pathname과 정확하게 비교합니다.
         */
        const currentPath = normalizeCurrentPath(pathname);

        const response =
          await fetch(
            `/api/banners?location=${encodeURIComponent(currentPath)}`,
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
            /*
             * 실제 URL과 정확히 같은
             * Display Location만 표시
             */
            .filter(
              (item) =>
                bannerMatchesPath(
                  item,
                  pathname,
                ),
            )

            /*
             * 일정 기간 숨김 여부
             */
            .filter(
              (item) =>
                !isHiddenForPeriod(
                  item.id,
                ),
            )

            /*
             * Display Order
             */
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
          setBanners(
            visible,
          );

          setCurrentIndex(
            0,
          );

          setClosed(false);

          setHideForPeriod(
            false,
          );
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
          setHideForPeriod(
            false,
          );
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

  const banner =
    useMemo(
      () =>
        banners[
          currentIndex
        ] || null,
      [
        banners,
        currentIndex,
      ],
    );

  /*
   * 표시할 Popup이 없으면 렌더링 안 함
   */
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
   * Circle Popup은 항상 정원
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

  /*
   * 기존 공용 Text 위치
   */
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

  /*
   * Title
   */
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

  /*
   * Subtitle
   */
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

  /*
   * Button
   */
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

  /*
   * Image
   */
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

  /*
   * Button Link
   */
  const link =
    normalizeUrl(
      banner.link_url,
    );

  /*
   * 숨김 기간
   */
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

  /*
   * Popup 닫기
   */
  function closePopup() {
    /*
     * Don't show again 체크
     */
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

    /*
     * 다음 Popup 확인
     */
    const next =
      banners.findIndex(
        (
          item,
          index,
        ) =>
          index >
            currentIndex &&
          !isHiddenForPeriod(
            item.id,
          ),
      );

    if (next >= 0) {
      setCurrentIndex(
        next,
      );

      setHideForPeriod(
        false,
      );

      return;
    }

    setClosed(true);
  }

  const backgroundStyle:
    React.CSSProperties =
      {};

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
        /*
         * Popup 바깥을 누르면 닫기
         */
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
        {/* Background Image */}
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

        {/* Normal Image */}
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

        {/* Close */}
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

        {/* Title */}
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

        {/* Description */}
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
            {
              banner.subtitle
            }
          </div>
        )}

        {/* Button */}
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

        {/* Don't show again */}
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

            Don't show again
            for {hideDays}{" "}
            {hideDays === 1
              ? "day"
              : "days"}
          </label>
        )}
      </div>
    </div>
  );
}