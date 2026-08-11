"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";
import ProfileButton from "@/app/components/ProfileButton";

type BannerType = "popup";
type DisplayLocation = "all" | "home" | "community" | "events";

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
  title_x?: number;
  title_y?: number;
  title_width?: number;
  subtitle_x?: number;
  subtitle_y?: number;
  subtitle_width?: number;
  button_x?: number;
  button_y?: number;
  button_width?: number;
  button_height?: number;
  hide_24h_enabled?: boolean;
  hide_days?: number;
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
  display_location?: DisplayLocation;
  display_order: number;
  is_active: boolean;
  starts_at: string | null;
  ends_at: string | null;
};

type ApiResponse = {
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
    name: "Custom Design Popup",
    description: "Customize font sizes, colors, images, buttons, and alignment.",
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
    description: "Basic square with sharp corners",
    popupRadius: 0,
    imageRadius: 0,
    buttonRadius: 0,
    shadow: "small",
  },
  {
    id: "rounded",
    icon: "▢",
    name: "Rounded",
    description: "Soft rounded corners",
    popupRadius: 28,
    imageRadius: 18,
    buttonRadius: 12,
    shadow: "medium",
  },
  {
    id: "modern",
    icon: "✦",
    name: "Modern",
    description: "Large rounded corners with a deep shadow",
    popupRadius: 36,
    imageRadius: 24,
    buttonRadius: 16,
    shadow: "large",
  },
  {
    id: "glass",
    icon: "◇",
    name: "Glass",
    description: "Light and transparent look",
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
    description: "Large rounded corners like a mobile card",
    popupRadius: 44,
    imageRadius: 32,
    buttonRadius: 999,
    shadow: "large",
  },
  {
    id: "coupon",
    icon: "🎟",
    name: "Coupon",
    description: "A style designed for coupon cards",
    popupRadius: 20,
    imageRadius: 12,
    buttonRadius: 8,
    shadow: "medium",
  },
  {
    id: "circle",
    icon: "●",
    name: "Circle",
    description: "Fully rounded capsule/circle style",
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
      reject(new Error("Unable to read the image."));
    };

    image.src = url;
  });
}

async function resizeBannerImage(file: File) {
  if (!file.type.startsWith("image/")) {
    throw new Error("Please select an image file only.");
  }

  if (file.size > 20 * 1024 * 1024) {
    throw new Error("The original file must be 20MB or smaller.");
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
    throw new Error("Image processing is unavailable.");
  }

  context.imageSmoothingEnabled = true;
  context.imageSmoothingQuality = "high";
  context.drawImage(image, 0, 0, width, height);

  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (blob) =>
        blob
          ? resolve(blob)
          : reject(new Error("Image conversion failed.")),
      "image/webp",
      0.82,
    );
  });
}

