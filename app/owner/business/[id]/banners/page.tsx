"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import { supabase } from "@/lib/supabase";

type BannerType = "popup";

type TextAlign = "left" | "center" | "right";
type ImagePosition = "top" | "left" | "background";
type ImageFit = "contain" | "cover" | "fill";
type PopupPresetId =
  | "square"
  | "rounded"
  | "modern"
  | "glass"
  | "iphone"
  | "coupon"
  | "circle";
type PopupShadow = "none" | "small" | "medium" | "large" | "glass";

type Banner = {
  id: number;
  banner_type: BannerType;
  template_style: string | null;
  title: string;
  subtitle: string | null;
  button_text: string | null;
  link_url: string | null;
  image_url: string | null;
  background_color: string;
  text_color: string;
  button_color: string;
  button_text_color: string;
  title_color: string;
  subtitle_color: string;
  title_font_size: number;
  subtitle_font_size: number;
  button_font_size: number;
  title_font_weight: number;
  subtitle_font_weight: number;
  text_align: TextAlign;
  image_position: ImagePosition;
  popup_width: number;
  button_enabled: boolean;
  text_x: number;
  text_y: number;
  text_width: number;
  image_x: number;
  image_y: number;
  image_width: number;
  image_height: number;
  image_fit: ImageFit;
  image_zoom: number;
  style_preset: PopupPresetId;
  popup_radius: number;
  image_radius: number;
  button_radius: number;
  popup_shadow: PopupShadow;
  popup_height: number;
  lead_capture_enabled: boolean;
  email_placeholder: string;
  terms_text: string;
  submit_button_text: string;
  success_message: string;
  coupon_code_prefix: string;
  reward_signup_url: string | null;
  form_background_color: string;
  lead_expanded_mode: boolean;
  display_order: number;
  is_active: boolean;
  starts_at: string | null;
  ends_at: string | null;
};

type ApiResponse = {
  business?: {
    id: number;
    name: string | null;
  };
  banners?: Banner[];
  banner?: Banner;
  error?: string;
};

type Template = {
  type: BannerType;
  style: string;
  icon: string;
  name: string;
  description: string;
  title: string;
  subtitle: string;
  buttonText: string;
  backgroundColor: string;
  textColor: string;
  buttonColor: string;
  buttonTextColor: string;
};

const TEMPLATES: Template[] = [
  {
    type: "popup",
    style: "custom",
    icon: "🎨",
    name: "자유 디자인 팝업",
    description: "글자 크기, 색상, 이미지, 버튼과 정렬을 직접 디자인합니다.",
    title: "This Week's Special",
    subtitle: "Discover our signature dishes made with fresh ingredients.",
    buttonText: "View Menu",
    backgroundColor: "#B64032",
    textColor: "#FFFFFF",
    buttonColor: "#172033",
    buttonTextColor: "#FFFFFF",
  },
];


type PopupStylePreset = {
  id: PopupPresetId;
  icon: string;
  name: string;
  description: string;
  popupRadius: number;
  imageRadius: number;
  buttonRadius: number;
  shadow: PopupShadow;
  backgroundColor?: string;
  textColor?: string;
};

const POPUP_STYLE_PRESETS: PopupStylePreset[] = [
  {
    id: "square",
    icon: "▣",
    name: "Square",
    description: "모서리가 없는 기본 사각형",
    popupRadius: 0,
    imageRadius: 0,
    buttonRadius: 0,
    shadow: "small",
  },
  {
    id: "rounded",
    icon: "▢",
    name: "Rounded",
    description: "부드러운 둥근 모서리",
    popupRadius: 28,
    imageRadius: 18,
    buttonRadius: 12,
    shadow: "medium",
  },
  {
    id: "modern",
    icon: "✦",
    name: "Modern",
    description: "큰 라운드와 깊은 그림자",
    popupRadius: 36,
    imageRadius: 24,
    buttonRadius: 16,
    shadow: "large",
  },
  {
    id: "glass",
    icon: "◇",
    name: "Glass",
    description: "가볍고 투명한 느낌",
    popupRadius: 32,
    imageRadius: 22,
    buttonRadius: 999,
    shadow: "glass",
    backgroundColor: "#FFFFFF",
    textColor: "#172033",
  },
  {
    id: "iphone",
    icon: "▯",
    name: "iPhone Style",
    description: "모바일 카드처럼 큰 라운드",
    popupRadius: 44,
    imageRadius: 32,
    buttonRadius: 999,
    shadow: "large",
  },
  {
    id: "coupon",
    icon: "🎟",
    name: "Coupon",
    description: "쿠폰 카드에 어울리는 스타일",
    popupRadius: 20,
    imageRadius: 12,
    buttonRadius: 8,
    shadow: "medium",
  },
  {
    id: "circle",
    icon: "●",
    name: "Circle",
    description: "최대한 둥근 캡슐·원형 스타일",
    popupRadius: 999,
    imageRadius: 999,
    buttonRadius: 999,
    shadow: "large",
  },
];

function getPopupShadow(shadow: PopupShadow) {
  if (shadow === "none") return "none";
  if (shadow === "small") return "0 8px 24px rgba(15, 23, 42, 0.16)";
  if (shadow === "medium") return "0 18px 50px rgba(15, 23, 42, 0.24)";
  if (shadow === "glass") return "0 24px 70px rgba(15, 23, 42, 0.22), inset 0 1px 0 rgba(255,255,255,.65)";
  return "0 30px 90px rgba(15, 23, 42, 0.34)";
}

function toLocalDateTime(value: string | null) {
  if (!value) return "";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) return "";

  const offset = date.getTimezoneOffset();
  const local = new Date(date.getTime() - offset * 60_000);

  return local.toISOString().slice(0, 16);
}

function toIsoOrNull(value: string) {
  if (!value) return null;

  const date = new Date(value);

  return Number.isNaN(date.getTime())
    ? null
    : date.toISOString();
}

async function loadImage(file: File) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const image = new Image();

    image.onload = () => {
      URL.revokeObjectURL(url);
      resolve(image);
    };

    image.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("이미지를 읽지 못했습니다."));
    };

    image.src = url;
  });
}

async function resizeBannerImage(file: File) {
  if (!file.type.startsWith("image/")) {
    throw new Error("이미지 파일만 선택하세요.");
  }

  if (file.size > 20 * 1024 * 1024) {
    throw new Error("원본 파일은 20MB 이하만 선택할 수 있습니다.");
  }

  const image = await loadImage(file);
  const maxWidth = 1600;
  const maxHeight = 900;
  const scale = Math.min(
    maxWidth / image.naturalWidth,
    maxHeight / image.naturalHeight,
    1,
  );

  const width = Math.max(
    1,
    Math.round(image.naturalWidth * scale),
  );
  const height = Math.max(
    1,
    Math.round(image.naturalHeight * scale),
  );

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;

  const context = canvas.getContext("2d");

  if (!context) {
    throw new Error("이미지 처리 기능을 사용할 수 없습니다.");
  }

  context.imageSmoothingEnabled = true;
  context.imageSmoothingQuality = "high";
  context.drawImage(image, 0, 0, width, height);

  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (blob) =>
        blob
          ? resolve(blob)
          : reject(new Error("이미지 변환에 실패했습니다.")),
      "image/webp",
      0.82,
    );
  });
}

