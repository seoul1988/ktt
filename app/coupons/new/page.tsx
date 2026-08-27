"use client";

import {
  ChangeEvent,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { supabase } from "../../../lib/supabase";
import ProfileButton from "../../components/ProfileButton";
import BottomNav from "../../components/BottomNav";

type Business = {
  id: number;
  name: string | null;
  category: string | null;
  owner_id?: string | null;
  address?: string | null;
  image_url?: string | null;
  image_urls?: string[] | null;
};

type Coupon = {
  id: number;
  business_id: number;
  title: string;
  description: string | null;
  coupon_type: string;
  value: number;
  minimum_purchase?: number | null;
  start_date: string | null;
  end_date: string | null;
  usage_limit: number;
  repeatable?: boolean | null;
  usage_mode?: "one_time" | "multiple" | "yearly" | null;
  activation_mode?: string | null;
  stamp_valid_days?: number | null;
  stamp_code?: string | null;
  stamp_text?: string | null;
  used_count: number;
  active: boolean;
  pin_code?: string | null;
  info_text?: string | null;
  promo_code?: string | null;
  order_url?: string | null;
  order_button_text?: string | null;
  image_url?: string | null;
  created_at?: string | null;
};

type CouponDraft = {
  localId: string;
  editingId: number | null;
  title: string;
  description: string;
  couponType: string;
  value: number;
  minimumPurchase: number;
  usageLimit: number;
  repeatable: boolean;
  usageMode: "one_time" | "multiple" | "yearly";
  activationMode: "immediate" | "staff_stamp" | "online_order" | "reservation";
  stampValidDays: number;
  stampCode: string;
  stampText: string;
  startDate: string;
  endDate: string;
  pinRequired: boolean;
  pinCode: string;
  infoText: string;
  promoCode: string;
  orderUrl: string;
  orderButtonText: string;
  imageUrl: string;
  buyQty: number;
  buyItem: string;
  getQty: number;
  getItem: string;
};

const STORAGE_BUCKET = "business-images";

function makeId() {
  return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function makeDraft(seed?: Partial<CouponDraft>): CouponDraft {
  return {
    localId: makeId(),
    editingId: null,
    title: "",
    description: "",
    couponType: "percent",
    value: 10,
    minimumPurchase: 0,
    usageLimit: 100,
    repeatable: false,
    usageMode: "one_time",
    activationMode: "immediate",
    stampValidDays: 31,
    stampCode: "",
    stampText: "THANK YOU! See you again soon!",
    startDate: "",
    endDate: "",
    pinRequired: false,
    pinCode: "",
    infoText: "First visit? Ask a staff member to stamp this coupon.",
    promoCode: "",
    orderUrl: "",
    orderButtonText: "ORDER NOW",
    imageUrl: "",
    buyQty: 1,
    buyItem: "",
    getQty: 1,
    getItem: "",
    ...seed,
  };
}

function normalizeCategory(value: string | null | undefined) {
  return String(value || "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

function uniqueStrings(values: Array<string | null | undefined>) {
  return Array.from(
    new Set(
      values
        .map((value) => String(value || "").trim())
        .filter(Boolean),
    ),
  );
}

function toLocalInputDate(value: string | null | undefined) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const pad = (v: number) => String(v).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(
    date.getDate(),
  )}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

export default function NewCouponPage() {
  const [businesses, setBusinesses] = useState<Business[]>([]);
  const [allCoupons, setAllCoupons] = useState<Coupon[]>([]);
  const [businessCoupons, setBusinessCoupons] = useState<Coupon[]>([]);

  const [businessId, setBusinessId] = useState("");
  const [businessSearch, setBusinessSearch] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("ALL");
  const [showRegistered, setShowRegistered] = useState(true);
  const [showNotRegistered, setShowNotRegistered] = useState(true);
  const [loadingBusinesses, setLoadingBusinesses] = useState(true);
  const [currentUserId, setCurrentUserId] = useState("");
  const [accessRole, setAccessRole] = useState<"admin" | "owner" | "blocked" | "loading">("loading");

  const [drafts, setDrafts] = useState<CouponDraft[]>([makeDraft()]);
  const [savingAll, setSavingAll] = useState(false);
  const [uploadingDraftId, setUploadingDraftId] = useState<string | null>(null);
  const [addUploadedToBusinessGallery, setAddUploadedToBusinessGallery] =
    useState(true);

  const editorRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    void loadInitialData();
  }, []);

  async function loadInitialData() {
    setLoadingBusinesses(true);

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      window.location.href = "/login";
      return;
    }

    setCurrentUserId(user.id);

    // 관리자 여부 확인
    const { data: profileData, error: profileError } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .maybeSingle();

    if (profileError) {
      console.error("profile role check failed:", profileError);
    }

    const role = String(profileData?.role || "").trim().toLowerCase();
    const isAdmin = role === "admin";

    // 관리자는 모든 업체, 일반 오너는 본인 업체만 불러옵니다.
    let businessQuery = supabase
      .from("businesses")
      .select("id,name,category,address,image_url,image_urls,owner_id");

    if (!isAdmin) {
      businessQuery = businessQuery.eq("owner_id", user.id);
    }

    const { data: businessData, error: businessError } = await businessQuery
      .order("category", { ascending: true, nullsFirst: false })
      .order("name", { ascending: true, nullsFirst: false });

    if (businessError) {
      setLoadingBusinesses(false);
      setAccessRole("blocked");
      alert(businessError.message);
      return;
    }

    const allowedBusinesses = (businessData || []) as Business[];

    // admin 또는 실제로 소유한 업체가 있는 owner만 쿠폰 관리 가능
    if (!isAdmin && allowedBusinesses.length === 0) {
      setBusinesses([]);
      setAllCoupons([]);
      setAccessRole("blocked");
      setLoadingBusinesses(false);
      return;
    }

    setAccessRole(isAdmin ? "admin" : "owner");

    const allowedBusinessIds = allowedBusinesses.map((business) => business.id);

    let couponQuery = supabase
      .from("coupons")
      .select(
        "id,business_id,title,description,coupon_type,value,minimum_purchase,start_date,end_date,usage_limit,repeatable,usage_mode,activation_mode,stamp_valid_days,stamp_code,stamp_text,used_count,active,pin_code,info_text,promo_code,order_url,order_button_text,image_url,created_at",
      );

    // owner는 자기 업체 쿠폰만 조회
    if (!isAdmin) {
      couponQuery = couponQuery.in("business_id", allowedBusinessIds);
    }

    const { data: couponData, error: couponError } = await couponQuery.order(
      "created_at",
      { ascending: false },
    );

    if (couponError) {
      setLoadingBusinesses(false);
      alert(couponError.message);
      return;
    }

    setBusinesses(allowedBusinesses);
    setAllCoupons((couponData || []) as Coupon[]);
    setLoadingBusinesses(false);
  }

  function canManageBusiness(targetBusinessId: number | string) {
    const numericId = Number(targetBusinessId);

    if (accessRole === "admin") return true;

    return (
      accessRole === "owner" &&
      businesses.some(
        (business) =>
          business.id === numericId && business.owner_id === currentUserId,
      )
    );
  }

  function requireBusinessPermission(targetBusinessId: number | string) {
    if (canManageBusiness(targetBusinessId)) return true;

    alert("본인 업체의 쿠폰만 등록·수정·삭제할 수 있습니다.");
    return false;
  }

  async function loadBusinessCoupons(selectedBusinessId: string) {
    if (!selectedBusinessId) {
      setBusinessCoupons([]);
      return;
    }

    const { data, error } = await supabase
      .from("coupons")
      .select("*")
      .eq("business_id", Number(selectedBusinessId))
      .order("created_at", { ascending: false });

    if (error) {
      alert(error.message);
      return;
    }

    const rows = (data || []) as Coupon[];
    setBusinessCoupons(rows);

    setAllCoupons((prev) => {
      const other = prev.filter(
        (coupon) => coupon.business_id !== Number(selectedBusinessId),
      );
      return [...rows, ...other];
    });
  }

  const couponCountByBusiness = useMemo(() => {
    const map = new Map<number, number>();
    allCoupons.forEach((coupon) => {
      map.set(coupon.business_id, (map.get(coupon.business_id) || 0) + 1);
    });
    return map;
  }, [allCoupons]);

  const categories = useMemo(() => {
    const set = new Set<string>();
    businesses.forEach((business) => {
      normalizeCategory(business.category).forEach((category) =>
        set.add(category),
      );
    });
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [businesses]);

  const filteredBusinesses = useMemo(() => {
    const q = businessSearch.trim().toLowerCase();

    return businesses.filter((business) => {
      const count = couponCountByBusiness.get(business.id) || 0;
      const registered = count > 0;

      if (registered && !showRegistered) return false;
      if (!registered && !showNotRegistered) return false;

      const categoriesForBusiness = normalizeCategory(business.category);
      if (
        selectedCategory !== "ALL" &&
        !categoriesForBusiness.includes(selectedCategory)
      ) {
        return false;
      }

      if (q) {
        const haystack = [
          business.name,
          business.category,
          business.address,
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();

        if (!haystack.includes(q)) return false;
      }

      return true;
    });
  }, [
    businesses,
    businessSearch,
    couponCountByBusiness,
    selectedCategory,
    showNotRegistered,
    showRegistered,
  ]);

  const groupedBusinesses = useMemo(() => {
    const groups: Record<string, Business[]> = {};

    filteredBusinesses.forEach((business) => {
      const cats = normalizeCategory(business.category);
      const key =
        selectedCategory !== "ALL"
          ? selectedCategory
          : cats[0] || "No Category";

      if (!groups[key]) groups[key] = [];
      groups[key].push(business);
    });

    return Object.entries(groups).sort(([a], [b]) => a.localeCompare(b));
  }, [filteredBusinesses, selectedCategory]);

  const selectedBusiness = useMemo(
    () =>
      businesses.find((business) => String(business.id) === businessId) || null,
    [businessId, businesses],
  );

  const selectedBusinessImages = useMemo(() => {
    if (!selectedBusiness) return [];
    return uniqueStrings([
      selectedBusiness.image_url,
      ...(selectedBusiness.image_urls || []),
    ]);
  }, [selectedBusiness]);

  const priorCouponImages = useMemo(() => {
    if (!businessId) return [];
    return uniqueStrings(
      allCoupons
        .filter((coupon) => coupon.business_id === Number(businessId))
        .map((coupon) => coupon.image_url),
    );
  }, [allCoupons, businessId]);

  async function chooseBusiness(business: Business) {
    if (!requireBusinessPermission(business.id)) return;

    setBusinessId(String(business.id));

    const defaultImage = uniqueStrings([
      business.image_url,
      ...(business.image_urls || []),
    ])[0];

    setDrafts([
      makeDraft({
        imageUrl: defaultImage || "",
      }),
    ]);

    await loadBusinessCoupons(String(business.id));

    setTimeout(() => {
      editorRef.current?.scrollIntoView({
        behavior: "smooth",
        block: "start",
      });
    }, 50);
  }

  function updateDraft(
    localId: string,
    patch: Partial<Omit<CouponDraft, "localId">>,
  ) {
    setDrafts((prev) =>
      prev.map((draft) =>
        draft.localId === localId ? { ...draft, ...patch } : draft,
      ),
    );
  }

  function addAnotherCoupon(copyPrevious = true) {
    setDrafts((prev) => {
      const previous = prev[prev.length - 1];

      const next = copyPrevious && previous
        ? makeDraft({
            minimumPurchase: previous.minimumPurchase,
            usageLimit: previous.usageLimit,
            repeatable: previous.repeatable,
            usageMode: previous.usageMode,
            activationMode: previous.activationMode,
            stampValidDays: previous.stampValidDays,
            stampCode: previous.stampCode,
            stampText: previous.stampText,
            startDate: previous.startDate,
            endDate: previous.endDate,
            pinRequired: previous.pinRequired,
            pinCode: previous.pinCode,
            infoText: previous.infoText,
            promoCode: previous.promoCode,
            orderUrl: previous.orderUrl,
            orderButtonText: previous.orderButtonText,
            imageUrl: previous.imageUrl,
          })
        : makeDraft({
            imageUrl: selectedBusinessImages[0] || "",
          });

      return [...prev, next];
    });

    setTimeout(() => {
      const el = document.getElementById("coupon-draft-bottom");
      el?.scrollIntoView({ behavior: "smooth", block: "center" });
    }, 40);
  }

  function duplicateDraft(localId: string) {
    setDrafts((prev) => {
      const target = prev.find((draft) => draft.localId === localId);
      if (!target) return prev;

      return [
        ...prev,
        makeDraft({
          title: target.title,
          description: target.description,
          couponType: target.couponType,
          value: target.value,
          minimumPurchase: target.minimumPurchase,
          usageLimit: target.usageLimit,
          repeatable: target.repeatable,
          usageMode: target.usageMode,
          activationMode: target.activationMode,
          stampValidDays: target.stampValidDays,
          stampCode: target.stampCode,
          stampText: target.stampText,
          startDate: target.startDate,
          endDate: target.endDate,
          pinRequired: target.pinRequired,
          pinCode: target.pinCode,
          infoText: target.infoText,
          promoCode: target.promoCode,
          orderUrl: target.orderUrl,
          orderButtonText: target.orderButtonText,
          imageUrl: target.imageUrl,
          buyQty: target.buyQty,
          buyItem: target.buyItem,
          getQty: target.getQty,
          getItem: target.getItem,
        }),
      ];
    });
  }

  function removeDraft(localId: string) {
    setDrafts((prev) => {
      if (prev.length <= 1) {
        return [makeDraft({ imageUrl: selectedBusinessImages[0] || "" })];
      }
      return prev.filter((draft) => draft.localId !== localId);
    });
  }

  function clearAllDrafts() {
    setDrafts([
      makeDraft({
        imageUrl: selectedBusinessImages[0] || "",
      }),
    ]);
  }

  async function uploadCouponImage(
    draftLocalId: string,
    file: File,
  ) {
    if (!businessId || !selectedBusiness) {
      alert("먼저 업체를 선택하세요.");
      return;
    }

    if (!file.type.startsWith("image/")) {
      alert("이미지 파일만 업로드할 수 있습니다.");
      return;
    }

    setUploadingDraftId(draftLocalId);

    try {
      const ext = file.name.split(".").pop()?.toLowerCase() || "jpg";
      const safeExt = ext.replace(/[^a-z0-9]/g, "") || "jpg";
      const path = `coupon-book/${businessId}/${Date.now()}-${Math.random()
        .toString(36)
        .slice(2)}.${safeExt}`;

      const { error: uploadError } = await supabase.storage
        .from(STORAGE_BUCKET)
        .upload(path, file, {
          cacheControl: "31536000",
          upsert: false,
        });

      if (uploadError) throw uploadError;

      const { data } = supabase.storage
        .from(STORAGE_BUCKET)
        .getPublicUrl(path);

      const publicUrl = data.publicUrl;
      updateDraft(draftLocalId, { imageUrl: publicUrl });

      if (addUploadedToBusinessGallery) {
        const nextUrls = uniqueStrings([
          ...(selectedBusiness.image_urls || []),
          publicUrl,
        ]);

        const { error: businessUpdateError } = await supabase
          .from("businesses")
          .update({
            image_urls: nextUrls,
            image_url: selectedBusiness.image_url || nextUrls[0] || null,
          })
          .eq("id", selectedBusiness.id);

        if (businessUpdateError) throw businessUpdateError;

        setBusinesses((prev) =>
          prev.map((business) =>
            business.id === selectedBusiness.id
              ? {
                  ...business,
                  image_url: business.image_url || nextUrls[0] || null,
                  image_urls: nextUrls,
                }
              : business,
          ),
        );
      }
    } catch (error: any) {
      alert(error?.message || "이미지 업로드 중 오류가 발생했습니다.");
    } finally {
      setUploadingDraftId(null);
    }
  }

  function handleImageFileChange(
    draftLocalId: string,
    event: ChangeEvent<HTMLInputElement>,
  ) {
    const file = event.target.files?.[0];
    event.target.value = "";

    if (file) {
      void uploadCouponImage(draftLocalId, file);
    }
  }

  function validateDraft(draft: CouponDraft, index: number) {
    if (!draft.title.trim() && draft.couponType !== "buy_get_free") {
      return `Coupon #${index + 1}: 제목을 입력하세요.`;
    }

    if (draft.pinRequired && draft.pinCode.length !== 4) {
      return `Coupon #${index + 1}: PIN 사용을 선택했으면 4자리 PIN을 입력하세요.`;
    }

    if (draft.activationMode === "staff_stamp") {
      if (draft.stampCode.length !== 4) {
        return `Coupon #${index + 1}: 스탬프용 4자리 코드를 입력하세요.`;
      }

      if (!draft.stampText.trim()) {
        return `Coupon #${index + 1}: 스탬프에 표시할 문구를 입력하세요.`;
      }

      if (Number(draft.stampValidDays) < 1) {
        return `Coupon #${index + 1}: 스탬프 후 유효기간을 1일 이상 입력하세요.`;
      }
    }

    if (draft.activationMode === "online_order") {
      if (!draft.promoCode.trim()) {
        return `Coupon #${index + 1}: 온라인 주문용 Promo Code를 입력하세요.`;
      }

      if (!draft.orderUrl.trim()) {
        return `Coupon #${index + 1}: 온라인 주문 URL을 입력하세요.`;
      }
    }

    if (draft.activationMode === "reservation") {
      if (!draft.orderUrl.trim()) {
        return `Coupon #${index + 1}: 예약 페이지 URL을 입력하세요.`;
      }
    }

    if (draft.couponType === "spend_save") {
      if (!(Number(draft.value) > 0)) {
        return `Coupon #${index + 1}: 할인 금액을 입력하세요.`;
      }

      if (!(Number(draft.minimumPurchase) > 0)) {
        return `Coupon #${index + 1}: 최소 구매 금액을 입력하세요.`;
      }

      if (Number(draft.minimumPurchase) <= Number(draft.value)) {
        return `Coupon #${index + 1}: 최소 구매 금액은 할인 금액보다 커야 합니다.`;
      }
    }

    if (
      draft.couponType === "buy_get_free" &&
      (!draft.buyItem.trim() || !draft.getItem.trim())
    ) {
      return `Coupon #${index + 1}: BUY 상품과 FREE 상품을 입력하세요.`;
    }

    if (
      draft.endDate &&
      draft.startDate &&
      new Date(draft.endDate) < new Date(draft.startDate)
    ) {
      return `Coupon #${index + 1}: 종료일이 시작일보다 빠릅니다.`;
    }

    return "";
  }

  async function saveAllCoupons() {
    if (!businessId) {
      alert("업체를 선택하세요.");
      return;
    }

    if (!requireBusinessPermission(businessId)) return;

    if (drafts.length === 0) {
      alert("등록할 쿠폰이 없습니다.");
      return;
    }

    for (let index = 0; index < drafts.length; index += 1) {
      const message = validateDraft(drafts[index], index);
      if (message) {
        alert(message);
        return;
      }
    }

    setSavingAll(true);

    try {
      const newDrafts = drafts.filter((draft) => !draft.editingId);
      const editingDrafts = drafts.filter((draft) => draft.editingId);

      if (newDrafts.length > 0) {
        const payloads = newDrafts.map((draft) => ({
          business_id: Number(businessId),
          title:
            draft.couponType === "buy_get_free" && !draft.title.trim()
              ? `BUY ${draft.buyQty} ${draft.buyItem} GET ${draft.getQty} ${draft.getItem} FREE`
              : draft.title.trim(),
          description:
            draft.couponType === "buy_get_free"
              ? [
                  draft.description.trim(),
                  `BUY ${draft.buyQty} ${draft.buyItem} / GET ${draft.getQty} ${draft.getItem} FREE`,
                ]
                  .filter(Boolean)
                  .join(" · ") || null
              : draft.description.trim() || null,
          coupon_type: draft.couponType,
          value:
            draft.couponType === "percent" ||
            draft.couponType === "fixed" ||
            draft.couponType === "spend_save"
              ? Number(draft.value)
              : 0,
          minimum_purchase:
            draft.couponType === "spend_save"
              ? Number(draft.minimumPurchase)
              : null,
          usage_limit: Number(draft.usageLimit),
          repeatable: draft.usageMode === "multiple",
          usage_mode: draft.usageMode,
          activation_mode: draft.activationMode,
          stamp_valid_days:
            draft.activationMode === "staff_stamp"
              ? Math.max(1, Number(draft.stampValidDays) || 31)
              : null,
          stamp_code:
            draft.activationMode === "staff_stamp" ? draft.stampCode : null,
          stamp_text:
            draft.activationMode === "staff_stamp"
              ? draft.stampText.trim()
              : null,
          start_date: draft.startDate
            ? new Date(draft.startDate).toISOString()
            : null,
          end_date: draft.endDate
            ? new Date(draft.endDate).toISOString()
            : null,
          active: true,
          pin_code: draft.pinRequired ? draft.pinCode : null,
          info_text:
            draft.activationMode === "staff_stamp"
              ? draft.infoText.trim() || null
              : null,
          promo_code:
            (draft.activationMode === "online_order" || draft.activationMode === "reservation")
              ? draft.promoCode.trim().toUpperCase()
              : null,
          order_url:
            (draft.activationMode === "online_order" || draft.activationMode === "reservation")
              ? draft.orderUrl.trim()
              : null,
          order_button_text:
            (draft.activationMode === "online_order" || draft.activationMode === "reservation")
              ? draft.orderButtonText.trim() || (draft.activationMode === "reservation" ? "RESERVE NOW" : "ORDER NOW")
              : null,
          image_url: draft.imageUrl || null,
        }));

        const { error } = await supabase.from("coupons").insert(payloads);
        if (error) throw error;
      }

      for (const draft of editingDrafts) {
        const { error } = await supabase
          .from("coupons")
          .update({
            title:
              draft.couponType === "buy_get_free" && !draft.title.trim()
                ? `BUY ${draft.buyQty} ${draft.buyItem} GET ${draft.getQty} ${draft.getItem} FREE`
                : draft.title.trim(),
            description:
              draft.couponType === "buy_get_free"
                ? [
                    draft.description.trim(),
                    `BUY ${draft.buyQty} ${draft.buyItem} / GET ${draft.getQty} ${draft.getItem} FREE`,
                  ]
                    .filter(Boolean)
                    .join(" · ") || null
                : draft.description.trim() || null,
            coupon_type: draft.couponType,
            value:
              draft.couponType === "percent" ||
              draft.couponType === "fixed" ||
              draft.couponType === "spend_save"
                ? Number(draft.value)
                : 0,
            minimum_purchase:
              draft.couponType === "spend_save"
                ? Number(draft.minimumPurchase)
                : null,
            usage_limit: Number(draft.usageLimit),
            repeatable: draft.usageMode === "multiple",
            usage_mode: draft.usageMode,
            activation_mode: draft.activationMode,
            stamp_valid_days:
              draft.activationMode === "staff_stamp"
                ? Math.max(1, Number(draft.stampValidDays) || 31)
                : null,
            stamp_code:
              draft.activationMode === "staff_stamp" ? draft.stampCode : null,
            stamp_text:
              draft.activationMode === "staff_stamp"
                ? draft.stampText.trim()
                : null,
            start_date: draft.startDate
              ? new Date(draft.startDate).toISOString()
              : null,
            end_date: draft.endDate
              ? new Date(draft.endDate).toISOString()
              : null,
            pin_code: draft.pinRequired ? draft.pinCode : null,
            info_text:
              draft.activationMode === "staff_stamp"
                ? draft.infoText.trim() || null
                : null,
            promo_code:
              (draft.activationMode === "online_order" || draft.activationMode === "reservation")
                ? draft.promoCode.trim().toUpperCase()
                : null,
            order_url:
              (draft.activationMode === "online_order" || draft.activationMode === "reservation")
                ? draft.orderUrl.trim()
                : null,
            order_button_text:
              (draft.activationMode === "online_order" || draft.activationMode === "reservation")
                ? draft.orderButtonText.trim() || (draft.activationMode === "reservation" ? "RESERVE NOW" : "ORDER NOW")
                : null,
            image_url: draft.imageUrl || null,
          })
          .eq("id", draft.editingId);

        if (error) throw error;
      }

      alert(
        editingDrafts.length
          ? `저장 완료: 신규 ${newDrafts.length}개 / 수정 ${editingDrafts.length}개`
          : `${newDrafts.length}개의 쿠폰이 한 번에 등록되었습니다.`,
      );

      clearAllDrafts();
      await loadBusinessCoupons(businessId);
    } catch (error: any) {
      alert(error?.message || "쿠폰 저장 중 오류가 발생했습니다.");
    } finally {
      setSavingAll(false);
    }
  }

  function inferCouponType(coupon: Coupon) {
    const title = String(coupon.title || "").toUpperCase();
    const description = String(coupon.description || "").toUpperCase();
    const combined = `${title} ${description}`;

    // 기존 데이터가 Percent로 잘못 저장되어 있어도
    // FREE / BUY X GET Y 형태면 편집 화면에서는 올바른 종류로 복구합니다.
    if (
      /\bBUY\s+\d+\b/.test(combined) &&
      /\bGET\s+\d+\b/.test(combined) &&
      combined.includes("FREE")
    ) {
      return "buy_get_free";
    }

    if (
      combined.includes("FREE") &&
      !combined.includes("% OFF") &&
      !combined.includes("$")
    ) {
      return "free";
    }

    if (
      coupon.coupon_type === "percent" ||
      coupon.coupon_type === "fixed" ||
      coupon.coupon_type === "free" ||
      coupon.coupon_type === "buy_get_free" ||
      coupon.coupon_type === "spend_save" ||
      coupon.coupon_type === "custom"
    ) {
      return coupon.coupon_type;
    }

    return "custom";
  }

  function parseBuyGetFields(coupon: Coupon) {
    const combined = `${coupon.title || ""} ${coupon.description || ""}`.toUpperCase();

    const match = combined.match(
      /BUY\s+(\d+)\s+(.+?)\s+(?:\/|·|→|\-|,)?\s*GET\s+(\d+)\s+(.+?)\s+FREE\b/,
    );

    if (!match) {
      return {
        buyQty: 1,
        buyItem: "",
        getQty: 1,
        getItem: "",
      };
    }

    return {
      buyQty: Math.max(1, Number(match[1]) || 1),
      buyItem: String(match[2] || "").trim(),
      getQty: Math.max(1, Number(match[3]) || 1),
      getItem: String(match[4] || "").trim(),
    };
  }

  function editExistingCoupon(coupon: Coupon) {
    const inferredType = inferCouponType(coupon);
    const buyGet = parseBuyGetFields(coupon);

    const draft = makeDraft({
      editingId: coupon.id,
      title: coupon.title,
      description: coupon.description || "",
      couponType: inferredType,

      // Percent / Amount 쿠폰만 숫자 값을 사용합니다.
      // FREE / BUY X GET Y / Custom은 기존에 99 같은 잘못된 값이 있어도 0으로 정리합니다.
      value:
        inferredType === "percent" ||
        inferredType === "fixed" ||
        inferredType === "spend_save"
          ? Number(coupon.value || 0)
          : 0,

      minimumPurchase: Number(coupon.minimum_purchase || 0),
      usageLimit: Number(coupon.usage_limit || 0),
      repeatable: coupon.usage_mode
        ? coupon.usage_mode === "multiple"
        : Boolean(coupon.repeatable),
      usageMode:
        coupon.usage_mode === "yearly"
          ? "yearly"
          : coupon.usage_mode === "multiple" || coupon.repeatable
            ? "multiple"
            : "one_time",
      activationMode:
        coupon.activation_mode === "staff_stamp"
          ? "staff_stamp"
          : coupon.activation_mode === "online_order"
            ? "online_order"
            : coupon.activation_mode === "reservation"
              ? "reservation"
              : "immediate",
      stampValidDays: Number(coupon.stamp_valid_days || 31),
      stampCode: coupon.stamp_code || "",
      stampText: coupon.stamp_text || "THANK YOU! See you again soon!",
      startDate: toLocalInputDate(coupon.start_date),
      endDate: toLocalInputDate(coupon.end_date),
      pinRequired:
        coupon.activation_mode === "staff_stamp"
          ? false
          : Boolean(String(coupon.pin_code || "").trim()),
      pinCode:
        coupon.activation_mode === "staff_stamp"
          ? ""
          : coupon.pin_code || "",
      infoText:
        coupon.info_text ||
        "First visit? Ask a staff member to stamp this coupon.",
      promoCode: coupon.promo_code || "",
      orderUrl: coupon.order_url || "",
      orderButtonText: coupon.order_button_text || "ORDER NOW",
      imageUrl: coupon.image_url || "",
      buyQty: buyGet.buyQty,
      buyItem: buyGet.buyItem,
      getQty: buyGet.getQty,
      getItem: buyGet.getItem,
    });

    setDrafts([draft]);

    setTimeout(() => {
      editorRef.current?.scrollIntoView({
        behavior: "smooth",
        block: "start",
      });
    }, 30);
  }

  async function deleteCoupon(id: number) {
    if (!requireBusinessPermission(businessId)) return;
    if (!confirm("이 쿠폰을 삭제할까요?")) return;

    const { error } = await supabase.from("coupons").delete().eq("id", id);
    if (error) {
      alert(error.message);
      return;
    }

    await loadBusinessCoupons(businessId);
  }

  async function toggleActive(coupon: Coupon) {
    if (!requireBusinessPermission(coupon.business_id)) return;

    const { error } = await supabase
      .from("coupons")
      .update({ active: !coupon.active })
      .eq("id", coupon.id);

    if (error) {
      alert(error.message);
      return;
    }

    await loadBusinessCoupons(businessId);
  }

  function isExpired(coupon: Coupon) {
    const dateExpired =
      coupon.end_date && new Date(coupon.end_date) < new Date();
    const quantityExpired =
      coupon.usage_limit > 0 && coupon.used_count >= coupon.usage_limit;

    return Boolean(dateExpired || quantityExpired || !coupon.active);
  }

  function couponValueText(draft: CouponDraft) {
    if (draft.couponType === "percent") {
      return `${draft.value || 0}% OFF`;
    }

    if (draft.couponType === "fixed") {
      return `$${draft.value || 0} OFF`;
    }

    if (draft.couponType === "spend_save") {
      return `GET $${draft.value || 0} OFF`;
    }

    if (draft.couponType === "free") {
      return draft.title.trim() || "FREE ITEM";
    }

    if (draft.couponType === "buy_get_free") {
      const buyItem = draft.buyItem.trim() || "ITEM";
      const getItem = draft.getItem.trim() || "ITEM";
      return `BUY ${draft.buyQty || 1} ${buyItem} · GET ${draft.getQty || 1} ${getItem} FREE`;
    }

    if (draft.couponType === "custom") {
      return draft.title.trim() || "SPECIAL OFFER";
    }

    return draft.title.trim() || "COUPON";
  }

  if (accessRole === "blocked") {
    return (
      <main className="min-h-screen bg-[#F8F3EC] px-4 pb-28 pt-5 text-[#172033]">
        <div className="mx-auto max-w-2xl">
          <div className="mb-5 flex items-center justify-between">
            <button
              type="button"
              onClick={() => {
                window.location.href = "/coupons";
              }}
              className="rounded-full bg-white px-4 py-2 text-sm font-black shadow-sm"
            >
              ← Back
            </button>
            <ProfileButton />
          </div>

          <div className="rounded-[28px] border border-[#E8DED2] bg-white p-8 text-center shadow-sm">
            <div className="text-5xl">🔒</div>
            <h1 className="mt-4 text-2xl font-black">Coupon Registration</h1>
            <p className="mt-3 text-sm font-bold leading-6 text-gray-500">
              Coupon registration is available only to verified business owners
              and administrators.
            </p>
            <p className="mt-2 text-xs font-semibold text-gray-400">
              일반 사용자는 쿠폰을 등록할 수 없습니다.
            </p>
            <button
              type="button"
              onClick={() => {
                window.location.href = "/coupons";
              }}
              className="mt-6 rounded-2xl bg-[#EB4A45] px-5 py-3 text-sm font-black text-white"
            >
              OPEN COUPON BOOK
            </button>
          </div>
        </div>
        <BottomNav />
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#F8F3EC] px-4 pb-28 pt-5 text-[#172033]">
      <div className="mx-auto max-w-7xl">
        <div className="mb-5 flex items-start justify-between gap-3">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.2em] text-red-600">
              KTown Triangle
            </p>
            <h1 className="text-3xl font-black">Coupon Book Manager</h1>
            <p className="mt-1 text-sm font-semibold text-gray-500">
              업체를 한 번 선택한 뒤 여러 쿠폰을 한꺼번에 등록할 수 있습니다.
            </p>
          </div>

          <ProfileButton />
        </div>

        <section className="mb-6 rounded-[28px] border border-[#E8DED2] bg-white p-4 shadow-sm">
          <div className="mb-4">
            <h2 className="text-xl font-black">1. 업체 선택</h2>
            <p className="text-sm font-semibold text-gray-500">
              총 {businesses.length}개 업체 · 현재 {filteredBusinesses.length}개 표시
            </p>
          </div>

          <div className="grid gap-3 md:grid-cols-[1fr_240px]">
            <input
              value={businessSearch}
              onChange={(event) => setBusinessSearch(event.target.value)}
              placeholder="🔎 업체명, 카테고리, 주소 검색"
              className="w-full rounded-2xl border border-[#DDD3C7] bg-[#FCFAF7] px-4 py-3 font-bold outline-none focus:border-red-400"
            />

            <select
              value={selectedCategory}
              onChange={(event) => setSelectedCategory(event.target.value)}
              className="w-full rounded-2xl border border-[#DDD3C7] bg-[#FCFAF7] px-4 py-3 font-black outline-none"
            >
              <option value="ALL">전체 카테고리</option>
              {categories.map((category) => (
                <option key={category} value={category}>
                  {category}
                </option>
              ))}
            </select>
          </div>

          <div className="mt-3 flex flex-wrap gap-3">
            <label className="flex items-center gap-2 rounded-xl border bg-green-50 px-3 py-2 text-sm font-black text-green-800">
              <input
                type="checkbox"
                checked={showRegistered}
                onChange={(event) => setShowRegistered(event.target.checked)}
                className="h-4 w-4 accent-green-600"
              />
              ☑ 쿠폰 등록된 업체
            </label>

            <label className="flex items-center gap-2 rounded-xl border bg-amber-50 px-3 py-2 text-sm font-black text-amber-800">
              <input
                type="checkbox"
                checked={showNotRegistered}
                onChange={(event) => setShowNotRegistered(event.target.checked)}
                className="h-4 w-4 accent-amber-600"
              />
              ☐ 쿠폰 미등록 업체
            </label>

            <button
              type="button"
              onClick={() => {
                window.location.href = "/coupons";
              }}
              className="inline-flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 px-4 py-2 text-sm font-black text-red-600 transition hover:bg-red-100 active:scale-[0.98]"
            >
              🎟️ Coupon Book
            </button>
          </div>

          <div className="mt-4 max-h-[500px] overflow-y-auto rounded-2xl border bg-[#FCFAF7] p-3">
            {loadingBusinesses ? (
              <div className="py-10 text-center font-bold text-gray-400">
                업체를 불러오는 중...
              </div>
            ) : groupedBusinesses.length === 0 ? (
              <div className="py-10 text-center font-bold text-gray-400">
                검색 조건에 맞는 업체가 없습니다.
              </div>
            ) : (
              <div className="space-y-5">
                {groupedBusinesses.map(([category, rows]) => (
                  <div key={category}>
                    <div className="sticky top-0 z-10 mb-2 flex items-center justify-between rounded-xl bg-[#EDE4D9] px-3 py-2">
                      <h3 className="font-black">{category}</h3>
                      <span className="text-xs font-black text-gray-500">
                        {rows.length}
                      </span>
                    </div>

                    <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-3">
                      {rows.map((business) => {
                        const count =
                          couponCountByBusiness.get(business.id) || 0;
                        const registered = count > 0;
                        const selected =
                          String(business.id) === String(businessId);
                        const image =
                          business.image_url ||
                          business.image_urls?.[0] ||
                          "";

                        return (
                          <button
                            type="button"
                            key={business.id}
                            onClick={() => void chooseBusiness(business)}
                            className={`flex items-center gap-3 rounded-2xl border p-3 text-left transition ${
                              selected
                                ? "border-red-500 bg-red-50 ring-2 ring-red-100"
                                : "border-[#E7DED4] bg-white hover:border-red-300"
                            }`}
                          >
                            <div className="h-14 w-14 shrink-0 overflow-hidden rounded-xl bg-gray-100">
                              {image ? (
                                <img
                                  src={image}
                                  alt=""
                                  className="h-full w-full object-cover"
                                />
                              ) : (
                                <div className="flex h-full items-center justify-center text-xl">
                                  🏪
                                </div>
                              )}
                            </div>

                            <div className="min-w-0 flex-1">
                              <p className="truncate font-black">
                                {business.name || "No name"}
                              </p>
                              <p className="truncate text-xs font-semibold text-gray-500">
                                {business.category || "No Category"}
                              </p>

                              <div className="mt-2">
                                {registered ? (
                                  <span className="rounded-full bg-green-100 px-2 py-1 text-[11px] font-black text-green-700">
                                    ☑ 등록됨 · 쿠폰 {count}개
                                  </span>
                                ) : (
                                  <span className="rounded-full bg-amber-100 px-2 py-1 text-[11px] font-black text-amber-700">
                                    ☐ 등록할 업체
                                  </span>
                                )}
                              </div>
                            </div>

                            <div
                              className={`flex h-6 w-6 items-center justify-center rounded-md border-2 text-xs font-black ${
                                selected
                                  ? "border-red-500 bg-red-500 text-white"
                                  : registered
                                    ? "border-green-500 bg-green-500 text-white"
                                    : "border-gray-300 bg-white text-transparent"
                              }`}
                            >
                              ✓
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </section>

        {selectedBusiness && (
          <div ref={editorRef} className="scroll-mt-4">
            <section className="mb-6 rounded-[28px] border border-[#E8DED2] bg-white p-5 shadow-sm">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <p className="text-xs font-black uppercase tracking-wide text-red-600">
                    Selected Business
                  </p>
                  <h2 className="text-3xl font-black">
                    {selectedBusiness.name}
                  </h2>
                  <p className="font-bold text-gray-500">
                    {selectedBusiness.category || "No Category"}
                  </p>
                </div>

                <div className="rounded-2xl bg-[#F8F3EC] px-4 py-3 text-right">
                  <p className="text-xs font-black text-gray-500">
                    EXISTING COUPONS
                  </p>
                  <p className="text-2xl font-black">
                    {businessCoupons.length}
                  </p>
                </div>
              </div>
            </section>

            <section className="mb-6">
              <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
                <div>
                  <h2 className="text-2xl font-black">
                    2. 여러 쿠폰 한꺼번에 등록
                  </h2>
                  <p className="text-sm font-semibold text-gray-500">
                    Free Donut → 10% OFF → 30% OFF처럼 계속 추가한 뒤 마지막에
                    한 번만 저장하세요.
                  </p>
                </div>

                <div className="rounded-2xl bg-red-50 px-4 py-2 font-black text-red-700">
                  작성 중 {drafts.length}개
                </div>
              </div>

              <div className="space-y-5">
                {drafts.map((draft, index) => (
                  <article
                    key={draft.localId}
                    className="overflow-hidden rounded-[28px] border border-[#E6DCD1] bg-white shadow-sm"
                  >
                    <div className="flex items-center justify-between bg-[#FFF7F5] px-5 py-4">
                      <div>
                        <p className="text-xs font-black text-red-600">
                          {draft.editingId ? "EDITING EXISTING" : "NEW COUPON"}
                        </p>
                        <h3 className="text-xl font-black">
                          Coupon #{index + 1}
                          {draft.editingId ? ` · ID ${draft.editingId}` : ""}
                        </h3>
                      </div>

                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={() => duplicateDraft(draft.localId)}
                          className="rounded-xl bg-white px-3 py-2 text-xs font-black shadow-sm"
                        >
                          복사
                        </button>

                        <button
                          type="button"
                          onClick={() => removeDraft(draft.localId)}
                          className="rounded-xl bg-red-100 px-3 py-2 text-xs font-black text-red-700"
                        >
                          삭제
                        </button>
                      </div>
                    </div>

                    <div className="grid gap-5 p-5 lg:grid-cols-[1fr_300px]">
                      <div>
                        <label className="mb-1 block text-sm font-black">
                          쿠폰 제목
                        </label>
                        <input
                          value={draft.title}
                          onChange={(event) =>
                            updateDraft(draft.localId, {
                              title: event.target.value,
                            })
                          }
                          placeholder="예: FREE DONUT / 10% OFF / BUY 1 GET 1"
                          className="mb-3 w-full rounded-2xl border p-3 font-bold"
                        />

                        <label className="mb-1 block text-sm font-black">
                          설명 / 사용 조건
                        </label>
                        <textarea
                          value={draft.description}
                          onChange={(event) =>
                            updateDraft(draft.localId, {
                              description: event.target.value,
                            })
                          }
                          placeholder="예: Dine-in only / No purchase necessary"
                          className="mb-3 min-h-24 w-full rounded-2xl border p-3 font-semibold"
                        />

                        <div className="grid gap-3 sm:grid-cols-2">
                          <div>
                            <label className="mb-1 block text-sm font-black">
                              쿠폰 종류
                            </label>
                            <select
                              value={draft.couponType}
                              onChange={(event) => {
                                const nextType = event.target.value;

                                updateDraft(draft.localId, {
                                  couponType: nextType,
                                  value:
                                    nextType === "percent" ||
                                    nextType === "fixed" ||
                                    nextType === "spend_save"
                                      ? draft.value || 0
                                      : 0,
                                  minimumPurchase:
                                    nextType === "spend_save"
                                      ? draft.minimumPurchase || 0
                                      : 0,
                                });
                              }}
                              className="w-full rounded-2xl border p-3 font-bold"
                            >
                              <option value="percent">Percent (%)</option>
                              <option value="fixed">Amount ($)</option>
                              <option value="free">Free Item</option>
                              <option value="buy_get_free">Buy X Get Y Free</option>
                              <option value="spend_save">Spend $X, Get $Y Off</option>
                              <option value="custom">Custom Offer</option>
                            </select>
                          </div>

                          <div>
                            <label className="mb-1 block text-sm font-black">
                              {draft.couponType === "percent"
                                ? "할인 퍼센트"
                                : draft.couponType === "fixed"
                                  ? "할인 금액"
                                  : draft.couponType === "spend_save"
                                    ? "할인 금액 ($)"
                                    : "할인 값"}
                            </label>

                            {draft.couponType === "percent" ||
                            draft.couponType === "fixed" ||
                            draft.couponType === "spend_save" ? (
                              <input
                                type="number"
                                value={draft.value}
                                onChange={(event) =>
                                  updateDraft(draft.localId, {
                                    value: Number(event.target.value),
                                  })
                                }
                                className="w-full rounded-2xl border p-3 font-bold"
                              />
                            ) : (
                              <div className="flex h-[50px] items-center rounded-2xl border bg-gray-50 px-3 text-sm font-bold text-gray-400">
                                {draft.couponType === "free"
                                  ? "FREE 쿠폰 — 할인 숫자 없음"
                                  : draft.couponType === "buy_get_free"
                                    ? "BUY/GET 쿠폰 — 할인 숫자 없음"
                                    : "숫자 입력 필요 없음"}
                              </div>
                            )}
                          </div>
                        </div>

                        {draft.couponType === "buy_get_free" && (
                          <div className="mt-4 rounded-2xl border border-red-100 bg-red-50/50 p-4">
                            <p className="mb-3 text-sm font-black text-red-700">
                              Buy X Get Y Free 설정
                            </p>

                            <div className="grid gap-3 sm:grid-cols-2">
                              <div>
                                <label className="mb-1 block text-xs font-black text-gray-600">
                                  BUY 수량
                                </label>
                                <input
                                  type="number"
                                  min={1}
                                  value={draft.buyQty}
                                  onChange={(event) =>
                                    updateDraft(draft.localId, {
                                      buyQty: Math.max(1, Number(event.target.value) || 1),
                                    })
                                  }
                                  className="w-full rounded-2xl border p-3 font-bold"
                                />
                              </div>

                              <div>
                                <label className="mb-1 block text-xs font-black text-gray-600">
                                  BUY 상품
                                </label>
                                <input
                                  value={draft.buyItem}
                                  onChange={(event) =>
                                    updateDraft(draft.localId, {
                                      buyItem: event.target.value,
                                    })
                                  }
                                  placeholder="예: DRINK"
                                  className="w-full rounded-2xl border p-3 font-bold"
                                />
                              </div>

                              <div>
                                <label className="mb-1 block text-xs font-black text-gray-600">
                                  GET 수량
                                </label>
                                <input
                                  type="number"
                                  min={1}
                                  value={draft.getQty}
                                  onChange={(event) =>
                                    updateDraft(draft.localId, {
                                      getQty: Math.max(1, Number(event.target.value) || 1),
                                    })
                                  }
                                  className="w-full rounded-2xl border p-3 font-bold"
                                />
                              </div>

                              <div>
                                <label className="mb-1 block text-xs font-black text-gray-600">
                                  FREE 상품
                                </label>
                                <input
                                  value={draft.getItem}
                                  onChange={(event) =>
                                    updateDraft(draft.localId, {
                                      getItem: event.target.value,
                                    })
                                  }
                                  placeholder="예: DONUT"
                                  className="w-full rounded-2xl border p-3 font-bold"
                                />
                              </div>
                            </div>

                            <div className="mt-3 rounded-xl bg-white px-3 py-2 text-center text-sm font-black">
                              BUY {draft.buyQty || 1} {draft.buyItem || "ITEM"} → GET{" "}
                              {draft.getQty || 1} {draft.getItem || "ITEM"} FREE
                            </div>
                          </div>
                        )}

                        {draft.couponType === "spend_save" && (
                          <div className="mt-4 rounded-2xl border border-red-100 bg-red-50/50 p-4">
                            <p className="text-sm font-black text-red-700">
                              Spend & Save 설정
                            </p>
                            <p className="mt-1 text-xs font-semibold text-gray-500">
                              예: $60 이상 구매하면 $20 할인
                            </p>

                            <div className="mt-3 grid gap-3 sm:grid-cols-2">
                              <div>
                                <label className="mb-1 block text-xs font-black text-gray-600">
                                  최소 구매 금액 ($)
                                </label>
                                <input
                                  type="number"
                                  min={0}
                                  step="0.01"
                                  value={draft.minimumPurchase}
                                  onChange={(event) =>
                                    updateDraft(draft.localId, {
                                      minimumPurchase: Math.max(
                                        0,
                                        Number(event.target.value) || 0,
                                      ),
                                    })
                                  }
                                  placeholder="60"
                                  className="w-full rounded-2xl border p-3 font-bold"
                                />
                              </div>

                              <div>
                                <label className="mb-1 block text-xs font-black text-gray-600">
                                  할인 금액 ($)
                                </label>
                                <input
                                  type="number"
                                  min={0}
                                  step="0.01"
                                  value={draft.value}
                                  onChange={(event) =>
                                    updateDraft(draft.localId, {
                                      value: Math.max(
                                        0,
                                        Number(event.target.value) || 0,
                                      ),
                                    })
                                  }
                                  placeholder="20"
                                  className="w-full rounded-2xl border p-3 font-bold"
                                />
                              </div>
                            </div>

                            <div className="mt-3 rounded-xl bg-white px-3 py-3 text-center">
                              <p className="text-lg font-black text-red-600">
                                GET ${draft.value || 0} OFF
                              </p>
                              <p className="mt-1 text-xs font-black text-gray-600">
                                WHEN YOU SPEND ${draft.minimumPurchase || 0}+
                              </p>
                            </div>
                          </div>
                        )}

                        <div className="mt-4 rounded-2xl border border-[#E6DCD1] bg-[#FCFAF7] p-4">
                          <p className="text-sm font-black">고객별 사용 방식</p>
                          <p className="mt-1 text-xs font-semibold text-gray-500">
                            고객 한 명이 같은 쿠폰을 얼마나 자주 사용할 수 있는지 선택하세요.
                          </p>

                          <div className="mt-3 grid gap-2 sm:grid-cols-3">
                            {[
                              ["one_time", "✓ One time only", "고객당 전체 기간 1회"],
                              ["multiple", "↻ Multiple uses", "같은 고객 반복 사용 가능"],
                              ["yearly", "🎂 Once per year", "고객당 매년 1회 사용"],
                            ].map(([mode, title, desc]) => (
                              <button
                                key={mode}
                                type="button"
                                onClick={() =>
                                  updateDraft(draft.localId, {
                                    usageMode: mode as CouponDraft["usageMode"],
                                    repeatable: mode === "multiple",
                                  })
                                }
                                className={`rounded-2xl border px-4 py-3 text-left ${
                                  draft.usageMode === mode
                                    ? "border-red-500 bg-red-50 text-red-700"
                                    : "border-gray-200 bg-white text-gray-600"
                                }`}
                              >
                                <p className="text-sm font-black">{title}</p>
                                <p className="mt-1 text-[11px] font-semibold opacity-75">
                                  {desc}
                                </p>
                              </button>
                            ))}
                          </div>
                        </div>

                        <div className="mt-4 rounded-2xl border border-[#E6DCD1] bg-[#FCFAF7] p-4">
                          <p className="text-sm font-black">Coupon Activation</p>
                          <p className="mt-1 text-xs font-semibold text-gray-500">
                            일반 쿠폰은 바로 사용하고, 재방문 쿠폰은 첫 방문 때 직원이 코드를 입력해 스탬프를 찍습니다.
                          </p>

                          <div className="mt-3 grid gap-2 sm:grid-cols-2">
                            <button
                              type="button"
                              onClick={() =>
                                updateDraft(draft.localId, {
                                  activationMode: "immediate",
                                  stampCode: "",
                                })
                              }
                              className={`rounded-2xl border px-4 py-3 text-left ${
                                draft.activationMode === "immediate"
                                  ? "border-red-500 bg-red-50 text-red-700"
                                  : "border-gray-200 bg-white text-gray-600"
                              }`}
                            >
                              <p className="text-sm font-black">⚡ Use immediately</p>
                              <p className="mt-1 text-[11px] font-semibold opacity-75">
                                현재 방문에서 바로 사용
                              </p>
                            </button>

                            <button
                              type="button"
                              onClick={() =>
                                updateDraft(draft.localId, {
                                  activationMode: "staff_stamp",
                                  stampValidDays: draft.stampValidDays || 31,
                                  stampText:
                                    draft.stampText ||
                                    "THANK YOU! See you again soon!",
                                  pinRequired: false,
                                  pinCode: "",
                                })
                              }
                              className={`rounded-2xl border px-4 py-3 text-left ${
                                draft.activationMode === "staff_stamp"
                                  ? "border-red-500 bg-red-50 text-red-700"
                                  : "border-gray-200 bg-white text-gray-600"
                              }`}
                            >
                              <p className="text-sm font-black">🔖 Staff stamp required</p>
                              <p className="mt-1 text-[11px] font-semibold opacity-75">
                                첫 방문 코드 입력 → 스탬프 → 다음 방문 사용
                              </p>
                            </button>

                            <button
                              type="button"
                              onClick={() =>
                                updateDraft(draft.localId, {
                                  activationMode: "online_order",
                                  stampCode: "",
                                  pinRequired: false,
                                  pinCode: "",
                                  promoCode: draft.promoCode || "",
                                  orderButtonText:
                                    draft.orderButtonText || "ORDER NOW",
                                })
                              }
                              className={`rounded-2xl border px-4 py-3 text-left ${
                                draft.activationMode === "online_order"
                                  ? "border-red-500 bg-red-50 text-red-700"
                                  : "border-gray-200 bg-white text-gray-600"
                              }`}
                            >
                              <p className="text-sm font-black">🛒 Online order code</p>
                              <p className="mt-1 text-[11px] font-semibold opacity-75">
                                Promo Code 복사 → 주문 페이지 이동
                              </p>
                            </button>
                            <button
                              type="button"
                              onClick={() =>
                                updateDraft(draft.localId, {
                                  activationMode: "reservation",
                                  promoCode: draft.promoCode || "",
                                  orderButtonText:
                                    draft.orderButtonText === "ORDER NOW"
                                      ? "RESERVE NOW"
                                      : draft.orderButtonText || "RESERVE NOW",
                                })
                              }
                              className={`rounded-2xl border px-4 py-3 text-left ${
                                draft.activationMode === "reservation"
                                  ? "border-red-500 bg-red-50 text-red-700"
                                  : "border-gray-200 bg-white text-gray-600"
                              }`}
                            >
                              <p className="text-sm font-black">📅 Reservation only</p>
                              <p className="mt-1 text-[11px] font-semibold opacity-75">
                                예약 필수 · Promo Code 등록 가능
                              </p>
                            </button>
                          </div>

                          {draft.activationMode === "reservation" && (
                            <div className="mt-4 rounded-2xl border border-amber-100 bg-amber-50/60 p-4">
                              <p className="text-sm font-black text-amber-800">
                                Reservation Coupon
                              </p>
                              <p className="mt-1 text-xs font-semibold text-amber-700/70">
                                예약이 필요한 프로모션입니다. Promo Code가 있으면 함께 등록하세요.
                              </p>

                              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                                <div>
                                  <label className="mb-1 block text-xs font-black text-gray-600">
                                    Promo Code (선택)
                                  </label>
                                  <input
                                    value={draft.promoCode}
                                    onChange={(event) =>
                                      updateDraft(draft.localId, {
                                        promoCode: event.target.value
                                          .toUpperCase()
                                          .replace(/\s/g, "")
                                          .slice(0, 30),
                                      })
                                    }
                                    placeholder="예: SEOL2310"
                                    className="w-full rounded-2xl border p-3 text-center text-lg font-black tracking-[0.12em]"
                                  />
                                </div>

                                <div>
                                  <label className="mb-1 block text-xs font-black text-gray-600">
                                    버튼 문구
                                  </label>
                                  <input
                                    value={draft.orderButtonText}
                                    maxLength={24}
                                    onChange={(event) =>
                                      updateDraft(draft.localId, {
                                        orderButtonText: event.target.value,
                                      })
                                    }
                                    placeholder="RESERVE NOW"
                                    className="w-full rounded-2xl border p-3 font-black"
                                  />
                                </div>
                              </div>

                              <div className="mt-3">
                                <label className="mb-1 block text-xs font-black text-gray-600">
                                  Reservation URL
                                </label>
                                <input
                                  value={draft.orderUrl}
                                  onChange={(event) =>
                                    updateDraft(draft.localId, {
                                      orderUrl: event.target.value,
                                    })
                                  }
                                  placeholder="https://..."
                                  className="w-full rounded-2xl border p-3 font-semibold"
                                />
                              </div>
                            </div>
                          )}

                          {draft.activationMode === "online_order" && (
                            <div className="mt-4 rounded-2xl border border-blue-100 bg-blue-50/60 p-4">
                              <p className="text-sm font-black text-blue-800">
                                Online Order Coupon
                              </p>
                              <p className="mt-1 text-xs font-semibold text-blue-700/70">
                                고객은 코드를 복사한 뒤 ORDER NOW를 눌러 매장 주문 사이트에서 사용합니다.
                              </p>

                              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                                <div>
                                  <label className="mb-1 block text-xs font-black text-gray-600">
                                    Promo Code
                                  </label>
                                  <input
                                    value={draft.promoCode}
                                    onChange={(event) =>
                                      updateDraft(draft.localId, {
                                        promoCode: event.target.value
                                          .toUpperCase()
                                          .replace(/\s/g, "")
                                          .slice(0, 30),
                                      })
                                    }
                                    placeholder="예: SAVE10"
                                    className="w-full rounded-2xl border p-3 text-center text-lg font-black tracking-[0.12em]"
                                  />
                                </div>

                                <div>
                                  <label className="mb-1 block text-xs font-black text-gray-600">
                                    버튼 문구
                                  </label>
                                  <input
                                    value={draft.orderButtonText}
                                    maxLength={24}
                                    onChange={(event) =>
                                      updateDraft(draft.localId, {
                                        orderButtonText: event.target.value,
                                      })
                                    }
                                    placeholder="ORDER NOW"
                                    className="w-full rounded-2xl border p-3 font-black"
                                  />
                                </div>
                              </div>

                              <div className="mt-3">
                                <label className="mb-1 block text-xs font-black text-gray-600">
                                  Online Order URL
                                </label>
                                <input
                                  value={draft.orderUrl}
                                  onChange={(event) =>
                                    updateDraft(draft.localId, {
                                      orderUrl: event.target.value,
                                    })
                                  }
                                  placeholder="https://..."
                                  className="w-full rounded-2xl border p-3 font-semibold"
                                />
                              </div>

                              <div className="mt-4 rounded-2xl bg-white p-4 text-center shadow-sm">
                                <p className="text-[10px] font-black uppercase tracking-[0.18em] text-blue-600">
                                  PROMO CODE
                                </p>
                                <p className="mt-1 text-2xl font-black tracking-[0.12em] text-[#172033]">
                                  {draft.promoCode || "SAVE10"}
                                </p>
                                <button
                                  type="button"
                                  className="mt-3 rounded-xl bg-[#EB4A45] px-5 py-2 text-xs font-black text-white"
                                >
                                  {draft.orderButtonText || "ORDER NOW"}
                                </button>
                              </div>
                            </div>
                          )}

                          {draft.activationMode === "staff_stamp" && (
                            <div className="mt-4 space-y-3 rounded-2xl border border-red-100 bg-red-50/50 p-4">
                              <div className="grid gap-3 sm:grid-cols-2">
                                <div>
                                  <label className="mb-1 block text-xs font-black text-gray-600">
                                    스탬프 코드 (매장용 4자리)
                                  </label>
                                  <input
                                    value={draft.stampCode}
                                    inputMode="numeric"
                                    maxLength={4}
                                    onChange={(event) =>
                                      updateDraft(draft.localId, {
                                        stampCode: event.target.value
                                          .replace(/\D/g, "")
                                          .slice(0, 4),
                                        pinRequired: false,
                                        pinCode: "",
                                      })
                                    }
                                    placeholder="예: 2580"
                                    className="w-full rounded-2xl border p-3 text-center text-lg font-black tracking-[0.35em]"
                                  />
                                  <p className="mt-1 text-[10px] font-semibold text-gray-400">
                                    첫 방문 때 직원이 고객 화면에 이 코드를 입력합니다.
                                  </p>
                                </div>

                                <div>
                                  <label className="mb-1 block text-xs font-black text-gray-600">
                                    스탬프 후 유효기간
                                  </label>
                                  <div className="flex items-center gap-2">
                                    <input
                                      type="number"
                                      min={1}
                                      max={365}
                                      value={draft.stampValidDays}
                                      onChange={(event) =>
                                        updateDraft(draft.localId, {
                                          stampValidDays: Math.max(
                                            1,
                                            Number(event.target.value) || 31,
                                          ),
                                        })
                                      }
                                      className="w-full rounded-2xl border p-3 text-center font-black"
                                    />
                                    <span className="shrink-0 text-sm font-black text-gray-600">
                                      days
                                    </span>
                                  </div>
                                </div>
                              </div>

                              <div>
                                <label className="mb-1 block text-xs font-black text-gray-600">
                                  스탬프 문구
                                </label>
                                <input
                                  value={draft.stampText}
                                  maxLength={100}
                                  onChange={(event) =>
                                    updateDraft(draft.localId, {
                                      stampText: event.target.value,
                                    })
                                  }
                                  placeholder="THANK YOU! See you again soon!"
                                  className="w-full rounded-2xl border p-3 font-bold"
                                />
                                <div className="mt-3 flex justify-center">
                                  <div className="flex h-32 w-32 rotate-[-7deg] flex-col items-center justify-center rounded-full border-4 border-green-700 bg-white text-center text-green-800 shadow-sm">
                                    <p className="text-[13px] font-black uppercase">
                                      {draft.stampText || "THANK YOU!"}
                                    </p>
                                    <p className="mt-1 text-2xl">✓</p>
                                    <p className="text-[10px] font-black">
                                      STAMPED
                                    </p>
                                  </div>
                                </div>
                              </div>

                              <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4">
                                <label className="mb-1 block text-xs font-black text-amber-800">
                                  ⓘ 말풍선 안내문
                                </label>
                                <input
                                  value={draft.infoText}
                                  maxLength={120}
                                  onChange={(event) =>
                                    updateDraft(draft.localId, {
                                      infoText: event.target.value,
                                    })
                                  }
                                  placeholder="예: First visit? Ask a staff member to stamp this coupon."
                                  className="w-full rounded-2xl border border-amber-200 bg-white p-3 font-bold"
                                />
                                <p className="mt-1 text-[10px] font-semibold text-amber-700/70">
                                  고객 쿠폰 화면의 깜박이는 ⓘ 아이콘을 누르면 이 문구가 말풍선으로 표시됩니다.
                                </p>
                              </div>

                              <div className="rounded-xl bg-white px-4 py-3">
                                <p className="text-[11px] font-black text-red-600">
                                  FIRST VISIT
                                </p>
                                <p className="mt-1 text-xs font-bold text-gray-700">
                                  Show this coupon to a staff member and enter the store stamp code.
                                </p>
                                <p className="mt-3 text-[11px] font-black text-red-600">
                                  NEXT VISIT
                                </p>
                                <p className="mt-1 text-xs font-bold text-gray-700">
                                  Use your stamped coupon within {draft.stampValidDays || 31} days.
                                </p>
                              </div>
                            </div>
                          )}
                        </div>

                        <label className="mb-1 mt-3 block text-sm font-black">
                          쿠폰 전체 사용 한도
                        </label>
                        <input
                          type="number"
                          min={0}
                          value={draft.usageLimit}
                          onChange={(event) =>
                            updateDraft(draft.localId, {
                              usageLimit: Number(event.target.value),
                            })
                          }
                          className="mb-3 w-full rounded-2xl border p-3 font-bold"
                        />

                        <div className="grid gap-3 sm:grid-cols-2">
                          <div>
                            <label className="mb-1 block text-sm font-black">
                              시작일
                            </label>
                            <input
                              type="datetime-local"
                              value={draft.startDate}
                              onChange={(event) =>
                                updateDraft(draft.localId, {
                                  startDate: event.target.value,
                                })
                              }
                              className="w-full rounded-2xl border p-3 font-bold"
                            />
                          </div>

                          <div>
                            <label className="mb-1 block text-sm font-black">
                              종료일
                            </label>
                            <input
                              type="datetime-local"
                              value={draft.endDate}
                              onChange={(event) =>
                                updateDraft(draft.localId, {
                                  endDate: event.target.value,
                                })
                              }
                              className="w-full rounded-2xl border p-3 font-bold"
                            />
                          </div>
                        </div>

                        {draft.activationMode === "immediate" && (
                          <>
                        <div className="mt-4 rounded-2xl border border-[#E6DCD1] bg-[#FCFAF7] p-4">
                          <p className="text-sm font-black">매장 확인 방식</p>
                          <p className="mt-1 text-xs font-semibold text-gray-500">
                            일반 쿠폰은 직원이 REDEEM NOW만 누르면 됩니다. 필요할 때만 PIN을 사용하세요.
                          </p>

                          <div className="mt-3 grid gap-2 sm:grid-cols-2">
                            <button
                              type="button"
                              onClick={() =>
                                updateDraft(draft.localId, {
                                  pinRequired: false,
                                  pinCode: "",
                                })
                              }
                              className={`rounded-2xl border px-4 py-3 text-left ${
                                !draft.pinRequired
                                  ? "border-red-500 bg-red-50 text-red-700"
                                  : "border-gray-200 bg-white text-gray-600"
                              }`}
                            >
                              <p className="text-sm font-black">✓ Staff taps REDEEM NOW</p>
                              <p className="mt-1 text-[11px] font-semibold opacity-75">
                                PIN 없이 직원이 버튼만 눌러 사용 처리
                              </p>
                            </button>

                            <button
                              type="button"
                              onClick={() => {

                                updateDraft(draft.localId, {
                                  pinRequired: true,
                                });
                              }}
                              className={`rounded-2xl border px-4 py-3 text-left transition ${
                                draft.pinRequired
                                  ? "border-red-500 bg-red-50 text-red-700"
                                  : "border-gray-200 bg-white text-gray-600"
                              }`}
                            >
                              <p className="text-sm font-black">🔒 Require 4-digit PIN</p>
                              <p className="mt-1 text-[11px] font-semibold opacity-75">
                                고가 혜택 등 추가 확인이 필요한 쿠폰
                              </p>
                            </button>
                          </div>

                          {draft.pinRequired && (
                            <div className="mt-3">
                                <label className="mb-1 block text-sm font-black">
                                  4-Digit PIN
                                </label>
                                <input
                                  value={draft.pinCode}
                                  inputMode="numeric"
                                  maxLength={4}
                                  onChange={(event) =>
                                    updateDraft(draft.localId, {
                                      pinCode: event.target.value
                                        .replace(/\D/g, "")
                                        .slice(0, 4),
                                    })
                                  }
                                  placeholder="1234"
                                  className="w-full rounded-2xl border p-3 text-center text-lg font-black tracking-[0.4em]"
                                />
                              </div>
                          )}
                        </div>

                          </>
                        )}

                        <div className="mt-4 rounded-2xl border bg-[#FCFAF7] p-4">
                          <p className="mb-2 text-sm font-black">쿠폰 사진</p>

                          {selectedBusinessImages.length > 0 && (
                            <>
                              <p className="mb-2 text-xs font-black text-gray-500">
                                매장 등록 사진
                              </p>
                              <div className="grid grid-cols-5 gap-2 sm:grid-cols-8">
                                {selectedBusinessImages.map((url) => (
                                  <button
                                    type="button"
                                    key={url}
                                    onClick={() =>
                                      updateDraft(draft.localId, {
                                        imageUrl: url,
                                      })
                                    }
                                    className={`relative aspect-square overflow-hidden rounded-xl border-2 ${
                                      draft.imageUrl === url
                                        ? "border-red-500"
                                        : "border-transparent"
                                    }`}
                                  >
                                    <img
                                      src={url}
                                      alt=""
                                      className="h-full w-full object-cover"
                                    />
                                    {draft.imageUrl === url && (
                                      <span className="absolute right-1 top-1 rounded-full bg-red-500 px-1.5 py-0.5 text-[10px] font-black text-white">
                                        ✓
                                      </span>
                                    )}
                                  </button>
                                ))}
                              </div>
                            </>
                          )}

                          {priorCouponImages.length > 0 && (
                            <>
                              <p className="mb-2 mt-4 text-xs font-black text-gray-500">
                                기존 쿠폰에서 사용한 사진
                              </p>
                              <div className="grid grid-cols-5 gap-2 sm:grid-cols-8">
                                {priorCouponImages.map((url) => (
                                  <button
                                    type="button"
                                    key={url}
                                    onClick={() =>
                                      updateDraft(draft.localId, {
                                        imageUrl: url,
                                      })
                                    }
                                    className={`aspect-square overflow-hidden rounded-xl border-2 ${
                                      draft.imageUrl === url
                                        ? "border-red-500"
                                        : "border-transparent"
                                    }`}
                                  >
                                    <img
                                      src={url}
                                      alt=""
                                      className="h-full w-full object-cover"
                                    />
                                  </button>
                                ))}
                              </div>
                            </>
                          )}

                          <div className="mt-4 flex flex-wrap gap-2">
                            <label className="cursor-pointer rounded-xl border-2 border-dashed px-4 py-2 text-sm font-black">
                              {uploadingDraftId === draft.localId
                                ? "업로드 중..."
                                : "＋ 새 사진 업로드"}
                              <input
                                type="file"
                                accept="image/*"
                                disabled={uploadingDraftId === draft.localId}
                                onChange={(event) =>
                                  handleImageFileChange(
                                    draft.localId,
                                    event,
                                  )
                                }
                                className="hidden"
                              />
                            </label>

                            {draft.imageUrl && (
                              <button
                                type="button"
                                onClick={() =>
                                  updateDraft(draft.localId, {
                                    imageUrl: "",
                                  })
                                }
                                className="rounded-xl bg-gray-200 px-4 py-2 text-sm font-black"
                              >
                                사진 제거
                              </button>
                            )}
                          </div>
                        </div>
                      </div>

                      <div className="lg:sticky lg:top-5 lg:self-start">
                        <p className="mb-2 text-center text-xs font-black text-gray-400">
                          PREVIEW
                        </p>

                        <div className="relative overflow-hidden rounded-[22px] border-2 border-dashed border-red-400 bg-[#FFFDF9]">
                          <div className="absolute right-3 top-2 text-lg">✂</div>

                          <div className="p-4 text-center">
                            <p className="text-xs font-black">
                              {selectedBusiness.name}
                            </p>

                            <p className="mt-3 text-3xl font-black text-red-600">
                              {couponValueText(draft)}
                            </p>

                            {draft.couponType === "spend_save" && (
                              <p className="mt-1 text-sm font-black text-[#172033]">
                                When you spend ${draft.minimumPurchase || 0}+
                              </p>
                            )}

                            {draft.description && (
                              <p className="mt-1 text-sm font-black">
                                {draft.description}
                              </p>
                            )}

                            <div className="mt-4 h-40 overflow-hidden rounded-2xl bg-gray-100">
                              {draft.imageUrl ? (
                                <img
                                  src={draft.imageUrl}
                                  alt=""
                                  className="h-full w-full object-cover"
                                />
                              ) : (
                                <div className="flex h-full items-center justify-center text-4xl">
                                  🎟️
                                </div>
                              )}
                            </div>

                            <div className="mt-4 border-t border-dashed pt-3 text-[11px] font-semibold text-gray-500">
                              <p>
                                {draft.usageMode === "yearly"
                                  ? "Once per year per customer."
                                  : draft.usageMode === "multiple"
                                    ? "Multiple uses allowed."
                                    : "One time use per customer."}
                              </p>
                              {draft.activationMode === "staff_stamp" ? (
                                <>
                                  <p className="mt-2 font-black text-red-600">
                                    FIRST VISIT: Get a staff stamp.
                                  </p>
                                  <p className="font-black text-red-600">
                                    NEXT VISIT: Use within {draft.stampValidDays || 31} days.
                                  </p>
                                  <p className="mt-1 font-black text-green-700">
                                    {draft.stampText || "THANK YOU! See you again soon!"}
                                  </p>
                                </>
                              ) : draft.activationMode === "reservation" ? (
                                <>
                                  <p className="mt-2 font-black text-amber-700">
                                    RESERVATION REQUIRED
                                  </p>
                                  {draft.promoCode && (
                                    <p className="font-black text-amber-700">
                                      Promo Code: {draft.promoCode}
                                    </p>
                                  )}
                                </>
                              ) : draft.activationMode === "online_order" ? (
                                <p>Online order promo code required.</p>
                              ) : (
                                <p>Available for immediate use.</p>
                              )}

                              {draft.activationMode === "immediate" && (
                                <p>
                                  {draft.pinRequired
                                    ? "4-digit store PIN required."
                                    : "Staff approval required at redemption."}
                                </p>
                              )}
                              <p>Not valid with any other offers.</p>
                              {draft.endDate && (
                                <p>
                                  Expires{" "}
                                  {new Date(
                                    draft.endDate,
                                  ).toLocaleDateString("en-US")}
                                </p>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </article>
                ))}
              </div>

              <div id="coupon-draft-bottom" className="mt-5 grid gap-3 md:grid-cols-2">
                <button
                  type="button"
                  onClick={() => addAnotherCoupon(true)}
                  className="rounded-2xl border-2 border-dashed border-red-300 bg-white p-4 text-lg font-black text-red-700"
                >
                  ＋ ADD ANOTHER COUPON
                  <span className="mt-1 block text-xs font-bold text-gray-500">
                    기간 · 사용 방식 · 확인 방식 · 사진을 이전 쿠폰에서 복사
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => addAnotherCoupon(false)}
                  className="rounded-2xl border-2 border-dashed border-gray-300 bg-white p-4 text-lg font-black"
                >
                  ＋ 빈 쿠폰 추가
                  <span className="mt-1 block text-xs font-bold text-gray-500">
                    새 양식으로 추가
                  </span>
                </button>
              </div>

              <label className="mt-4 flex items-center gap-2 rounded-2xl bg-white p-4 text-sm font-black shadow-sm">
                <input
                  type="checkbox"
                  checked={addUploadedToBusinessGallery}
                  onChange={(event) =>
                    setAddUploadedToBusinessGallery(event.target.checked)
                  }
                  className="h-4 w-4 accent-red-600"
                />
                새로 업로드한 사진을 매장 갤러리에도 추가
              </label>

              <div className="mt-5 rounded-[28px] bg-[#172033] p-5 text-white shadow-xl">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="text-sm font-bold text-white/70">
                      READY TO SAVE
                    </p>
                    <p className="text-2xl font-black">
                      {drafts.length}개 쿠폰
                    </p>
                    <p className="text-xs font-semibold text-white/60">
                      각각 별도의 coupon row로 저장됩니다.
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={() => void saveAllCoupons()}
                    disabled={savingAll}
                    className="min-w-[240px] rounded-2xl bg-red-500 px-6 py-4 text-lg font-black disabled:opacity-50"
                  >
                    {savingAll
                      ? "Saving..."
                      : `SAVE ALL ${drafts.length} COUPONS`}
                  </button>
                </div>
              </div>
            </section>

            <section className="rounded-[28px] border border-[#E8DED2] bg-white p-5 shadow-sm">
              <div className="mb-4">
                <h2 className="text-xl font-black">3. 기존 등록 쿠폰</h2>
                <p className="text-sm font-semibold text-gray-500">
                  {selectedBusiness.name} · {businessCoupons.length}개
                </p>
              </div>

              {businessCoupons.length === 0 ? (
                <div className="rounded-2xl bg-amber-50 p-5 text-center font-black text-amber-700">
                  아직 등록된 쿠폰이 없습니다.
                </div>
              ) : (
                <div className="grid gap-3 lg:grid-cols-2">
                  {businessCoupons.map((coupon) => {
                    const expired = isExpired(coupon);

                    return (
                      <div
                        key={coupon.id}
                        className="rounded-2xl border p-3"
                      >
                        <div className="flex gap-3">
                          <div className="h-20 w-20 shrink-0 overflow-hidden rounded-xl bg-gray-100">
                            {coupon.image_url ? (
                              <img
                                src={coupon.image_url}
                                alt=""
                                className="h-full w-full object-cover"
                              />
                            ) : (
                              <div className="flex h-full items-center justify-center text-2xl">
                                🎟️
                              </div>
                            )}
                          </div>

                          <div className="min-w-0 flex-1">
                            <div className="flex items-start justify-between gap-2">
                              <div>
                                <p className="font-black">{coupon.title}</p>
                                <p className="text-sm font-semibold text-gray-500">
                                  {coupon.description}
                                </p>
                              </div>

                              <span
                                className={`shrink-0 rounded-full px-2 py-1 text-[11px] font-black ${
                                  expired
                                    ? "bg-gray-200 text-gray-600"
                                    : "bg-green-100 text-green-700"
                                }`}
                              >
                                {expired ? "Expired" : "Active"}
                              </span>
                            </div>

                            {coupon.coupon_type === "spend_save" && (
                              <p className="mt-2 text-xs font-black text-red-600">
                                ${coupon.value || 0} OFF · Spend $
                                {coupon.minimum_purchase || 0}+
                              </p>
                            )}

                            <p className="mt-2 text-xs font-bold text-gray-500">
                              사용 {coupon.used_count || 0} /{" "}
                              {coupon.usage_limit || 0}
                            </p>
                            <div className="mt-1 flex flex-wrap gap-1">
                              <span className="rounded-full bg-gray-100 px-2 py-1 text-[10px] font-black text-gray-600">
                                {inferCouponType(coupon)}
                              </span>
                              <span className="rounded-full bg-gray-100 px-2 py-1 text-[10px] font-black text-gray-600">
                                {coupon.usage_mode === "yearly"
                                  ? "Once per year"
                                  : coupon.usage_mode === "multiple" || coupon.repeatable
                                    ? "Multiple uses"
                                    : "One time"}
                              </span>
                              <span className="rounded-full bg-gray-100 px-2 py-1 text-[10px] font-black text-gray-600">
                                {coupon.pin_code ? "PIN" : "Staff tap"}
                              </span>
                            </div>
                          </div>
                        </div>

                        <div className="mt-3 grid grid-cols-3 gap-2">
                          <button
                            type="button"
                            onClick={() => editExistingCoupon(coupon)}
                            className="rounded-xl bg-blue-500 p-2 text-sm font-black text-white"
                          >
                            수정
                          </button>

                          <button
                            type="button"
                            onClick={() => void toggleActive(coupon)}
                            className="rounded-xl bg-gray-700 p-2 text-sm font-black text-white"
                          >
                            {coupon.active ? "비활성" : "활성"}
                          </button>

                          <button
                            type="button"
                            onClick={() => void deleteCoupon(coupon.id)}
                            className="rounded-xl bg-red-500 p-2 text-sm font-black text-white"
                          >
                            삭제
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </section>
          </div>
        )}
      </div>

      <BottomNav />
    </main>
  );
}