export default function BannerManagementPage() {
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
  const [textEnabled, setTextEnabled] = useState(true);
  const [textX, setTextX] = useState(8);
  const [textY, setTextY] = useState(16);
  const [textWidth, setTextWidth] = useState(84);
  // Title/Description/버튼을 서로 독립적으로 드래그하기 위한 위치/크기
  const [titleX, setTitleX] = useState(8);
  const [titleY, setTitleY] = useState(14);
  const [titleWidth, setTitleWidth] = useState(84);
  const [subtitleX, setSubtitleX] = useState(8);
  const [subtitleY, setSubtitleY] = useState(32);
  const [subtitleWidth, setSubtitleWidth] = useState(84);
  const [buttonX, setButtonX] = useState(8);
  const [buttonY, setButtonY] = useState(52);
  const [buttonWidth, setButtonWidth] = useState(34);
  const [buttonHeight, setButtonHeight] = useState(10);
  const [hide24HoursEnabled, setHide24HoursEnabled] = useState(true);
  const [hideDays, setHideDays] = useState("1");
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
  const [dragging, setDragging] = useState<"title" | "subtitle" | "button" | "image" | null>(null);
  const [displayLocation, setDisplayLocation] = useState<DisplayLocation>("all");
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
  }, []);

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
      throw new Error("Please log in.");
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
      `/api/admin/banners`,
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
        data.error || "Unable to process the request.",
      );
    }

    return data;
  }

  async function loadBanners() {
    setLoading(true);
    setMessage("");

    try {
      const data = await request("GET");

      setBanners(data.banners || []);
      setDisplayOrder((data.banners?.length || 0) + 1);
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "Unable to load banners.",
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
    setTextEnabled(true);
    setTextX(8);
    setTextY(16);
    setTextWidth(84);
    setTitleX(8);
    setTitleY(14);
    setTitleWidth(84);
    setSubtitleX(8);
    setSubtitleY(32);
    setSubtitleWidth(84);
    setButtonX(8);
    setButtonY(52);
    setButtonWidth(34);
    setButtonHeight(10);
    setHide24HoursEnabled(true);
    setHideDays("1");
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
    setDisplayLocation("all");
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
        ? "✓ An existing image is registered."
        : "No image is registered.",
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
    setTextEnabled(
      Boolean(
        (banner.title || "").trim() ||
        (banner.subtitle || "").trim() ||
        (banner.button_enabled !== false && (banner.button_text || "").trim()),
      ),
    );
    setTextX(Number(banner.text_x) || 8);
    setTextY(Number(banner.text_y) || 16);
    setTextWidth(Number(banner.text_width) || 84);
    setTitleX(Number(banner.title_x ?? banner.text_x) || 8);
    setTitleY(Number(banner.title_y ?? banner.text_y) || 14);
    setTitleWidth(Number(banner.title_width ?? banner.text_width) || 84);
    setSubtitleX(Number(banner.subtitle_x ?? banner.text_x) || 8);
    setSubtitleY(Number(banner.subtitle_y) || 32);
    setSubtitleWidth(Number(banner.subtitle_width ?? banner.text_width) || 84);
    setButtonX(Number(banner.button_x ?? banner.text_x) || 8);
    setButtonY(Number(banner.button_y) || 52);
    setButtonWidth(Number(banner.button_width) || 34);
    setButtonHeight(Number(banner.button_height) || 10);
    setHide24HoursEnabled(banner.hide_24h_enabled !== false);
    setHideDays(String(Math.max(1, Math.min(31, Number(banner.hide_days) || 1))));
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
    setDisplayLocation(
      banner.display_location === "home" ||
      banner.display_location === "community" ||
      banner.display_location === "events"
        ? banner.display_location
        : "all",
    );
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
    if (leadCaptureEnabled && !emailPlaceholder.trim()) {
      alert("Please enter the email placeholder text.");
      return;
    }

    if (!endsAt) {
      alert("Please enter the popup end date.");
      return;
    }

    if (
      startsAt &&
      new Date(startsAt).getTime() >=
        new Date(endsAt).getTime()
    ) {
      alert("The end date must be later than the start date.");
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
      formData.append("title", textEnabled ? title.trim() : "");
      formData.append("subtitle", textEnabled ? subtitle.trim() : "");
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
      formData.append("title_x", String(titleX));
      formData.append("title_y", String(titleY));
      formData.append("title_width", String(titleWidth));
      formData.append("subtitle_x", String(subtitleX));
      formData.append("subtitle_y", String(subtitleY));
      formData.append("subtitle_width", String(subtitleWidth));
      formData.append("button_x", String(buttonX));
      formData.append("button_y", String(buttonY));
      formData.append("button_width", String(buttonWidth));
      formData.append("button_height", String(buttonHeight));
      formData.append("hide_24h_enabled", String(hide24HoursEnabled));
      formData.append("hide_days", String(Math.max(1, Math.min(31, Number(hideDays) || 1))));
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
      formData.append("display_location", displayLocation);
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
        setImageStatus("Converting the image to WEBP and uploading...");

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
          "Unable to retrieve the saved popup information.",
        );
      }

      if (
        isUploadingNewImage &&
        !data.banner.image_url
      ) {
        throw new Error(
          "The popup was saved, but the image path was not saved.",
        );
      }

      if (data.banner.image_url) {
        setImageStatus("✓ The image has been saved to Storage and the database.");
      }

      setMessage(
        editingBanner
          ? "✓ Popup updated."
          : "✓ Popup created.",
      );

      await loadBanners();
      applyTemplate(selectedTemplate);
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "Failed to save banner.",
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
          "Unable to change banner status.",
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
          : "Failed to change banner status.",
      );
    } finally {
      setSaving(false);
    }
  }

  async function deleteBanner(banner: Banner) {
    if (
      !window.confirm(
        `"${banner.title}" banner?`,
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

      setMessage("✓ Banner deleted.");
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "Failed to delete banner.",
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

    if (dragging === "title") {
      setTitleX(clamp(x, 0, Math.max(0, 100 - titleWidth)));
      setTitleY(clamp(y, 0, 94));
    } else if (dragging === "subtitle") {
      setSubtitleX(clamp(x, 0, Math.max(0, 100 - subtitleWidth)));
      setSubtitleY(clamp(y, 0, 94));
    } else if (dragging === "button") {
      setButtonX(clamp(x, 0, Math.max(0, 100 - buttonWidth)));
      setButtonY(clamp(y, 0, Math.max(0, 100 - buttonHeight)));
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
          Loading KTownTriangle banners...
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#F8F5F0] px-4 pb-24 pt-8 sm:px-6">
      <div className="mx-auto max-w-6xl">
        {/* ADMIN HEADER */}
        <div className="relative mb-5 flex min-h-[48px] items-center border-b border-[#E9DED0] pb-3">
          <Link
            href="/admin"
            className="rounded-xl border border-[#E5DED4] bg-white px-3 py-2 text-sm font-black text-[#172033] shadow-sm transition hover:bg-[#FCFAF7] active:scale-[0.98]"
          >
            ← Back
          </Link>

          <h1 className="pointer-events-none absolute left-1/2 -translate-x-1/2 whitespace-nowrap text-2xl font-black text-[#172033]">
            Banner Management
          </h1>

          <div className="ml-auto">
            <ProfileButton />
          </div>
        </div>

        {/* BANNER MANAGEMENT TOOLBAR */}
        <section className="mb-5 rounded-2xl border border-[#E9DED0] bg-white p-5 shadow-sm">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <h2 className="text-lg font-black text-[#172033]">
                Banner Management
              </h2>
              <p className="mt-1 text-sm font-medium text-[#667085]">
                Manage shared banners for KTownTriangle Home, Community, Events, and more.
              </p>
            </div>

            <button
              type="button"
              onClick={() => {
                applyTemplate(TEMPLATES[0]);
                window.setTimeout(() => {
                  document.getElementById("banner-editor")?.scrollIntoView({
                    behavior: "smooth",
                    block: "start",
                  });
                }, 50);
              }}
              className="shrink-0 rounded-xl bg-[#172033] px-5 py-3 text-sm font-black text-white shadow-sm transition hover:bg-[#26324A] active:scale-[0.98]"
            >
              + Add New Banner
            </button>
          </div>

          <div className="mt-4 max-w-[280px]">
            <label className="mb-1.5 block text-xs font-black text-[#667085]">
              Display Location
            </label>
            <select
              value={displayLocation}
              onChange={(event) =>
                setDisplayLocation(event.target.value as DisplayLocation)
              }
              className="w-full rounded-xl border border-[#D9CFC2] bg-white px-3 py-3 text-sm font-bold text-[#172033] outline-none focus:border-[#172033]"
            >
              <option value="all">All Locations</option>
              <option value="home">Home</option>
              <option value="community">Community</option>
              <option value="events">Events</option>
            </select>
          </div>
        </section>

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

        <section id="banner-editor" className="scroll-mt-5 rounded-3xl border border-[#E9DED0] bg-white p-5 shadow-sm">
          <h2 className="text-lg font-black text-[#172033]">
            Custom Design Popup
          </h2>
          <p className="mt-2 text-sm font-medium leading-6 text-[#667085]">
            Customize the title, description, image, button, font sizes, and colors using one flexible popup format.
            Enter the text that will appear in the actual popup in English.
          </p>
        </section>

        <section className="mt-5 rounded-3xl border border-[#E9DED0] bg-white p-5 shadow-sm">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <h2 className="text-lg font-black text-[#172033]">
                Popup Style Presets
              </h2>
              <p className="mt-1 text-xs font-medium text-[#667085]">
                Select a preset to apply corners, image style, buttons, and shadows at once.
              </p>
            </div>

            <span className="rounded-full bg-[#FFF3DF] px-3 py-1.5 text-xs font-black text-[#B64032]">
              Selected: {POPUP_STYLE_PRESETS.find((item) => item.id === stylePreset)?.name || "Custom"}
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
                    Popup Content & Design
                  </h2>
                  <p className="mt-1 text-[11px] font-bold text-[#667085]">
                    Only the settings area below scrolls. The preview remains visible beside it.
                  </p>
                </div>
                <span className="hidden rounded-full bg-[#FFF3DF] px-3 py-1 text-[10px] font-black text-[#B64032] lg:inline-flex">
                  SCROLL
                </span>
              </div>
            </div>

            <div className="popup-design-scroll grid gap-4 p-5 lg:min-h-0 lg:flex-1 lg:overflow-y-auto lg:overscroll-contain lg:pr-3 [scrollbar-gutter:stable]">
              <label className="flex items-center justify-between gap-3 rounded-2xl border border-[#D9CFC2] bg-[#FCFAF7] px-4 py-3">
                <div>
                  <div className="text-sm font-black text-[#172033]">Show Text</div>
                  <p className="mt-1 text-[11px] font-bold text-[#667085]">
                    Turn this off to hide only the title and description. The button can be enabled or disabled separately below.
                  </p>
                </div>
                <input
                  type="checkbox"
                  checked={textEnabled}
                  onChange={(event) => setTextEnabled(event.target.checked)}
                  className="h-5 w-5 shrink-0 accent-green-600"
                />
              </label>

              <div className="contents">
              <label>
                <span className="mb-1 block text-xs font-black text-[#667085]">
                  Title
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
                  Description
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
                    Title 크기
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
                    Description 크기
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
                    Text Alignment
                  </span>
                  <select
                    value={textAlign}
                    onChange={(event) =>
                      setTextAlign(event.target.value as TextAlign)
                    }
                    className="w-full rounded-xl border border-[#D9CFC2] bg-white px-3 py-3 text-sm font-black"
                  >
                    <option value="left">Left</option>
                    <option value="center">Center</option>
                    <option value="right">Right</option>
                  </select>
                </label>
              </div>

              <div className="grid gap-3 sm:grid-cols-3">
                <label>
                  <span className="mb-1 block text-xs font-black text-[#667085]">
                    Title 굵기
                  </span>
                  <select
                    value={titleFontWeight}
                    onChange={(event) =>
                      setTitleFontWeight(Number(event.target.value))
                    }
                    className="w-full rounded-xl border border-[#D9CFC2] bg-white px-3 py-3 text-sm font-black"
                  >
                    <option value={400}>Regular</option>
                    <option value={600}>Medium</option>
                    <option value={700}>Bold</option>
                    <option value={900}>아주 Bold</option>
                  </select>
                </label>

                <label>
                  <span className="mb-1 block text-xs font-black text-[#667085]">
                    Description 굵기
                  </span>
                  <select
                    value={subtitleFontWeight}
                    onChange={(event) =>
                      setSubtitleFontWeight(Number(event.target.value))
                    }
                    className="w-full rounded-xl border border-[#D9CFC2] bg-white px-3 py-3 text-sm font-black"
                  >
                    <option value={400}>Regular</option>
                    <option value={500}>Medium</option>
                    <option value={600}>약간 Bold</option>
                    <option value={700}>Bold</option>
                  </select>
                </label>

                <label>
                  <span className="mb-1 block text-xs font-black text-[#667085]">
                    Popup Width (px)
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
                  ["Background", backgroundColor, setBackgroundColor],
                  ["Title색", titleColor, setTitleColor],
                  ["Description색", subtitleColor, setSubtitleColor],
                  ["Button Color", buttonColor, setButtonColor],
                  ["Button Text", buttonTextColor, setButtonTextColor],
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

              <div className="rounded-2xl border border-blue-200 bg-blue-50/60 p-4">
                <div className="text-sm font-black text-[#172033]">Element Position & Size</div>
                <p className="mt-1 text-[11px] font-bold leading-5 text-[#667085]">
                  미리보기에서 Title, Description, 버튼을 각각 직접 드래그해 위치를 바꿀 수 있습니다. 아래에서는 각 요소의 가로 크기를 조절합니다.
                </p>
                <div className="mt-3 grid gap-3 sm:grid-cols-3">
                  <NumberControl label="Title 가로 (%)" value={titleWidth} min={10} max={100} onChange={setTitleWidth} />
                  <NumberControl label="Description 가로 (%)" value={subtitleWidth} min={10} max={100} onChange={setSubtitleWidth} />
                  <NumberControl label="Button Width (%)" value={buttonWidth} min={8} max={100} onChange={setButtonWidth} />
                </div>
              </div>

              <section className="rounded-2xl border-2 border-emerald-300 bg-emerald-50/60 p-4">
                <label className="flex items-center justify-between gap-3">
                  <div>
                    <div className="text-sm font-black text-[#172033]">
                      Enable Button
                    </div>
                    <p className="mt-1 text-[11px] font-bold leading-5 text-[#667085]">
                      You can add a button even in background-image mode and drag it to the desired position in the preview.
                    </p>
                  </div>
                  <input
                    type="checkbox"
                    checked={buttonEnabled}
                    onChange={(event) => setButtonEnabled(event.target.checked)}
                    className="h-5 w-5 shrink-0 accent-emerald-600"
                  />
                </label>

                {buttonEnabled && (
                  <div className="mt-4 grid gap-4">
                    <div className="grid gap-3 sm:grid-cols-2">
                      <label>
                        <span className="mb-1 block text-xs font-black text-[#667085]">
                          Button Text
                        </span>
                        <input
                          value={buttonText}
                          onChange={(event) => setButtonText(event.target.value)}
                          placeholder="e.g. Learn More"
                          className="w-full rounded-xl border border-[#D9CFC2] bg-white px-4 py-3 text-sm font-bold outline-none focus:border-emerald-600"
                        />
                      </label>

                      <label>
                        <span className="mb-1 block text-xs font-black text-[#667085]">
                          Button Link URL
                        </span>
                        <input
                          value={linkUrl}
                          onChange={(event) => setLinkUrl(event.target.value)}
                          placeholder="/events or https://..."
                          className="w-full rounded-xl border border-[#D9CFC2] bg-white px-4 py-3 text-sm font-bold outline-none focus:border-emerald-600"
                        />
                      </label>
                    </div>

                    <div>
                      <span className="mb-2 block text-xs font-black text-[#667085]">
                        Button Shape
                      </span>
                      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                        {[
                          { name: "Square", radius: 0 },
                          { name: "Slightly Rounded", radius: 8 },
                          { name: "Rounded", radius: 18 },
                          { name: "Pill", radius: 999 },
                        ].map((shape) => (
                          <button
                            key={shape.name}
                            type="button"
                            onClick={() => setButtonRadius(shape.radius)}
                            className={`border px-3 py-2 text-xs font-black transition ${
                              buttonRadius === shape.radius
                                ? "border-emerald-600 bg-emerald-600 text-white"
                                : "border-[#D9CFC2] bg-white text-[#172033] hover:border-emerald-500"
                            }`}
                            style={{ borderRadius: `${Math.min(shape.radius, 24)}px` }}
                          >
                            {shape.name}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div className="grid gap-3 sm:grid-cols-2">
                      <NumberControl
                        label="Button Width (%)"
                        value={buttonWidth}
                        min={8}
                        max={100}
                        onChange={setButtonWidth}
                      />
                      <NumberControl
                        label="Button Height (%)"
                        value={buttonHeight}
                        min={4}
                        max={35}
                        onChange={setButtonHeight}
                      />

                      <label>
                        <span className="mb-1 block text-xs font-black text-[#667085]">
                          Button Text 크기
                        </span>
                        <input
                          type="number"
                          min={10}
                          max={48}
                          value={buttonFontSize}
                          onChange={(event) => setButtonFontSize(Number(event.target.value))}
                          className="w-full rounded-xl border border-[#D9CFC2] bg-white px-3 py-3 text-sm font-black"
                        />
                      </label>

                      <NumberControl
                        label="Button Corner Radius (px)"
                        value={buttonRadius}
                        min={0}
                        max={999}
                        onChange={setButtonRadius}
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <label>
                        <span className="mb-1 block text-xs font-black text-[#667085]">
                          버튼 Background
                        </span>
                        <input
                          type="color"
                          value={buttonColor}
                          onChange={(event) => setButtonColor(event.target.value)}
                          className="h-12 w-full cursor-pointer rounded-xl border border-[#D9CFC2] bg-white p-1"
                        />
                      </label>

                      <label>
                        <span className="mb-1 block text-xs font-black text-[#667085]">
                          Button Text색
                        </span>
                        <input
                          type="color"
                          value={buttonTextColor}
                          onChange={(event) => setButtonTextColor(event.target.value)}
                          className="h-12 w-full cursor-pointer rounded-xl border border-[#D9CFC2] bg-white p-1"
                        />
                      </label>
                    </div>

                    <div className="rounded-xl border border-emerald-200 bg-white px-3 py-2 text-[11px] font-bold leading-5 text-emerald-800">
                      Right 미리보기의 초록 점선 버튼을 마우스로 잡고 원하는 위치로 자유롭게 이동하세요.
                    </div>
                  </div>
                )}
              </section>
              </div>

              <section className="rounded-2xl border border-[#D9CFC2] bg-[#FCFAF7] p-4">
                <label className="flex items-center justify-between gap-3">
                  <div>
                    <div className="text-sm font-black text-[#172033]">이메Days 수집 + 쿠폰 발급</div>
                    <p className="mt-1 text-xs font-medium text-[#667085]">이메Days을 저장하고 고유 쿠폰 코드를 발급하며, 선택적으로 리워드 가입 페이지로 연결합니다.</p>
                  </div>
                  <input type="checkbox" checked={leadCaptureEnabled} onChange={(event) => setLeadCaptureEnabled(event.target.checked)} className="h-5 w-5 accent-green-600" />
                </label>

                {leadCaptureEnabled && (
                  <div className="mt-4 grid gap-3">
                    <div className="grid gap-3 sm:grid-cols-2">
                      <FieldInput label="이메Days placeholder" value={emailPlaceholder} onChange={setEmailPlaceholder} />
                      <FieldInput label="제출 버튼 텍스트" value={submitButtonText} onChange={setSubmitButtonText} />
                      <FieldInput label="성공 메시지" value={successMessage} onChange={setSuccessMessage} />
                      <FieldInput label="쿠폰 코드 접두어" value={couponCodePrefix} onChange={setCouponCodePrefix} placeholder="WELCOME" />
                      <FieldInput label="리워드 가입 주소 (선택)" value={rewardSignupUrl} onChange={setRewardSignupUrl} placeholder="https://..." />
                      <label>
                        <span className="mb-1 block text-xs font-black text-[#667085]">폼 Background</span>
                        <input type="color" value={formBackgroundColor} onChange={(event) => setFormBackgroundColor(event.target.value)} className="h-11 w-full rounded-xl border border-[#D9CFC2] bg-white p-1" />
                      </label>
                    </div>
                    <label>
                      <span className="mb-1 block text-xs font-black text-[#667085]">약관 / 안내 문구</span>
                      <textarea value={termsText} onChange={(event) => setTermsText(event.target.value)} rows={5} className="w-full rounded-xl border border-[#D9CFC2] px-4 py-3 text-sm font-medium outline-none" />
                    </label>
                    <label className="flex items-center gap-2 rounded-xl bg-white px-4 py-3 text-sm font-black">
                      <input type="checkbox" checked={leadExpandedMode} onChange={(event) => setLeadExpandedMode(event.target.checked)} className="h-4 w-4 accent-green-600" />
                      처음에는 이메Days 입력만 표시하고, 클릭하면 약관과 제출 버튼 펼치기
                    </label>
                  </div>
                )}
              </section>

              <div className="rounded-2xl border border-[#D9CFC2] bg-white px-4 py-3">
                <label className="flex items-center justify-between gap-3">
                  <div>
                    <div className="text-sm font-black text-[#172033]">Hide Popup Checkbox</div>
                    <p className="mt-1 text-[11px] font-bold text-[#667085]">
                      When checked, this popup will not be shown on that device for the period specified below.
                    </p>
                  </div>
                  <input
                    type="checkbox"
                    checked={hide24HoursEnabled}
                    onChange={(event) => setHide24HoursEnabled(event.target.checked)}
                    className="h-5 w-5 accent-green-600"
                  />
                </label>

                {hide24HoursEnabled && (
                  <label className="mt-3 block">
                    <span className="mb-1 block text-xs font-black text-[#667085]">
                      Do Not Show Again For (1–31 Days)
                    </span>
                    <div className="flex items-center gap-2">
                      <input
                        type="number"
                        min={1}
                        max={31}
                        value={hideDays}
                        onChange={(event) => {
                          const raw = event.target.value;

                          // 입력 중에는 빈칸을 허용해야 기존 "1"을 지우고
                          // "10", "15", "31" 같은 값을 정상적으로 입력할 수 있습니다.
                          if (raw === "") {
                            setHideDays("");
                            return;
                          }

                          if (!/^\\d{1,2}$/.test(raw)) {
                            return;
                          }

                          const value = Number(raw);

                          if (value >= 1 && value <= 31) {
                            setHideDays(raw);
                          }
                        }}
                        onBlur={() => {
                          const value = Number(hideDays);
                          setHideDays(
                            String(
                              Number.isFinite(value)
                                ? Math.max(1, Math.min(31, value))
                                : 1,
                            ),
                          );
                        }}
                        className="w-24 rounded-xl border border-[#D9CFC2] bg-white px-3 py-2 text-sm font-black"
                      />
                      <span className="text-sm font-black text-[#172033]">Days</span>
                    </div>
                  </label>
                )}
              </div>

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
                  <option value="left">Left</option>
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
                    <option value="cover">영역 꽉 채우기 · Days부 잘림</option>
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
                      <option value="medium">Medium</option>
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
                  아래 슬라이더로 크기를 조절하고, Right 미리보기에서는
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
                  <NumberControl label="글자 Left 위치 (%)" value={textX} min={0} max={Math.max(0, 100 - textWidth)} onChange={setTextX} />
                  <NumberControl label="글자 위쪽 위치 (%)" value={textY} min={0} max={92} onChange={setTextY} />
                  <NumberControl label="이미지 가로 크기 (%)" value={imageWidth} min={10} max={100} onChange={setImageWidth} />
                  <NumberControl label="이미지 세로 크기 (%)" value={imageHeight} min={10} max={100} onChange={setImageHeight} />
                  <NumberControl label="이미지 Left 위치 (%)" value={imageX} min={0} max={Math.max(0, 100 - imageWidth)} onChange={setImageX} />
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
                    시작Days
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
                    종료Days (필수)
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
                  {textEnabled ? "파란 점선 = Title · Description 드래그 / 초록 점선 = 버튼 드래그" : "Title·Description 숨김 / 초록 점선 버튼은 계속 드래그 가능"}
                </span>
                <span className="rounded-full bg-amber-100 px-3 py-1.5 text-amber-700">
                  점선 이미지 박스 = 이미지 위치·크기
                </span>
              </div>
            </div>

            <p className="mt-2 text-xs font-medium leading-5 text-[#667085]">
              {textEnabled ? "Title · Description을 각각 마우스로 끌어 이동하세요. 버튼도 별도로 자유 드래그할 수 있습니다. " : "Title·Description은 숨김 상태입니다. 버튼은 별도로 자유 드래그할 수 있습니다. "}
              크기는 Left의 슬라이더에서 조절합니다.
            </p>

            <div
              className="relative mt-4 overflow-hidden border border-black/10"
              style={{
                maxWidth: `${popupWidth}px`,
                borderRadius: `${popupRadius}px`,
                boxShadow: getPopupShadow(popupShadow),
                height: `${popupHeight}px`,
                backgroundColor,
                touchAction: "none",
              }}
              onPointerMove={handlePreviewPointerMove}
              onPointerUp={() => setDragging(null)}
              onPointerLeave={() => setDragging(null)}
            >
              {imagePreview && imagePosition === "background" && (
                <div className="pointer-events-none absolute inset-0 z-0 overflow-hidden">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={imagePreview}
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
                    className="h-full w-full"
                    style={{
                      objectFit: imageFit,
                      transform: `scale(${imageZoom / 100})`,
                      transformOrigin: "center",
                    }}
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

              {textEnabled && title && (
                <div
                  onPointerDown={(event) => {
                    event.currentTarget.setPointerCapture(event.pointerId);
                    setDragging("title");
                  }}
                  className="absolute z-20 cursor-move rounded-lg border-2 border-dashed border-blue-400 bg-white/5 px-2 py-1"
                  style={{ left: `${titleX}%`, top: `${titleY}%`, width: `${titleWidth}%`, textAlign }}
                >
                  <div style={{ color: titleColor, fontSize: `${titleFontSize}px`, fontWeight: titleFontWeight, lineHeight: 1.15 }}>
                    {title}
                  </div>
                  <span className="absolute -top-5 left-0 rounded bg-blue-600 px-1.5 py-0.5 text-[9px] font-black text-white">Title 이동</span>
                </div>
              )}

              {textEnabled && subtitle && (
                <div
                  onPointerDown={(event) => {
                    event.currentTarget.setPointerCapture(event.pointerId);
                    setDragging("subtitle");
                  }}
                  className="absolute z-20 cursor-move rounded-lg border-2 border-dashed border-sky-400 bg-white/5 px-2 py-1"
                  style={{ left: `${subtitleX}%`, top: `${subtitleY}%`, width: `${subtitleWidth}%`, textAlign }}
                >
                  <p style={{ color: subtitleColor, fontSize: `${subtitleFontSize}px`, fontWeight: subtitleFontWeight, lineHeight: 1.45 }}>
                    {subtitle}
                  </p>
                  <span className="absolute -top-5 left-0 rounded bg-sky-600 px-1.5 py-0.5 text-[9px] font-black text-white">Description 이동</span>
                </div>
              )}

              {buttonEnabled && buttonText && (
                <div
                  onPointerDown={(event) => {
                    event.currentTarget.setPointerCapture(event.pointerId);
                    setDragging("button");
                  }}
                  className="absolute z-20 flex cursor-move items-center justify-center border-2 border-dashed border-emerald-400"
                  style={{
                    left: `${buttonX}%`,
                    top: `${buttonY}%`,
                    width: `${buttonWidth}%`,
                    height: `${buttonHeight}%`,
                    backgroundColor: buttonColor,
                    color: buttonTextColor,
                    fontSize: `${buttonFontSize}px`,
                    borderRadius: `${buttonRadius}px`,
                  }}
                  title={linkUrl ? `링크: ${linkUrl}` : "링크 없음"}
                >
                  <span className="pointer-events-none font-black">{buttonText}</span>
                  <span className="absolute -top-5 left-0 rounded bg-emerald-600 px-1.5 py-0.5 text-[9px] font-black text-white">버튼 이동</span>
                </div>
              )}

              {hide24HoursEnabled && (
                <label className="absolute bottom-3 left-1/2 z-30 flex -translate-x-1/2 items-center gap-2 rounded-full bg-white/90 px-3 py-2 text-[11px] font-black text-[#172033] shadow">
                  <input type="checkbox" className="h-4 w-4" onChange={() => undefined} />
                  {Math.max(1, Math.min(31, Number(hideDays) || 1))} Days — Do Not Show This Popup
                </label>
              )}
            </div>
          </section>
        </div>

        <section className="mt-5 rounded-3xl border border-[#E9DED0] bg-white p-5 shadow-sm">
          <h2 className="text-lg font-black text-[#172033]">
            KTownTriangle 등록 팝업
          </h2>

          <div className="mt-4 space-y-3">
            {sortedBanners.length === 0 ? (
              <div className="rounded-2xl bg-[#F8F5F0] p-5 text-center text-sm font-bold text-[#667085]">
                아직 KTownTriangle 등록 팝업이 없습니다.
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
                          alt={banner.title || "Popup image"}
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
                          {banner.title || "이미지 전용 팝업"}
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
                        순서 {banner.display_order} · {
                          banner.display_location === "community"
                            ? "Community"
                            : banner.display_location === "events"
                              ? "Events"
                              : banner.display_location === "home"
                                ? "Home"
                                : "All Locations"
                        }
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