export default function BannerManagementPage() {
  const params = useParams<{ id: string }>();
  const businessId = Number(params.id);

  const [businessName, setBusinessName] = useState("Business");
  const [banners, setBanners] = useState<Banner[]>([]);
  const [selectedTemplate, setSelectedTemplate] =
    useState<Template>(TEMPLATES[0]);
  const [editingBanner, setEditingBanner] =
    useState<Banner | null>(null);
  const [title, setTitle] = useState(TEMPLATES[0].title);
  const [subtitle, setSubtitle] = useState(TEMPLATES[0].subtitle);
  const [buttonText, setButtonText] =
    useState(TEMPLATES[0].buttonText);
  const [linkUrl, setLinkUrl] = useState("");
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState("");
  const [removeImageRequested, setRemoveImageRequested] = useState(false);
  const [backgroundColor, setBackgroundColor] =
    useState(TEMPLATES[0].backgroundColor);
  const [textColor, setTextColor] =
    useState(TEMPLATES[0].textColor);
  const [buttonColor, setButtonColor] =
    useState(TEMPLATES[0].buttonColor);
  const [buttonTextColor, setButtonTextColor] =
    useState(TEMPLATES[0].buttonTextColor);
  const [titleColor, setTitleColor] =
    useState(TEMPLATES[0].textColor);
  const [subtitleColor, setSubtitleColor] =
    useState(TEMPLATES[0].textColor);
  const [titleFontSize, setTitleFontSize] = useState(32);
  const [subtitleFontSize, setSubtitleFontSize] = useState(16);
  const [buttonFontSize, setButtonFontSize] = useState(14);
  const [titleFontWeight, setTitleFontWeight] = useState(900);
  const [subtitleFontWeight, setSubtitleFontWeight] = useState(500);
  const [textAlign, setTextAlign] = useState<TextAlign>("left");
  const [imagePosition, setImagePosition] =
    useState<ImagePosition>("top");
  const [popupWidth, setPopupWidth] = useState(720);
  const [buttonEnabled, setButtonEnabled] = useState(true);
  const [textX, setTextX] = useState(8);
  const [textY, setTextY] = useState(16);
  const [textWidth, setTextWidth] = useState(84);
  const [imageX, setImageX] = useState(0);
  const [imageY, setImageY] = useState(0);
  const [imageWidth, setImageWidth] = useState(100);
  const [imageHeight, setImageHeight] = useState(42);
  const [imageFit, setImageFit] = useState<ImageFit>("contain");
  const [imageZoom, setImageZoom] = useState(100);
  const [stylePreset, setStylePreset] =
    useState<PopupPresetId>("rounded");
  const [popupRadius, setPopupRadius] = useState(28);
  const [imageRadius, setImageRadius] = useState(18);
  const [buttonRadius, setButtonRadius] = useState(12);
  const [popupShadow, setPopupShadow] =
    useState<PopupShadow>("medium");
  const [popupHeight, setPopupHeight] = useState(520);
  const [leadCaptureEnabled, setLeadCaptureEnabled] = useState(false);
  const [emailPlaceholder, setEmailPlaceholder] = useState("Enter email to claim");
  const [termsText, setTermsText] = useState("By continuing, I agree to receive marketing messages and accept the Terms of Service and Privacy Policy.");
  const [submitButtonText, setSubmitButtonText] = useState("SIGN UP & CLAIM");
  const [successMessage, setSuccessMessage] = useState("Check your email! 🎉");
  const [couponCodePrefix, setCouponCodePrefix] = useState("WELCOME");
  const [rewardSignupUrl, setRewardSignupUrl] = useState("");
  const [formBackgroundColor, setFormBackgroundColor] = useState("#FFFFFF");
  const [leadExpandedMode, setLeadExpandedMode] = useState(true);
  const [dragging, setDragging] = useState<"text" | "image" | null>(null);
  const [displayOrder, setDisplayOrder] = useState(1);
  const [isActive, setIsActive] = useState(true);
  const [startsAt, setStartsAt] = useState("");
  const [endsAt, setEndsAt] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [imageStatus, setImageStatus] = useState("");
  const [message, setMessage] = useState("");

  useEffect(() => {
    void loadBanners();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [businessId]);

  useEffect(() => {
    return () => {
      if (imagePreview.startsWith("blob:")) {
        URL.revokeObjectURL(imagePreview);
      }
    };
  }, [imagePreview]);

  async function getToken() {
    const {
      data: { session },
    } = await supabase.auth.getSession();

    if (!session?.access_token) {
      throw new Error("로그인이 필요합니다.");
    }

    return session.access_token;
  }

  async function request(
    method: "GET" | "POST" | "PATCH" | "DELETE",
    body?: BodyInit,
    contentType?: string,
  ) {
    const token = await getToken();

    const response = await fetch(
      `/api/owner/business/${businessId}/banners`,
      {
        method,
        headers: {
          Authorization: `Bearer ${token}`,
          ...(contentType
            ? { "Content-Type": contentType }
            : {}),
        },
        body,
        cache: "no-store",
      },
    );

    const data = (await response.json()) as ApiResponse;

    if (!response.ok) {
      throw new Error(
        data.error || "요청을 처리하지 못했습니다.",
      );
    }

    return data;
  }

  async function loadBanners() {
    setLoading(true);
    setMessage("");

    try {
      const data = await request("GET");

      setBusinessName(
        data.business?.name || `Business #${businessId}`,
      );
      setBanners(data.banners || []);
      setDisplayOrder((data.banners?.length || 0) + 1);
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "배너를 불러오지 못했습니다.",
      );
    } finally {
      setLoading(false);
    }
  }

  function applyStylePreset(preset: PopupStylePreset) {
    setStylePreset(preset.id);
    setPopupRadius(preset.popupRadius);
    setImageRadius(preset.imageRadius);
    setButtonRadius(preset.buttonRadius);
    setPopupShadow(preset.shadow);

    if (preset.backgroundColor) {
      setBackgroundColor(preset.backgroundColor);
    }

    if (preset.textColor) {
      setTitleColor(preset.textColor);
      setSubtitleColor(preset.textColor);
    }
  }

  function applyTemplate(template: Template) {
    setSelectedTemplate(template);
    setEditingBanner(null);
    setTitle(template.title);
    setSubtitle(template.subtitle);
    setButtonText(template.buttonText);
    setLinkUrl("");
    setImageFile(null);
    setImagePreview("");
    setRemoveImageRequested(false);
    setImageStatus("");
    setBackgroundColor(template.backgroundColor);
    setTextColor(template.textColor);
    setButtonColor(template.buttonColor);
    setButtonTextColor(template.buttonTextColor);
    setTitleColor(template.textColor);
    setSubtitleColor(template.textColor);
    setTitleFontSize(32);
    setSubtitleFontSize(16);
    setButtonFontSize(14);
    setTitleFontWeight(900);
    setSubtitleFontWeight(500);
    setTextAlign("left");
    setImagePosition("top");
    setPopupWidth(720);
    setButtonEnabled(true);
    setTextX(8);
    setTextY(16);
    setTextWidth(84);
    setImageX(0);
    setImageY(0);
    setImageWidth(100);
    setImageHeight(42);
    setImageFit("contain");
    setImageZoom(100);
    setStylePreset("rounded");
    setPopupRadius(28);
    setImageRadius(18);
    setButtonRadius(12);
    setPopupShadow("medium");
    setPopupHeight(520);
    setLeadCaptureEnabled(false);
    setEmailPlaceholder("Enter email to claim");
    setTermsText("By continuing, I agree to receive marketing messages and accept the Terms of Service and Privacy Policy.");
    setSubmitButtonText("SIGN UP & CLAIM");
    setSuccessMessage("Check your email! 🎉");
    setCouponCodePrefix("WELCOME");
    setRewardSignupUrl("");
    setFormBackgroundColor("#FFFFFF");
    setLeadExpandedMode(true);
    setDisplayOrder(banners.length + 1);
    setIsActive(true);
    setStartsAt("");
    setEndsAt("");
    setMessage("");
  }

  function editBanner(banner: Banner) {
    const template =
      TEMPLATES.find(
        (item) =>
          item.style ===
          (banner.template_style || "classic"),
      ) || TEMPLATES[0];

    setSelectedTemplate(template);
    setEditingBanner(banner);
    setTitle(banner.title);
    setSubtitle(banner.subtitle || "");
    setButtonText(banner.button_text || "");
    setLinkUrl(banner.link_url || "");
    setImageFile(null);
    setImagePreview(banner.image_url || "");
    setRemoveImageRequested(false);
    setImageStatus(
      banner.image_url
        ? "✓ 기존 이미지가 등록되어 있습니다."
        : "등록된 이미지가 없습니다.",
    );
    setBackgroundColor(banner.background_color);
    setTextColor(banner.text_color);
    setButtonColor(banner.button_color);
    setButtonTextColor(banner.button_text_color);
    setTitleColor(banner.title_color || banner.text_color);
    setSubtitleColor(banner.subtitle_color || banner.text_color);
    setTitleFontSize(Number(banner.title_font_size) || 32);
    setSubtitleFontSize(Number(banner.subtitle_font_size) || 16);
    setButtonFontSize(Number(banner.button_font_size) || 14);
    setTitleFontWeight(Number(banner.title_font_weight) || 900);
    setSubtitleFontWeight(Number(banner.subtitle_font_weight) || 500);
    setTextAlign(banner.text_align || "left");
    setImagePosition(banner.image_position || "top");
    setPopupWidth(Number(banner.popup_width) || 720);
    setButtonEnabled(banner.button_enabled !== false);
    setTextX(Number(banner.text_x) || 8);
    setTextY(Number(banner.text_y) || 16);
    setTextWidth(Number(banner.text_width) || 84);
    setImageX(Number(banner.image_x) || 0);
    setImageY(Number(banner.image_y) || 0);
    setImageWidth(Number(banner.image_width) || 100);
    setImageHeight(Number(banner.image_height) || 42);
    setImageFit(
      banner.image_fit === "cover" || banner.image_fit === "fill"
        ? banner.image_fit
        : "contain",
    );
    setImageZoom(Math.max(25, Math.min(300, Number(banner.image_zoom) || 100)));
    setStylePreset(
      POPUP_STYLE_PRESETS.some((item) => item.id === banner.style_preset)
        ? banner.style_preset
        : "rounded",
    );
    setPopupRadius(Math.max(0, Math.min(999, Number(banner.popup_radius) || 28)));
    setImageRadius(Math.max(0, Math.min(999, Number(banner.image_radius) || 18)));
    setButtonRadius(Math.max(0, Math.min(999, Number(banner.button_radius) || 12)));
    setPopupShadow(
      ["none", "small", "medium", "large", "glass"].includes(banner.popup_shadow)
        ? banner.popup_shadow
        : "medium",
    );
    setPopupHeight(Number(banner.popup_height) || 520);
    setLeadCaptureEnabled(banner.lead_capture_enabled === true);
    setEmailPlaceholder(banner.email_placeholder || "Enter email to claim");
    setTermsText(banner.terms_text || "");
    setSubmitButtonText(banner.submit_button_text || "SIGN UP & CLAIM");
    setSuccessMessage(banner.success_message || "Check your email! 🎉");
    setCouponCodePrefix(banner.coupon_code_prefix || "WELCOME");
    setRewardSignupUrl(banner.reward_signup_url || "");
    setFormBackgroundColor(banner.form_background_color || "#FFFFFF");
    setLeadExpandedMode(banner.lead_expanded_mode !== false);
    setDisplayOrder(banner.display_order);
    setIsActive(banner.is_active);
    setStartsAt(toLocalDateTime(banner.starts_at));
    setEndsAt(toLocalDateTime(banner.ends_at));

    window.scrollTo({
      top: 0,
      behavior: "smooth",
    });
  }

  async function saveBanner() {
    if (!title.trim()) {
      alert("배너 제목을 입력하세요.");
      return;
    }

    if (leadCaptureEnabled && !emailPlaceholder.trim()) {
      alert("이메일 입력 안내 문구를 입력하세요.");
      return;
    }

    if (!endsAt) {
      alert("팝업 종료일을 입력하세요.");
      return;
    }

    if (
      startsAt &&
      new Date(startsAt).getTime() >=
        new Date(endsAt).getTime()
    ) {
      alert("종료일은 시작일보다 뒤여야 합니다.");
      return;
    }

    setSaving(true);
    setMessage("");

    try {
      const formData = new FormData();
      formData.append("banner_type", "popup");
      formData.append(
        "template_style",
        selectedTemplate.style,
      );
      formData.append("title", title.trim());
      formData.append("subtitle", subtitle.trim());
      formData.append("button_text", buttonText.trim());
      formData.append("link_url", linkUrl.trim());
      formData.append(
        "background_color",
        backgroundColor,
      );
      formData.append("text_color", textColor);
      formData.append("button_color", buttonColor);
      formData.append(
        "button_text_color",
        buttonTextColor,
      );
      formData.append("title_color", titleColor);
      formData.append("subtitle_color", subtitleColor);
      formData.append("title_font_size", String(titleFontSize));
      formData.append("subtitle_font_size", String(subtitleFontSize));
      formData.append("button_font_size", String(buttonFontSize));
      formData.append("title_font_weight", String(titleFontWeight));
      formData.append("subtitle_font_weight", String(subtitleFontWeight));
      formData.append("text_align", textAlign);
      formData.append("image_position", imagePosition);
      formData.append("popup_width", String(popupWidth));
      formData.append("button_enabled", String(buttonEnabled));
      formData.append("text_x", String(textX));
      formData.append("text_y", String(textY));
      formData.append("text_width", String(textWidth));
      formData.append("image_x", String(imageX));
      formData.append("image_y", String(imageY));
      formData.append("image_width", String(imageWidth));
      formData.append("image_height", String(imageHeight));
      formData.append("image_fit", imageFit);
      formData.append("image_zoom", String(imageZoom));

      // 기존에 저장된 이미지를 삭제한 경우 서버에도 삭제 의사를 전달합니다.
      // 신규 이미지를 다시 선택하면 removeImageRequested가 false로 돌아갑니다.
      formData.append(
        "remove_image",
        removeImageRequested && !imageFile ? "true" : "false",
      );
      if (removeImageRequested && !imageFile) {
        formData.append("image_url", "");
      }

      formData.append("style_preset", stylePreset);
      formData.append("popup_radius", String(popupRadius));
      formData.append("image_radius", String(imageRadius));
      formData.append("button_radius", String(buttonRadius));
      formData.append("popup_shadow", popupShadow);
      formData.append("popup_height", String(popupHeight));
      formData.append("lead_capture_enabled", String(leadCaptureEnabled));
      formData.append("email_placeholder", emailPlaceholder.trim());
      formData.append("terms_text", termsText.trim());
      formData.append("submit_button_text", submitButtonText.trim());
      formData.append("success_message", successMessage.trim());
      formData.append("coupon_code_prefix", couponCodePrefix.trim().toUpperCase());
      formData.append("reward_signup_url", rewardSignupUrl.trim());
      formData.append("form_background_color", formBackgroundColor);
      formData.append("lead_expanded_mode", String(leadExpandedMode));
      formData.append(
        "display_order",
        String(displayOrder),
      );
      formData.append(
        "is_active",
        String(isActive),
      );
      formData.append(
        "starts_at",
        toIsoOrNull(startsAt) || "",
      );
      formData.append(
        "ends_at",
        toIsoOrNull(endsAt) || "",
      );

      if (editingBanner) {
        formData.append(
          "id",
          String(editingBanner.id),
        );
      }

      const isUploadingNewImage = Boolean(imageFile);

      if (imageFile) {
        setImageStatus("이미지를 WEBP로 변환하고 업로드하는 중...");

        const resized = await resizeBannerImage(
          imageFile,
        );

        formData.append(
          "image",
          resized,
          `popup-${Date.now()}.webp`,
        );
      }

      const data = await request(
        editingBanner ? "PATCH" : "POST",
        formData,
      );

      if (!data.banner) {
        throw new Error(
          "저장된 팝업 정보를 받지 못했습니다.",
        );
      }

      if (
        isUploadingNewImage &&
        !data.banner.image_url
      ) {
        throw new Error(
          "팝업 내용은 저장됐지만 이미지 경로가 저장되지 않았습니다.",
        );
      }

      if (data.banner.image_url) {
        setImageStatus("✓ 이미지가 Storage와 DB에 저장되었습니다.");
      }

      setMessage(
        editingBanner
          ? "✓ 팝업을 수정했습니다."
          : "✓ 팝업을 등록했습니다.",
      );

      await loadBanners();
      applyTemplate(selectedTemplate);
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "배너 저장 실패",
      );
    } finally {
      setSaving(false);
    }
  }

  async function toggleBanner(banner: Banner) {
    setSaving(true);
    setMessage("");

    try {
      const data = await request(
        "PATCH",
        JSON.stringify({
          id: banner.id,
          quick_action: "toggle",
          is_active: !banner.is_active,
        }),
        "application/json",
      );

      if (!data.banner) {
        throw new Error(
          "배너 상태를 변경하지 못했습니다.",
        );
      }

      setBanners((current) =>
        current.map((item) =>
          item.id === banner.id
            ? (data.banner as Banner)
            : item,
        ),
      );
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "배너 상태 변경 실패",
      );
    } finally {
      setSaving(false);
    }
  }

  async function deleteBanner(banner: Banner) {
    if (
      !window.confirm(
        `"${banner.title}" 배너를 삭제할까요?`,
      )
    ) {
      return;
    }

    setSaving(true);
    setMessage("");

    try {
      await request(
        "DELETE",
        JSON.stringify({ id: banner.id }),
        "application/json",
      );

      setBanners((current) =>
        current.filter(
          (item) => item.id !== banner.id,
        ),
      );

      if (editingBanner?.id === banner.id) {
        applyTemplate(selectedTemplate);
      }

      setMessage("✓ 배너를 삭제했습니다.");
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "배너 삭제 실패",
      );
    } finally {
      setSaving(false);
    }
  }

  function clamp(value: number, minimum: number, maximum: number) {
    return Math.max(minimum, Math.min(maximum, value));
  }

  function handlePreviewPointerMove(
    event: React.PointerEvent<HTMLDivElement>,
  ) {
    if (!dragging) return;

    const rect = event.currentTarget.getBoundingClientRect();
    const x = ((event.clientX - rect.left) / rect.width) * 100;
    const y = ((event.clientY - rect.top) / rect.height) * 100;

    if (dragging === "text") {
      setTextX(clamp(x, 0, Math.max(0, 100 - textWidth)));
      setTextY(clamp(y, 0, 92));
    } else {
      setImageX(clamp(x, 0, Math.max(0, 100 - imageWidth)));
      setImageY(clamp(y, 0, Math.max(0, 100 - imageHeight)));
    }
  }

  const sortedBanners = useMemo(
    () =>
      [...banners].sort(
        (a, b) =>
          a.display_order - b.display_order ||
          a.id - b.id,
      ),
    [banners],
  );

  if (loading) {
    return (
      <main className="min-h-screen bg-[#F8F5F0] p-6">
        <div className="mx-auto max-w-6xl rounded-3xl bg-white p-6 font-bold shadow-sm">
          배너를 불러오는 중...
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#F8F5F0] px-4 pb-24 pt-8 sm:px-6">
      <div className="mx-auto max-w-6xl">
        <header className="mb-6">
          <Link
            href={`/owner/business/${businessId}/manage`}
            className="text-sm font-black text-[#B64032]"
          >
            ← 비즈니스 사이트 관리
          </Link>

          <p className="mt-4 text-sm font-black uppercase tracking-[0.16em] text-[#B64032]">
            Business #{businessId}
          </p>

          <h1 className="mt-2 text-3xl font-black text-[#172033]">
            팝업 배너 관리
          </h1>

          <p className="mt-2 text-sm font-medium text-[#667085]">
            {businessName}에 사용할 배너 종류를 고르고
            내용과 이미지를 등록합니다.
          </p>
        </header>

        {message && (
          <div
            className={`mb-4 rounded-2xl px-4 py-3 text-sm font-bold ${
              message.startsWith("✓")
                ? "bg-green-50 text-green-700"
                : "bg-red-50 text-red-700"
            }`}
          >
            {message}
          </div>
        )}

        <section className="rounded-3xl border border-[#E9DED0] bg-white p-5 shadow-sm">
          <h2 className="text-lg font-black text-[#172033]">
            자유 디자인 팝업
          </h2>
          <p className="mt-2 text-sm font-medium leading-6 text-[#667085]">
            기본 포맷 하나에서 제목, 설명, 이미지, 버튼, 글자 크기와 색상을 직접 설정합니다.
            실제 팝업에 표시되는 글씨는 영어로 입력하세요.
          </p>
        </section>

        <section className="mt-5 rounded-3xl border border-[#E9DED0] bg-white p-5 shadow-sm">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <h2 className="text-lg font-black text-[#172033]">
                팝업 스타일 프리셋
              </h2>
              <p className="mt-1 text-xs font-medium text-[#667085]">
                프리셋을 누르면 모서리, 이미지, 버튼과 그림자가 한 번에 적용됩니다.
              </p>
            </div>

            <span className="rounded-full bg-[#FFF3DF] px-3 py-1.5 text-xs font-black text-[#B64032]">
              선택: {POPUP_STYLE_PRESETS.find((item) => item.id === stylePreset)?.name || "Custom"}
            </span>
          </div>

          <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {POPUP_STYLE_PRESETS.map((preset) => (
              <button
                key={preset.id}
                type="button"
                onClick={() => applyStylePreset(preset)}
                className={`rounded-2xl border p-4 text-left transition hover:-translate-y-0.5 hover:shadow-md ${
                  stylePreset === preset.id
                    ? "border-[#B64032] bg-[#FFF8EF] ring-2 ring-[#B64032]/20"
                    : "border-[#E9DED0] bg-white"
                }`}
              >
                <div className="flex items-center gap-3">
                  <div
                    className="flex h-12 w-16 items-center justify-center border border-black/10 bg-[#172033] text-xl text-white"
                    style={{
                      borderRadius: `${Math.min(28, preset.popupRadius)}px`,
                      boxShadow: getPopupShadow(preset.shadow),
                    }}
                  >
                    {preset.icon}
                  </div>
                  <div>
                    <p className="text-sm font-black text-[#172033]">{preset.name}</p>
                    <p className="mt-1 text-[11px] font-medium leading-4 text-[#667085]">
                      {preset.description}
                    </p>
                  </div>
                </div>
              </button>
            ))}
          </div>
        </section>

        <style jsx global>{`
          .popup-design-scroll::-webkit-scrollbar {
            width: 10px;
          }
          .popup-design-scroll::-webkit-scrollbar-track {
            background: #f5f1eb;
            border-radius: 999px;
          }
          .popup-design-scroll::-webkit-scrollbar-thumb {
            background: #c9bcae;
            border: 2px solid #f5f1eb;
            border-radius: 999px;
          }
          .popup-design-scroll::-webkit-scrollbar-thumb:hover {
            background: #a99886;
          }
        `}</style>

        <div className="mt-5 grid gap-5 lg:grid-cols-[1fr_420px]">
          <section className="rounded-3xl border border-[#E9DED0] bg-white shadow-sm lg:sticky lg:top-4 lg:flex lg:max-h-[calc(100vh-32px)] lg:flex-col lg:overflow-hidden">
            <div className="shrink-0 border-b border-[#E9DED0] bg-white px-5 py-4">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <h2 className="text-lg font-black text-[#172033]">
                    팝업 내용과 디자인
                  </h2>
                  <p className="mt-1 text-[11px] font-bold text-[#667085]">
                    아래 설정 영역만 스크롤됩니다. 미리보기는 옆에 그대로 유지됩니다.
                  </p>
                </div>
                <span className="hidden rounded-full bg-[#FFF3DF] px-3 py-1 text-[10px] font-black text-[#B64032] lg:inline-flex">
                  SCROLL
                </span>
              </div>
            </div>

            <div className="popup-design-scroll grid gap-4 p-5 lg:min-h-0 lg:flex-1 lg:overflow-y-auto lg:overscroll-contain lg:pr-3 [scrollbar-gutter:stable]">
              <label>
                <span className="mb-1 block text-xs font-black text-[#667085]">
                  제목
                </span>
                <input
                  value={title}
                  onChange={(event) =>
                    setTitle(event.target.value)
                  }
                  className="w-full rounded-xl border border-[#D9CFC2] px-4 py-3 text-sm font-bold outline-none focus:border-[#172033]"
                />
              </label>

              <label>
                <span className="mb-1 block text-xs font-black text-[#667085]">
                  설명
                </span>
                <textarea
                  value={subtitle}
                  onChange={(event) =>
                    setSubtitle(event.target.value)
                  }
                  rows={3}
                  className="w-full resize-y rounded-xl border border-[#D9CFC2] px-4 py-3 text-sm font-medium outline-none focus:border-[#172033]"
                />
              </label>

              <div className="grid gap-3 sm:grid-cols-3">
                <label>
                  <span className="mb-1 block text-xs font-black text-[#667085]">
                    제목 크기
                  </span>
                  <input
                    type="number"
                    min={16}
                    max={72}
                    value={titleFontSize}
                    onChange={(event) =>
                      setTitleFontSize(Number(event.target.value))
                    }
                    className="w-full rounded-xl border border-[#D9CFC2] px-3 py-3 text-sm font-black"
                  />
                </label>

                <label>
                  <span className="mb-1 block text-xs font-black text-[#667085]">
                    설명 크기
                  </span>
                  <input
                    type="number"
                    min={10}
                    max={40}
                    value={subtitleFontSize}
                    onChange={(event) =>
                      setSubtitleFontSize(Number(event.target.value))
                    }
                    className="w-full rounded-xl border border-[#D9CFC2] px-3 py-3 text-sm font-black"
                  />
                </label>

                <label>
                  <span className="mb-1 block text-xs font-black text-[#667085]">
                    글자 정렬
                  </span>
                  <select
                    value={textAlign}
                    onChange={(event) =>
                      setTextAlign(event.target.value as TextAlign)
                    }
                    className="w-full rounded-xl border border-[#D9CFC2] bg-white px-3 py-3 text-sm font-black"
                  >
                    <option value="left">왼쪽</option>
                    <option value="center">가운데</option>
                    <option value="right">오른쪽</option>
                  </select>
                </label>
              </div>

              <div className="grid gap-3 sm:grid-cols-3">
                <label>
                  <span className="mb-1 block text-xs font-black text-[#667085]">
                    제목 굵기
                  </span>
                  <select
                    value={titleFontWeight}
                    onChange={(event) =>
                      setTitleFontWeight(Number(event.target.value))
                    }
                    className="w-full rounded-xl border border-[#D9CFC2] bg-white px-3 py-3 text-sm font-black"
                  >
                    <option value={400}>보통</option>
                    <option value={600}>중간</option>
                    <option value={700}>굵게</option>
                    <option value={900}>아주 굵게</option>
                  </select>
                </label>

                <label>
                  <span className="mb-1 block text-xs font-black text-[#667085]">
                    설명 굵기
                  </span>
                  <select
                    value={subtitleFontWeight}
                    onChange={(event) =>
                      setSubtitleFontWeight(Number(event.target.value))
                    }
                    className="w-full rounded-xl border border-[#D9CFC2] bg-white px-3 py-3 text-sm font-black"
                  >
                    <option value={400}>보통</option>
                    <option value={500}>중간</option>
                    <option value={600}>약간 굵게</option>
                    <option value={700}>굵게</option>
                  </select>
                </label>

                <label>
                  <span className="mb-1 block text-xs font-black text-[#667085]">
                    팝업 가로 크기 (px)
                  </span>
                  <div className="space-y-2">
                    <input
                      type="range"
                      min={320}
                      max={1100}
                      step={10}
                      value={popupWidth}
                      onChange={(event) =>
                        setPopupWidth(Number(event.target.value))
                      }
                      className="w-full"
                    />
                    <input
                      type="number"
                      min={320}
                      max={1100}
                      value={popupWidth}
                      onChange={(event) =>
                        setPopupWidth(Number(event.target.value))
                      }
                      className="w-full rounded-xl border border-[#D9CFC2] px-3 py-3 text-sm font-black"
                    />
                  </div>
                </label>
              </div>

              <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
                {[
                  ["배경색", backgroundColor, setBackgroundColor],
                  ["제목색", titleColor, setTitleColor],
                  ["설명색", subtitleColor, setSubtitleColor],
                  ["버튼색", buttonColor, setButtonColor],
                  ["버튼 글자", buttonTextColor, setButtonTextColor],
                ].map(([label, value, setter]) => (
                  <label key={String(label)}>
                    <span className="mb-1 block text-[11px] font-black text-[#667085]">
                      {String(label)}
                    </span>
                    <input
                      type="color"
                      value={String(value)}
                      onChange={(event) =>
                        (setter as (value: string) => void)(
                          event.target.value,
                        )
                      }
                      className="h-11 w-full cursor-pointer rounded-xl border border-[#D9CFC2] bg-white p-1"
                    />
                  </label>
                ))}
              </div>

              <label className="flex items-center gap-2 rounded-xl bg-[#F8F5F0] px-4 py-3 text-sm font-black">
                <input
                  type="checkbox"
                  checked={buttonEnabled}
                  onChange={(event) =>
                    setButtonEnabled(event.target.checked)
                  }
                  className="h-4 w-4 accent-green-600"
                />
                버튼 사용
              </label>

              {buttonEnabled && (
              <div className="grid gap-3 sm:grid-cols-3">
                <label>
                  <span className="mb-1 block text-xs font-black text-[#667085]">
                    버튼 글씨
                  </span>
                  <input
                    value={buttonText}
                    onChange={(event) =>
                      setButtonText(event.target.value)
                    }
                    placeholder="예: 주문하기"
                    className="w-full rounded-xl border border-[#D9CFC2] px-4 py-3 text-sm font-bold outline-none"
                  />
                </label>

                <label>
                  <span className="mb-1 block text-xs font-black text-[#667085]">
                    연결 주소
                  </span>
                  <input
                    value={linkUrl}
                    onChange={(event) =>
                      setLinkUrl(event.target.value)
                    }
                    placeholder="/menu 또는 https://..."
                    className="w-full rounded-xl border border-[#D9CFC2] px-4 py-3 text-sm font-bold outline-none"
                  />
                </label>

                <label>
                  <span className="mb-1 block text-xs font-black text-[#667085]">
                    버튼 글자 크기
                  </span>
                  <input
                    type="number"
                    min={10}
                    max={32}
                    value={buttonFontSize}
                    onChange={(event) =>
                      setButtonFontSize(Number(event.target.value))
                    }
                    className="w-full rounded-xl border border-[#D9CFC2] px-3 py-3 text-sm font-black"
                  />
                </label>
              </div>
              )}

              <section className="rounded-2xl border border-[#D9CFC2] bg-[#FCFAF7] p-4">
                <label className="flex items-center justify-between gap-3">
                  <div>
                    <div className="text-sm font-black text-[#172033]">이메일 수집 + 쿠폰 발급</div>
                    <p className="mt-1 text-xs font-medium text-[#667085]">이메일을 저장하고 고유 쿠폰 코드를 발급하며, 선택적으로 리워드 가입 페이지로 연결합니다.</p>
                  </div>
                  <input type="checkbox" checked={leadCaptureEnabled} onChange={(event) => setLeadCaptureEnabled(event.target.checked)} className="h-5 w-5 accent-green-600" />
                </label>

                {leadCaptureEnabled && (
                  <div className="mt-4 grid gap-3">
                    <div className="grid gap-3 sm:grid-cols-2">
                      <FieldInput label="이메일 placeholder" value={emailPlaceholder} onChange={setEmailPlaceholder} />
                      <FieldInput label="제출 버튼 텍스트" value={submitButtonText} onChange={setSubmitButtonText} />
                      <FieldInput label="성공 메시지" value={successMessage} onChange={setSuccessMessage} />
                      <FieldInput label="쿠폰 코드 접두어" value={couponCodePrefix} onChange={setCouponCodePrefix} placeholder="WELCOME" />
                      <FieldInput label="리워드 가입 주소 (선택)" value={rewardSignupUrl} onChange={setRewardSignupUrl} placeholder="https://..." />
                      <label>
                        <span className="mb-1 block text-xs font-black text-[#667085]">폼 배경색</span>
                        <input type="color" value={formBackgroundColor} onChange={(event) => setFormBackgroundColor(event.target.value)} className="h-11 w-full rounded-xl border border-[#D9CFC2] bg-white p-1" />
                      </label>
                    </div>
                    <label>
                      <span className="mb-1 block text-xs font-black text-[#667085]">약관 / 안내 문구</span>
                      <textarea value={termsText} onChange={(event) => setTermsText(event.target.value)} rows={5} className="w-full rounded-xl border border-[#D9CFC2] px-4 py-3 text-sm font-medium outline-none" />
                    </label>
                    <label className="flex items-center gap-2 rounded-xl bg-white px-4 py-3 text-sm font-black">
                      <input type="checkbox" checked={leadExpandedMode} onChange={(event) => setLeadExpandedMode(event.target.checked)} className="h-4 w-4 accent-green-600" />
                      처음에는 이메일 입력만 표시하고, 클릭하면 약관과 제출 버튼 펼치기
                    </label>
                  </div>
                )}
              </section>

              <label>
                <span className="mb-1 block text-xs font-black text-[#667085]">
                  배너 이미지
                </span>

                <input
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  onChange={(event) => {
                    const file =
                      event.target.files?.[0];

                    event.currentTarget.value = "";

                    if (!file) return;

                    if (
                      imagePreview.startsWith("blob:")
                    ) {
                      URL.revokeObjectURL(
                        imagePreview,
                      );
                    }

                    setImageFile(file);
                    setRemoveImageRequested(false);
                    setImagePreview(
                      URL.createObjectURL(file),
                    );
                    setImageStatus(
                      `✓ 선택됨: ${file.name} (${Math.round(
                        file.size / 1024,
                      )} KB)`,
                    );
                  }}
                  className="block w-full rounded-xl border border-[#D9CFC2] bg-white px-3 py-3 text-sm font-bold"
                />

                <p className="mt-1 text-[11px] font-bold text-[#667085]">
                  원본은 저장하지 않고 최대 1600×900 WEBP로
                  축소해 저장합니다.
                </p>

                {imageStatus && (
                  <div
                    className={`mt-2 rounded-xl px-3 py-2 text-xs font-black ${
                      imageStatus.startsWith("✓")
                        ? "bg-green-50 text-green-700"
                        : "bg-blue-50 text-blue-700"
                    }`}
                  >
                    {imageStatus}
                  </div>
                )}

                {imagePreview && (
                  <div className="mt-3 overflow-hidden rounded-xl border border-[#E9DED0] bg-gray-50">
                    <div className="flex items-center justify-between gap-3 border-b border-[#E9DED0] bg-white px-3 py-2">
                      <div className="min-w-0">
                        <p className="truncate text-xs font-black text-[#172033]">
                          현재 팝업 이미지
                        </p>
                        <p className="mt-0.5 text-[10px] font-bold text-[#667085]">
                          삭제하면 미리보기에서 즉시 사라지고 저장 시에도 삭제 요청됩니다.
                        </p>
                      </div>

                      <button
                        type="button"
                        onClick={() => {
                          if (
                            imagePreview.startsWith("blob:")
                          ) {
                            URL.revokeObjectURL(imagePreview);
                          }

                          setImageFile(null);
                          setImagePreview("");
                          setRemoveImageRequested(true);
                          setImageStatus(
                            "이미지를 삭제했습니다. 아래 저장 버튼을 눌러 최종 반영하세요.",
                          );
                        }}
                        className="shrink-0 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-xs font-black text-red-700 transition hover:bg-red-100"
                      >
                        이미지 삭제
                      </button>
                    </div>

                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={imagePreview}
                      alt="Selected popup"
                      className="max-h-52 w-full object-contain"
                    />
                  </div>
                )}

                {!imagePreview && removeImageRequested ? (
                  <div className="mt-3 flex items-center justify-between gap-3 rounded-xl border border-red-200 bg-red-50 px-3 py-2.5">
                    <p className="text-xs font-black text-red-700">
                      이미지 삭제 예정 · 저장하면 팝업 이미지가 제거됩니다.
                    </p>
                    <button
                      type="button"
                      onClick={() => {
                        setRemoveImageRequested(false);

                        if (editingBanner?.image_url) {
                          setImagePreview(editingBanner.image_url);
                          setImageStatus(
                            "기존 이미지를 다시 사용합니다.",
                          );
                        } else {
                          setImageStatus("");
                        }
                      }}
                      className="shrink-0 rounded-lg bg-white px-3 py-1.5 text-[11px] font-black text-red-700 shadow-sm"
                    >
                      삭제 취소
                    </button>
                  </div>
                ) : null}
              </label>

              <label>
                <span className="mb-1 block text-xs font-black text-[#667085]">
                  이미지 배치 방식
                </span>
                <select
                  value={imagePosition}
                  onChange={(event) =>
                    setImagePosition(event.target.value as ImagePosition)
                  }
                  className="w-full rounded-xl border border-[#D9CFC2] bg-white px-3 py-3 text-sm font-black"
                >
                  <option value="top">자유 배치</option>
                  <option value="left">왼쪽</option>
                  <option value="background">배경 이미지</option>
                </select>
              </label>

              <div className="grid gap-3 sm:grid-cols-2">
                <label>
                  <span className="mb-1 block text-xs font-black text-[#667085]">
                    이미지 표시 방식
                  </span>
                  <select
                    value={imageFit}
                    onChange={(event) =>
                      setImageFit(event.target.value as ImageFit)
                    }
                    className="w-full rounded-xl border border-[#D9CFC2] bg-white px-3 py-3 text-sm font-black"
                  >
                    <option value="contain">전체 보기 · 원본 비율</option>
                    <option value="cover">영역 꽉 채우기 · 일부 잘림</option>
                    <option value="fill">영역에 맞춰 늘리기</option>
                  </select>
                </label>

                <label>
                  <div className="mb-1 flex items-center justify-between gap-2">
                    <span className="text-xs font-black text-[#667085]">
                      이미지 확대 · 축소
                    </span>
                    <span className="rounded bg-[#FFF3DF] px-2 py-0.5 text-[11px] font-black text-[#B64032]">
                      {imageZoom}%
                    </span>
                  </div>
                  <input
                    type="range"
                    min={25}
                    max={300}
                    step={5}
                    value={imageZoom}
                    onChange={(event) =>
                      setImageZoom(Number(event.target.value))
                    }
                    className="w-full"
                  />
                </label>
              </div>


              <div className="rounded-2xl border border-[#E9DED0] bg-[#FCFAF7] p-4">
                <h3 className="text-base font-black text-[#172033]">
                  모서리와 그림자 직접 조절
                </h3>
                <p className="mt-1 text-xs font-medium text-[#667085]">
                  프리셋 적용 후 필요한 부분만 세밀하게 조절할 수 있습니다.
                </p>

                <div className="mt-4 grid gap-3 sm:grid-cols-2">
                  <NumberControl label="팝업 모서리 (px)" value={popupRadius} min={0} max={999} onChange={(value) => { setPopupRadius(value); setStylePreset("rounded"); }} />
                  <NumberControl label="이미지 모서리 (px)" value={imageRadius} min={0} max={999} onChange={(value) => { setImageRadius(value); setStylePreset("rounded"); }} />
                  <NumberControl label="버튼 모서리 (px)" value={buttonRadius} min={0} max={999} onChange={(value) => { setButtonRadius(value); setStylePreset("rounded"); }} />

                  <label>
                    <span className="mb-1 block text-[11px] font-black text-[#667085]">팝업 그림자</span>
                    <select
                      value={popupShadow}
                      onChange={(event) => setPopupShadow(event.target.value as PopupShadow)}
                      className="w-full rounded-xl border border-[#D9CFC2] bg-white px-3 py-3 text-sm font-black"
                    >
                      <option value="none">없음</option>
                      <option value="small">작게</option>
                      <option value="medium">중간</option>
                      <option value="large">크게</option>
                      <option value="glass">Glass</option>
                    </select>
                  </label>
                </div>
              </div>

              <div className="rounded-2xl border border-[#E9DED0] bg-[#FCFAF7] p-4">
                <h3 className="text-base font-black text-[#172033]">
                  팝업·이미지 크기 및 위치
                </h3>
                <p className="mt-1 text-xs font-medium leading-5 text-[#667085]">
                  아래 슬라이더로 크기를 조절하고, 오른쪽 미리보기에서는
                  점선 박스를 직접 끌어서 위치를 바꿀 수 있습니다.
                </p>

                <div className="mt-3 grid gap-2 sm:grid-cols-2">
                  <div className="rounded-xl bg-blue-50 px-3 py-2 text-xs font-black text-blue-700">
                    팝업 크기: {popupWidth}px × {popupHeight}px
                  </div>

                  <div className="rounded-xl bg-amber-50 px-3 py-2 text-xs font-black text-amber-700">
                    이미지 크기: {imageWidth}% × {imageHeight}%
                  </div>
                </div>

                <div className="mt-4 grid gap-3 sm:grid-cols-2">
                  <NumberControl label="팝업 세로 크기 (px)" value={popupHeight} min={320} max={900} onChange={setPopupHeight} />
                  <NumberControl label="글자 영역 가로 크기 (%)" value={textWidth} min={20} max={100} onChange={setTextWidth} />
                  <NumberControl label="글자 왼쪽 위치 (%)" value={textX} min={0} max={Math.max(0, 100 - textWidth)} onChange={setTextX} />
                  <NumberControl label="글자 위쪽 위치 (%)" value={textY} min={0} max={92} onChange={setTextY} />
                  <NumberControl label="이미지 가로 크기 (%)" value={imageWidth} min={10} max={100} onChange={setImageWidth} />
                  <NumberControl label="이미지 세로 크기 (%)" value={imageHeight} min={10} max={100} onChange={setImageHeight} />
                  <NumberControl label="이미지 왼쪽 위치 (%)" value={imageX} min={0} max={Math.max(0, 100 - imageWidth)} onChange={setImageX} />
                  <NumberControl label="이미지 위쪽 위치 (%)" value={imageY} min={0} max={Math.max(0, 100 - imageHeight)} onChange={setImageY} />
                </div>
              </div>

              <div className="grid gap-3 sm:grid-cols-3">
                <label>
                  <span className="mb-1 block text-xs font-black text-[#667085]">
                    노출 순서
                  </span>
                  <input
                    type="number"
                    min={1}
                    value={displayOrder}
                    onChange={(event) =>
                      setDisplayOrder(
                        Number(event.target.value),
                      )
                    }
                    className="w-full rounded-xl border border-[#D9CFC2] px-4 py-3 text-sm font-black"
                  />
                </label>

                <label>
                  <span className="mb-1 block text-xs font-black text-[#667085]">
                    시작일
                  </span>
                  <input
                    type="datetime-local"
                    value={startsAt}
                    onChange={(event) =>
                      setStartsAt(event.target.value)
                    }
                    className="w-full rounded-xl border border-[#D9CFC2] px-3 py-3 text-xs font-bold"
                  />
                </label>

                <label>
                  <span className="mb-1 block text-xs font-black text-[#667085]">
                    종료일 (필수)
                  </span>
                  <input
                    type="datetime-local"
                    required
                    value={endsAt}
                    onChange={(event) =>
                      setEndsAt(event.target.value)
                    }
                    className="w-full rounded-xl border border-[#D9CFC2] px-3 py-3 text-xs font-bold"
                  />
                </label>
              </div>

              <label className="flex items-center gap-2 rounded-xl bg-[#F8F5F0] px-4 py-3 text-sm font-black">
                <input
                  type="checkbox"
                  checked={isActive}
                  onChange={(event) =>
                    setIsActive(event.target.checked)
                  }
                  className="h-4 w-4 accent-green-600"
                />
                바로 노출
              </label>

              <div className="flex flex-wrap gap-3">
                <button
                  type="button"
                  onClick={() => void saveBanner()}
                  disabled={saving}
                  className="rounded-xl bg-green-600 px-5 py-3 text-sm font-black text-white disabled:opacity-50"
                >
                  {saving
                    ? "저장 중..."
                    : editingBanner
                      ? "팝업 수정 저장"
                      : "팝업 등록"}
                </button>

                {editingBanner && (
                  <button
                    type="button"
                    onClick={() =>
                      applyTemplate(selectedTemplate)
                    }
                    className="rounded-xl border border-[#D9CFC2] bg-white px-5 py-3 text-sm font-black"
                  >
                    수정 취소
                  </button>
                )}
              </div>
            </div>
          </section>

          <section className="rounded-3xl border border-[#E9DED0] bg-white p-5 shadow-sm lg:sticky lg:top-4 lg:self-start">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 className="text-lg font-black text-[#172033]">
                미리보기
              </h2>

              <div className="flex flex-wrap gap-2 text-[11px] font-black">
                <span className="rounded-full bg-blue-100 px-3 py-1.5 text-blue-700">
                  점선 글자 박스 = 글자 위치
                </span>
                <span className="rounded-full bg-amber-100 px-3 py-1.5 text-amber-700">
                  점선 이미지 박스 = 이미지 위치·크기
                </span>
              </div>
            </div>

            <p className="mt-2 text-xs font-medium leading-5 text-[#667085]">
              글자 박스와 이미지 박스를 마우스로 끌어 이동하세요.
              크기는 왼쪽의 슬라이더에서 조절합니다.
            </p>

            <div
              className="relative mt-4 overflow-hidden border border-black/10"
              style={{
                maxWidth: `${popupWidth}px`,
                borderRadius: `${popupRadius}px`,
                boxShadow: getPopupShadow(popupShadow),
                height: `${popupHeight}px`,
                backgroundColor,
                backgroundImage:
                  imagePosition === "background" && imagePreview
                    ? `linear-gradient(rgba(0,0,0,.36), rgba(0,0,0,.36)), url(${imagePreview})`
                    : undefined,
                backgroundSize: "cover",
                backgroundPosition: "center",
                touchAction: "none",
              }}
              onPointerMove={handlePreviewPointerMove}
              onPointerUp={() => setDragging(null)}
              onPointerLeave={() => setDragging(null)}
            >
              <div className="absolute bottom-2 right-2 z-30 rounded-lg bg-white/90 px-2 py-1 text-[10px] font-black text-[#172033] shadow">
                팝업 {popupWidth}px × {popupHeight}px
              </div>

              <button
                type="button"
                className="absolute right-3 top-3 z-30 flex h-9 w-9 items-center justify-center rounded-full bg-black/70 text-xl font-black leading-none text-white shadow-lg"
                aria-label="미리보기 닫기 버튼"
              >
                ×
              </button>

              {imagePreview && imagePosition !== "background" && (
                <div
                  onPointerDown={(event) => {
                    event.currentTarget.setPointerCapture(event.pointerId);
                    setDragging("image");
                  }}
                  className="absolute z-10 cursor-move overflow-hidden border-2 border-dashed border-amber-400 bg-white shadow-lg"
                  style={{
                    borderRadius: `${imageRadius}px`,
                    left: `${imageX}%`,
                    top: `${imageY}%`,
                    width: `${imageWidth}%`,
                    height: `${imageHeight}%`,
                  }}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
  src={imagePreview}
  alt=""
  className="h-full w-full object-contain"
/>
                  <span className="absolute bottom-1 left-1 rounded bg-black/60 px-2 py-1 text-[10px] font-black text-white">
                    이미지 이동
                  </span>

                  <span className="absolute bottom-1 right-1 rounded bg-white/90 px-2 py-1 text-[10px] font-black text-[#172033]">
                    {imageWidth}% × {imageHeight}% · {imageZoom}%
                  </span>

                  <span className="absolute right-0 top-0 h-4 w-4 rounded-bl bg-amber-400 shadow-md" />
                  <span className="absolute bottom-0 left-0 h-4 w-4 rounded-tr bg-amber-400 shadow-md" />
                </div>
              )}

              <div
                onPointerDown={(event) => {
                  event.currentTarget.setPointerCapture(event.pointerId);
                  setDragging("text");
                }}
                className="absolute z-20 cursor-move rounded-xl border-2 border-dashed border-white/50 p-4"
                style={{
                  left: `${textX}%`,
                  top: `${textY}%`,
                  width: `${textWidth}%`,
                  textAlign,
                }}
              >
                <div
                  style={{
                    color: titleColor,
                    fontSize: `${titleFontSize}px`,
                    fontWeight: titleFontWeight,
                    lineHeight: 1.15,
                  }}
                >
                  {title || "Popup Title"}
                </div>

                {subtitle && (
                  <p
                    className="mt-2 leading-6"
                    style={{
                      color: subtitleColor,
                      fontSize: `${subtitleFontSize}px`,
                      fontWeight: subtitleFontWeight,
                    }}
                  >
                    {subtitle}
                  </p>
                )}

                {buttonEnabled && buttonText && (
                  <div
                    className="mt-4 inline-flex rounded-xl px-4 py-2.5 font-black"
                    style={{
                      backgroundColor: buttonColor,
                      color: buttonTextColor,
                      fontSize: `${buttonFontSize}px`,
                      borderRadius: `${buttonRadius}px`,
                    }}
                  >
                    {buttonText}
                  </div>
                )}

                <p
                  className="mt-4 text-[11px] font-bold"
                  style={{ color: subtitleColor, opacity: 0.65 }}
                >
                  Close this popup to hide it for 24 hours.
                </p>

                <span className="absolute -top-6 left-0 rounded bg-black/60 px-2 py-1 text-[10px] font-black text-white">
                  글자 이동
                </span>
              </div>
            </div>
          </section>
        </div>

        <section className="mt-5 rounded-3xl border border-[#E9DED0] bg-white p-5 shadow-sm">
          <h2 className="text-lg font-black text-[#172033]">
            등록된 팝업
          </h2>

          <div className="mt-4 space-y-3">
            {sortedBanners.length === 0 ? (
              <div className="rounded-2xl bg-[#F8F5F0] p-5 text-center text-sm font-bold text-[#667085]">
                아직 등록된 팝업이 없습니다.
              </div>
            ) : (
              sortedBanners.map((banner) => (
                <article
                  key={banner.id}
                  className={`rounded-2xl border p-4 ${
                    banner.is_active
                      ? "border-[#E9DED0]"
                      : "border-gray-200 bg-gray-50 opacity-65"
                  }`}
                >
                  <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
                    <div className="h-20 w-full overflow-hidden rounded-xl bg-gray-100 sm:w-28">
                      {banner.image_url ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={banner.image_url}
                          alt={banner.title}
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        <div
                          className="flex h-full items-center justify-center text-2xl"
                          style={{
                            backgroundColor:
                              banner.background_color,
                            color: banner.text_color,
                          }}
                        >
                          {TEMPLATES.find(
                            (item) =>
                              item.style ===
                              (banner.template_style || "classic"),
                          )?.icon || "📣"}
                        </div>
                      )}
                    </div>

                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="font-black text-[#172033]">
                          {banner.title}
                        </h3>

                        <span className="rounded-full bg-[#FFF3DF] px-2 py-1 text-[10px] font-black text-[#B64032]">
                          {TEMPLATES.find(
                            (item) =>
                              item.style ===
                              (banner.template_style || "classic"),
                          )?.name || banner.banner_type}
                        </span>

                        <span
                          className={`rounded-full px-2 py-1 text-[10px] font-black ${
                            banner.is_active
                              ? "bg-green-100 text-green-700"
                              : "bg-gray-200 text-gray-600"
                          }`}
                        >
                          {banner.is_active
                            ? "노출 중"
                            : "숨김"}
                        </span>
                      </div>

                      <p className="mt-1 text-xs font-medium text-[#667085]">
                        순서 {banner.display_order}
                        {banner.starts_at
                          ? ` · 시작 ${new Date(
                              banner.starts_at,
                            ).toLocaleString()}`
                          : ""}
                        {banner.ends_at
                          ? ` · 종료 ${new Date(
                              banner.ends_at,
                            ).toLocaleString()}`
                          : ""}
                      </p>
                    </div>

                    <div className="flex shrink-0 flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={() => editBanner(banner)}
                        className="rounded-xl bg-[#172033] px-3 py-2 text-xs font-black text-white"
                      >
                        수정
                      </button>

                      <button
                        type="button"
                        onClick={() =>
                          void toggleBanner(banner)
                        }
                        disabled={saving}
                        className="rounded-xl bg-yellow-100 px-3 py-2 text-xs font-black text-yellow-800 disabled:opacity-50"
                      >
                        {banner.is_active
                          ? "숨기기"
                          : "보이기"}
                      </button>

                      <button
                        type="button"
                        onClick={() =>
                          void deleteBanner(banner)
                        }
                        disabled={saving}
                        className="rounded-xl bg-red-50 px-3 py-2 text-xs font-black text-red-600 disabled:opacity-50"
                      >
                        삭제
                      </button>
                    </div>
                  </div>
                </article>
              ))
            )}
          </div>
        </section>
      </div>
    </main>
  );
}

