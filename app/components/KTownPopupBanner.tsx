"use client";

import { useEffect, useMemo, useState } from "react";
import { usePathname } from "next/navigation";

type TextAlign = "left" | "center" | "right";
type ImageFit = "contain" | "cover" | "fill";

type DisplayLocation = "all" | "home" | "community" | "events";

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

  image_position?: string | null;
  image_fit?: ImageFit | null;
  image_zoom?: number | null;

  // 기존 공용 글자 박스 값
  text_x?: number | null;
  text_y?: number | null;
  text_width?: number | null;

  // 새 개별 드래그 위치 값 — DB에 있으면 사용, 없으면 fallback
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

const HIDE_PREFIX = "ktown_popup_hide_until_";

function pxShadow(name?: string | null) {
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

function isHiddenFor24Hours(id: number) {
  if (typeof window === "undefined") return false;

  const raw = localStorage.getItem(`${HIDE_PREFIX}${id}`);
  if (!raw) return false;

  const hideUntil = Number(raw);
  if (!Number.isFinite(hideUntil)) {
    localStorage.removeItem(`${HIDE_PREFIX}${id}`);
    return false;
  }

  if (Date.now() >= hideUntil) {
    localStorage.removeItem(`${HIDE_PREFIX}${id}`);
    return false;
  }

  return true;
}

function safeNumber(value: unknown, fallback: number) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function normalizeUrl(url?: string | null) {
  const value = String(url || "").trim();
  if (!value) return "";

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


function currentDisplayLocation(pathname: string): Exclude<DisplayLocation, "all"> | null {
  if (pathname === "/") return "home";

  // 커뮤니티 배너는 커뮤니티 메인에서만 표시합니다.
  // /community/... 하위 페이지에서는 표시하지 않습니다.
  if (pathname === "/community") {
    return "community";
  }

  if (
    pathname === "/events" ||
    pathname.startsWith("/events/") ||
    pathname === "/business-events" ||
    pathname.startsWith("/business-events/") ||
    pathname === "/grand-openings" ||
    pathname.startsWith("/grand-openings/")
  ) {
    return "events";
  }

  return null;
}

function bannerMatchesLocation(
  banner: PublicBanner,
  location: Exclude<DisplayLocation, "all"> | null,
) {
  if (!location) return false;

  const target = banner.display_location;
  if (!target) return false;

  return target === "all" || target === location;
}

export default function KTownPopupBanner() {
  const pathname = usePathname();
  const [banners, setBanners] = useState<PublicBanner[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [closed, setClosed] = useState(false);
  const [hide24Hours, setHide24Hours] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const pageLocation = currentDisplayLocation(pathname);

        // 홈/커뮤니티/이벤트가 아닌 경로에서는 공용 팝업을 아예 표시하지 않습니다.
        if (!pageLocation) {
          if (!cancelled) {
            setBanners([]);
            setCurrentIndex(0);
            setClosed(false);
            setHide24Hours(false);
            setLoading(false);
          }
          return;
        }

        const response = await fetch(
          `/api/banners?location=${encodeURIComponent(pageLocation)}`,
          {
            method: "GET",
            cache: "no-store",
          },
        );

        const payload = (await response.json()) as ApiResponse;

        if (!response.ok) {
          throw new Error(payload.error || "팝업을 불러오지 못했습니다.");
        }

        const visible = (payload.banners || [])
          // API에서도 필터링하지만 클라이언트에서도 한 번 더 검사합니다.
          .filter((item) => bannerMatchesLocation(item, pageLocation))
          .filter((item) => !isHiddenFor24Hours(item.id))
          .sort(
            (a, b) =>
              safeNumber(a.display_order, 9999) -
              safeNumber(b.display_order, 9999),
          );

        if (!cancelled) {
          setBanners(visible);
          setCurrentIndex(0);
          setClosed(false);
          setHide24Hours(false);
        }
      } catch (error) {
        console.error("KTownPopupBanner load error:", error);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void load();

    return () => {
      cancelled = true;
    };
  }, [pathname]);

  const banner = useMemo(
    () => banners[currentIndex] || null,
    [banners, currentIndex],
  );

  if (loading || closed || !banner) return null;

  const popupWidth = safeNumber(banner.popup_width, 720);
  const popupHeight = safeNumber(banner.popup_height, 520);
  const popupRadius = safeNumber(banner.popup_radius, 28);
  // Circle은 항상 정원으로 표시합니다.
  // 관리자에 저장된 popup_height 값과 관계없이 가로 = 세로입니다.
  // 그 외 스타일은 저장된 가로:세로 비율을 그대로 유지합니다.
  const isCirclePopup = banner.style_preset === "circle";
  const popupAspectRatio = isCirclePopup
    ? "1 / 1"
    : popupWidth > 0 && popupHeight > 0
      ? `${popupWidth} / ${popupHeight}`
      : "1 / 1";

  const baseTextX = safeNumber(banner.text_x, 8);
  const baseTextY = safeNumber(banner.text_y, 16);
  const baseTextWidth = safeNumber(banner.text_width, 84);

  const titleX = safeNumber(banner.title_x, baseTextX);
  const titleY = safeNumber(banner.title_y, baseTextY);
  const titleWidth = safeNumber(banner.title_width, baseTextWidth);

  const subtitleX = safeNumber(banner.subtitle_x, baseTextX);
  const subtitleY = safeNumber(banner.subtitle_y, baseTextY + 15);
  const subtitleWidth = safeNumber(banner.subtitle_width, baseTextWidth);

  const buttonX = safeNumber(banner.button_x, baseTextX);
  const buttonY = safeNumber(banner.button_y, baseTextY + 33);
  const buttonWidth = safeNumber(banner.button_width, 28);
  const buttonHeight = safeNumber(banner.button_height, 9);

  const imageZoom = Math.max(25, Math.min(300, safeNumber(banner.image_zoom, 100)));
  const imageFit = banner.image_fit || "cover";
  const link = normalizeUrl(banner.link_url);

  function closePopup() {
    if (hide24Hours) {
      localStorage.setItem(
        `${HIDE_PREFIX}${banner.id}`,
        String(Date.now() + 24 * 60 * 60 * 1000),
      );
    }

    const next = banners.findIndex(
      (item, index) =>
        index > currentIndex && !isHiddenFor24Hours(item.id),
    );

    if (next >= 0) {
      setCurrentIndex(next);
      setHide24Hours(false);
      return;
    }

    setClosed(true);
  }

  const backgroundStyle: React.CSSProperties = {};

  return (
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/55 p-3 sm:p-5"
      role="dialog"
      aria-modal="true"
      aria-label={banner.title || "KTownTriangle popup"}
      onMouseDown={(event) => {
        if (event.currentTarget === event.target) closePopup();
      }}
    >
      <div
        className="relative w-[calc(100vw-24px)] max-w-[460px] overflow-hidden border border-black/10 sm:w-[calc(100vw-40px)]"
        style={{
          // 자동 반응형 크기:
          // 데스크탑에서는 max-w-lg(512px)보다 작은 최대 460px.
          // 폰에서는 화면 좌우 여백을 남기고 자동으로 줄어듭니다.
          // 높이는 저장된 디자인의 가로:세로 비율을 그대로 따라갑니다.
          aspectRatio: popupAspectRatio,
          maxHeight: "calc(100dvh - 32px)",
          borderRadius: `${popupRadius}px`,
          backgroundColor: banner.background_color || "#ffffff",
          boxShadow: pxShadow(banner.popup_shadow),
          ...backgroundStyle,
        }}
      >
        {banner.image_url && banner.image_position === "background" && (
          <div className="pointer-events-none absolute inset-0 z-0 overflow-hidden">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={banner.image_url}
              alt=""
              className="h-full w-full"
              style={{
                objectFit: imageFit,
                transform: `scale(${imageZoom / 100})`,
                transformOrigin: "center",
              }}
            />
          </div>
        )}

        {banner.image_url && banner.image_position !== "background" && (
          <div className="absolute inset-0 z-0 flex items-center justify-center overflow-hidden">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={banner.image_url}
              alt=""
              className="h-full w-full"
              style={{
                objectFit: imageFit,
                transform:
                  imageFit === "fill" ? undefined : `scale(${imageZoom / 100})`,
                transformOrigin: "center",
              }}
            />
          </div>
        )}

        <button
          type="button"
          onClick={closePopup}
          className="absolute right-3 top-3 z-50 flex h-10 w-10 items-center justify-center rounded-full bg-black/70 text-2xl font-black leading-none text-white shadow-lg transition hover:bg-black"
          aria-label="팝업 닫기"
        >
          ×
        </button>

        {!!banner.title && (
          <div
            className="absolute z-20 whitespace-pre-wrap break-words"
            style={{
              left: `${titleX}%`,
              top: `${titleY}%`,
              width: `${titleWidth}%`,
              color: banner.title_color || "#ffffff",
              fontSize: `${safeNumber(banner.title_font_size, 32)}px`,
              fontWeight: safeNumber(banner.title_font_weight, 900),
              lineHeight: 1.1,
              textAlign: banner.text_align || "left",
            }}
          >
            {banner.title}
          </div>
        )}

        {!!banner.subtitle && (
          <div
            className="absolute z-20 whitespace-pre-wrap break-words"
            style={{
              left: `${subtitleX}%`,
              top: `${subtitleY}%`,
              width: `${subtitleWidth}%`,
              color: banner.subtitle_color || "#ffffff",
              fontSize: `${safeNumber(banner.subtitle_font_size, 16)}px`,
              fontWeight: safeNumber(banner.subtitle_font_weight, 500),
              lineHeight: 1.4,
              textAlign: banner.text_align || "left",
            }}
          >
            {banner.subtitle}
          </div>
        )}

        {banner.button_enabled !== false && !!banner.button_text && (
          link ? (
            <a
              href={link}
              target={link.startsWith("http") ? "_blank" : undefined}
              rel={link.startsWith("http") ? "noreferrer" : undefined}
              className="absolute z-30 flex items-center justify-center overflow-hidden px-3 text-center font-black shadow-md transition hover:brightness-105 active:scale-[0.98]"
              style={{
                left: `${buttonX}%`,
                top: `${buttonY}%`,
                width: `${buttonWidth}%`,
                height: `${buttonHeight}%`,
                minHeight: "34px",
                backgroundColor: banner.button_color || "#172033",
                color: banner.button_text_color || "#ffffff",
                fontSize: `${safeNumber(banner.button_font_size, 14)}px`,
                borderRadius: "12px",
              }}
            >
              {banner.button_text}
            </a>
          ) : (
            <div
              className="absolute z-30 flex items-center justify-center overflow-hidden px-3 text-center font-black shadow-md"
              style={{
                left: `${buttonX}%`,
                top: `${buttonY}%`,
                width: `${buttonWidth}%`,
                height: `${buttonHeight}%`,
                minHeight: "34px",
                backgroundColor: banner.button_color || "#172033",
                color: banner.button_text_color || "#ffffff",
                fontSize: `${safeNumber(banner.button_font_size, 14)}px`,
                borderRadius: "12px",
              }}
            >
              {banner.button_text}
            </div>
          )
        )}

        <label className="absolute bottom-3 left-1/2 z-50 flex -translate-x-1/2 cursor-pointer items-center gap-2 rounded-full bg-black/70 px-4 py-2 text-xs font-bold text-white shadow-lg backdrop-blur">
          <input
            type="checkbox"
            checked={hide24Hours}
            onChange={(event) => setHide24Hours(event.target.checked)}
            className="h-4 w-4 accent-white"
          />
          24시간 동안 이 팝업 보지 않기
        </label>
      </div>
    </div>
  );
}