type NumberControlProps = {
  label: string;
  value: number;
  min: number;
  max: number;
  onChange: (value: number) => void;
};


function FieldInput({ label, value, onChange, placeholder = "" }: { label: string; value: string; onChange: (value: string) => void; placeholder?: string; }) {
  return (
    <label>
      <span className="mb-1 block text-xs font-black text-[#667085]">{label}</span>
      <input value={value} onChange={(event) => onChange(event.target.value)} placeholder={placeholder} className="w-full rounded-xl border border-[#D9CFC2] px-4 py-3 text-sm font-bold outline-none" />
    </label>
  );
}

function NumberControl({
  label,
  value,
  min,
  max,
  onChange,
}: NumberControlProps) {
  const safeMin = Number.isFinite(min) ? min : 0;
  const safeMax = Number.isFinite(max)
    ? Math.max(safeMin, max)
    : safeMin;

  const safeValue = Math.max(
    safeMin,
    Math.min(
      safeMax,
      Number.isFinite(value) ? value : safeMin,
    ),
  );

  function updateValue(nextValue: number) {
    if (!Number.isFinite(nextValue)) return;

    onChange(
      Math.max(
        safeMin,
        Math.min(safeMax, nextValue),
      ),
    );
  }

  return (
    <label className="block">
      <div className="mb-1 flex items-center justify-between gap-2">
        <span className="block text-[11px] font-black text-[#667085]">
          {label}
        </span>
        <span className="rounded bg-[#F2EEE8] px-2 py-0.5 text-[10px] font-black text-[#172033]">
          {Math.round(safeValue)}
        </span>
      </div>

      <div className="flex items-center gap-2">
        <input
          type="range"
          min={safeMin}
          max={safeMax}
          step={1}
          value={safeValue}
          onChange={(event) =>
            updateValue(
              Number(event.target.value),
            )
          }
          className="min-w-0 flex-1 cursor-pointer"
        />

        <input
          type="number"
          min={safeMin}
          max={safeMax}
          step={1}
          value={Math.round(safeValue)}
          onChange={(event) =>
            updateValue(
              Number(event.target.value),
            )
          }
          className="w-20 rounded-lg border border-[#D9CFC2] px-2 py-2 text-center text-xs font-black outline-none focus:border-[#172033]"
        />
      </div>
    </label>
  );
}