"use client";

import type { CSSProperties } from "react";
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import MenuItemModal from "./MenuItemModal";
import RestaurantCheckoutModal from "./RestaurantCheckoutModal";
import type { MenuOrderDraft } from "./MenuItemModal";
import type { RestaurantMenuItem, RestaurantMenuPayload } from "./types";
import { getOptionGroups, groupKey, optionKey } from "./types";

type PricedRestaurantMenuItem = RestaurantMenuItem & {
  pickup_price?: number | null;
  delivery_price?: number | null;
};

function getPriceForService(
  item: RestaurantMenuItem,
  service: "menu" | "pickup" | "delivery",
) {
  const priced = item as PricedRestaurantMenuItem;

  const base =
    item.price == null
      ? null
      : Number(item.price);

  const pickup =
    priced.pickup_price == null
      ? base
      : Number(priced.pickup_price);

  const delivery =
    priced.delivery_price == null
      ? pickup
      : Number(priced.delivery_price);

  if (service === "delivery") {
    return Number.isFinite(delivery as number)
      ? delivery
      : null;
  }

  if (service === "pickup") {
    return Number.isFinite(pickup as number)
      ? pickup
      : null;
  }

  return Number.isFinite(base as number)
    ? base
    : null;
}

function withServicePrice(
  item: RestaurantMenuItem,
  service: "menu" | "pickup" | "delivery",
): RestaurantMenuItem {
  return {
    ...item,
    price: getPriceForService(item, service),
  };
}

type Props = {
  businessId: number;
  compact?: boolean;
  backgroundColor?: string;
  textColor?: string;
  scrollTopEnabled?: boolean;
  scrollTopButtonColor?: string;
  scrollTopIconColor?: string;
  scrollTopPosition?: "right" | "left";

  // 이전 코드 호환용. 아래 pickup/delivery가 없을 때만 사용합니다.
  orderEnabled?: boolean;

  // 페이지에서 허용할 표시/주문 방식
  menuEnabled?: boolean;
  pickupEnabled?: boolean;
  deliveryEnabled?: boolean;

  // WebsiteRenderer가 모바일 하단 ORDER/CART 버튼을 제공할 때
  // RestaurantMenu 자체 floating cart 버튼은 숨깁니다.
  externalCartButton?: boolean;
};

type StoredCartItem = {
  cartItemId: string;
  businessId: number;
  menuItemId: number;
  name: string;
  basePrice: number;
  quantity: number;
  instructions: string;
  selections: MenuOrderDraft["selections"];
  unitPrice: number;
  totalPrice: number;
  imageUrl: string;
  fulfillmentType?: "pickup" | "delivery";
  addedAt: string;
};

function getCartStorageKey(businessId: number) {
  return `restaurant-order-cart:${businessId}`;
}

function readStoredCart(businessId: number): StoredCartItem[] {
  if (typeof window === "undefined") return [];

  try {
    const raw = window.localStorage.getItem(getCartStorageKey(businessId));
    if (!raw) return [];

    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeStoredCart(businessId: number, items: StoredCartItem[]) {
  if (typeof window === "undefined") return;

  window.localStorage.setItem(
    getCartStorageKey(businessId),
    JSON.stringify(items),
  );

  // 같은 페이지의 장바구니 버튼/카운트가 즉시 갱신할 수 있게 이벤트 발생
  window.dispatchEvent(
    new CustomEvent("restaurant-order-cart-updated", {
      detail: {
        businessId,
        items,
        count: items.reduce(
          (sum, cartItem) => sum + Math.max(1, Number(cartItem.quantity) || 1),
          0,
        ),
      },
    }),
  );
}

const VISITOR_ID_STORAGE_KEY = "ktown_anonymous_visitor_id";

function getMenuClickVisitorId() {
  try {
    let visitorId = window.localStorage.getItem(VISITOR_ID_STORAGE_KEY);

    if (!visitorId) {
      visitorId = window.crypto.randomUUID();
      window.localStorage.setItem(VISITOR_ID_STORAGE_KEY, visitorId);
    }

    return visitorId;
  } catch {
    return window.crypto.randomUUID();
  }
}

export default function RestaurantMenu({
  businessId,
  compact = false,
  backgroundColor = "#ffffff",
  textColor = "#111827",
  scrollTopEnabled = true,
  scrollTopButtonColor = "#111827",
  scrollTopIconColor = "#ffffff",
  scrollTopPosition = "right",
  orderEnabled = false,
  menuEnabled = true,
  pickupEnabled = false,
  deliveryEnabled = false,
  externalCartButton = false,
}: Props) {
  const [data, setData] = useState<RestaurantMenuPayload>({
    categories: [],
    items: [],
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [activeCategoryId, setActiveCategoryId] = useState<number | null>(null);
  const [selectedItem, setSelectedItem] =
    useState<RestaurantMenuItem | null>(null);

  // WebsiteEditor에 저장되어 있는 예전 section/cell 값보다
  // businesses 테이블의 현재 주문 설정을 우선합니다.
  const [resolvedMenuEnabled, setResolvedMenuEnabled] = useState(menuEnabled);
  const [resolvedPickupEnabled, setResolvedPickupEnabled] = useState(pickupEnabled);
  const [resolvedDeliveryEnabled, setResolvedDeliveryEnabled] = useState(deliveryEnabled);

  const [cartItems, setCartItems] = useState<StoredCartItem[]>([]);
  const [cartOpen, setCartOpen] = useState(false);
  const [checkoutOpen, setCheckoutOpen] = useState(false);
  const [isIPhone, setIsIPhone] = useState(false);

  useEffect(() => {
    const ua = window.navigator.userAgent || "";
    setIsIPhone(/iPhone/i.test(ua));
  }, []);

  const [showScrollTop, setShowScrollTop] = useState(false);
  const [scrollTopButtonStyle, setScrollTopButtonStyle] =
    useState<CSSProperties>({});
  const [categoryBarFixed, setCategoryBarFixed] = useState(false);
  const [categoryBarHeight, setCategoryBarHeight] = useState(0);

  const rootRef = useRef<HTMLDivElement>(null);
  const categoryBarSentinelRef = useRef<HTMLDivElement>(null);
  const categoryBarMeasureRef = useRef<HTMLDivElement>(null);
  const recentMenuClickRef = useRef<{ key: string; time: number } | null>(null);

  // MENU만 켜져 있으면 보기 전용입니다.
  // PICKUP 또는 DELIVERY가 켜지면 해당 모드에서 자체 장바구니/체크아웃을 사용합니다.
  const hasOrderModes =
    resolvedPickupEnabled || resolvedDeliveryEnabled || orderEnabled;
  const effectivePickupEnabled =
    resolvedPickupEnabled ||
    (orderEnabled && !resolvedPickupEnabled && !resolvedDeliveryEnabled);
  const effectiveDeliveryEnabled = resolvedDeliveryEnabled;
  const orderingAvailable =
    effectivePickupEnabled || effectiveDeliveryEnabled;

  // Buns(#90)는 어두운 브랜드 배경에 카테고리별 포인트 컬러를 사용합니다.
  const isBunsMenu = businessId === 90;
  const bunsCategoryAccents = [
    "#facc15", // gold
    "#ef4444", // red
    "#f97316", // orange
    "#22c55e", // green
    "#38bdf8", // blue
    "#a78bfa", // purple
    "#ec4899", // pink
    "#14b8a6", // teal
  ];

  const getInitialService = (): "menu" | "pickup" | "delivery" => {
    if (typeof window !== "undefined") {
      const requested = new URLSearchParams(window.location.search).get("service");
      if (requested === "menu" && resolvedMenuEnabled) return "menu";
      if (requested === "pickup" && effectivePickupEnabled) return "pickup";
      if (requested === "delivery" && effectiveDeliveryEnabled) return "delivery";
    }

    if (resolvedMenuEnabled && !hasOrderModes) return "menu";
    if (effectivePickupEnabled) return "pickup";
    if (effectiveDeliveryEnabled) return "delivery";
    return "menu";
  };

  const [activeService, setActiveService] =
    useState<"menu" | "pickup" | "delivery">(getInitialService);

  const activeOrderEnabled =
    (activeService === "pickup" && effectivePickupEnabled) ||
    (activeService === "delivery" && effectiveDeliveryEnabled);

  const cartCount = cartItems.reduce(
    (sum, item) => sum + Math.max(1, Number(item.quantity) || 1),
    0,
  );

  const cartSubtotal = cartItems.reduce(
    (sum, item) => sum + Math.max(0, Number(item.totalPrice) || 0),
    0,
  );

  function recordMenuItemClick(
    item: RestaurantMenuItem,
    categoryName: string,
  ) {
    const now = Date.now();
    const clickKey = `${businessId}:${item.id}:${activeService}`;

    /* 더블클릭이나 터치 중복 이벤트는 한 번으로 처리합니다. */
    if (
      recentMenuClickRef.current?.key === clickKey &&
      now - recentMenuClickRef.current.time < 1500
    ) {
      return;
    }

    recentMenuClickRef.current = { key: clickKey, time: now };

    const body = JSON.stringify({
      businessId,
      menuItemId: item.id,
      menuItemName: item.name,
      categoryId: item.category_id,
      categoryName,
      service: activeService,
      visitorId: getMenuClickVisitorId(),
    });

    void fetch("/api/business-menu-click", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body,
      keepalive: true,
    }).catch(() => {
      /* 통계 기록 실패가 메뉴 상세창 사용을 방해하지 않게 합니다. */
    });
  }

  useEffect(() => {
    let cancelled = false;

    async function loadOrderSettings() {
      try {
        const response = await fetch(
          `/api/businesses/${encodeURIComponent(businessId)}/order-settings`,
          {
            cache: "no-store",
            headers: {
              "Cache-Control": "no-cache",
            },
          },
        );

        const payload = await response.json();

        if (!response.ok) {
          throw new Error(
            payload?.error || "주문 설정을 불러오지 못했습니다.",
          );
        }

        if (cancelled) return;

        const modes = payload?.orderModes || {};

        setResolvedMenuEnabled(modes.menu !== false);
        setResolvedPickupEnabled(modes.pickup === true);
        setResolvedDeliveryEnabled(modes.delivery === true);
      } catch (settingsError) {
        if (cancelled) return;

        console.error(
          "Restaurant order settings load failed:",
          settingsError,
        );

        setResolvedMenuEnabled(menuEnabled);
        setResolvedPickupEnabled(pickupEnabled);
        setResolvedDeliveryEnabled(deliveryEnabled);
      }
    }

    void loadOrderSettings();

    return () => {
      cancelled = true;
    };
  }, [businessId, menuEnabled, pickupEnabled, deliveryEnabled]);

  useEffect(() => {
    setCartItems(readStoredCart(businessId));

    function syncCart(event?: Event) {
      if (event instanceof CustomEvent) {
        const detailBusinessId = Number(event.detail?.businessId);
        if (Number.isFinite(detailBusinessId) && detailBusinessId !== businessId) {
          return;
        }
      }
      setCartItems(readStoredCart(businessId));
    }

    function syncStorage(event: StorageEvent) {
      if (event.key && event.key !== getCartStorageKey(businessId)) return;
      setCartItems(readStoredCart(businessId));
    }

    function openCartFromExternalButton(event: Event) {
      if (!(event instanceof CustomEvent)) return;

      const detailBusinessId = Number(event.detail?.businessId);
      if (
        Number.isFinite(detailBusinessId) &&
        detailBusinessId !== businessId
      ) {
        return;
      }

      if (event.detail && typeof event.detail === "object") {
        event.detail.handled = true;
      }

      setCartItems(readStoredCart(businessId));
      setCartOpen(true);
    }

    window.addEventListener("restaurant-order-cart-updated", syncCart as EventListener);
    window.addEventListener(
      "restaurant-order-open-cart",
      openCartFromExternalButton as EventListener,
    );
    window.addEventListener("storage", syncStorage);

    return () => {
      window.removeEventListener("restaurant-order-cart-updated", syncCart as EventListener);
      window.removeEventListener(
        "restaurant-order-open-cart",
        openCartFromExternalButton as EventListener,
      );
      window.removeEventListener("storage", syncStorage);
    };
  }, [businessId]);

  useEffect(() => {
    // 서비스 변경 후 기존 가격으로 열린 모달이 남지 않게 닫습니다.
    setSelectedItem(null);
  }, [activeService]);

  useEffect(() => {
    // DB 주문 설정이 비동기로 들어온 뒤 서비스 상태를 반드시 재조정합니다.
    // 주문 방식이 하나라도 켜져 있으면 주문 화면(PICKUP 우선)으로 진입합니다.
    if (activeService === "pickup" && effectivePickupEnabled) return;
    if (activeService === "delivery" && effectiveDeliveryEnabled) return;

    if (orderingAvailable) {
      if (effectivePickupEnabled) {
        setActiveService("pickup");
      } else if (effectiveDeliveryEnabled) {
        setActiveService("delivery");
      }
      return;
    }

    if (resolvedMenuEnabled) {
      setActiveService("menu");
    }
  }, [
    activeService,
    resolvedMenuEnabled,
    effectivePickupEnabled,
    effectiveDeliveryEnabled,
    orderingAvailable,
  ]);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      setError("");

      try {
        const response = await fetch(
          `/api/businesses/${encodeURIComponent(businessId)}/menu`,
          {
            cache: "no-store",
          },
        );

        const payload = await response.json();

        if (!response.ok) {
          throw new Error(
            payload?.error || "메뉴를 불러오지 못했습니다.",
          );
        }

        if (!cancelled) {
          setData({
            categories: Array.isArray(payload?.categories)
              ? payload.categories
              : [],
            items: Array.isArray(payload?.items)
              ? payload.items
              : [],
          });
        }
      } catch (loadError) {
        if (!cancelled) {
          setError(
            loadError instanceof Error
              ? loadError.message
              : "메뉴를 불러오지 못했습니다.",
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
  }, [businessId]);

  function getMenuScrollContainer() {
    if (typeof window === "undefined") return null;

    let element = rootRef.current?.parentElement ?? null;

    while (element) {
      const style = window.getComputedStyle(element);
      const overflowY = style.overflowY;

      const canScroll =
        (overflowY === "auto" ||
          overflowY === "scroll" ||
          overflowY === "overlay") &&
        element.scrollHeight > element.clientHeight + 2;

      if (canScroll) return element;
      element = element.parentElement;
    }

    return null;
  }

  function scrollMenuToTop() {
    const container = getMenuScrollContainer();

    if (container) {
      container.scrollTo({
        top: 0,
        left: 0,
        behavior: "smooth",
      });
      return;
    }

    const scrollingElement = document.scrollingElement;

    if (scrollingElement) {
      scrollingElement.scrollTo({
        top: 0,
        left: 0,
        behavior: "smooth",
      });
      return;
    }

    window.scrollTo({
      top: 0,
      left: 0,
      behavior: "smooth",
    });
  }

  useEffect(() => {
    // 모든 Restaurant Menu / Online Order 페이지에 공통 적용:
    // 현재 스크롤 위치가 1500px을 넘으면 맨 위로 버튼을 표시합니다.
    const container = getMenuScrollContainer();

    function update() {
      const root = rootRef.current;
      if (!root) return;

      const currentScroll = container
        ? container.scrollTop
        : window.scrollY ||
          document.documentElement.scrollTop ||
          0;

      setShowScrollTop(currentScroll >= 1500);

      setScrollTopButtonStyle({
        bottom: compact ? 82 : 28,
        [scrollTopPosition]: compact ? 14 : 28,
      });
    }

    update();

    const scrollTarget: EventTarget = container || window;
    scrollTarget.addEventListener("scroll", update, {
      passive: true,
    });
    window.addEventListener("resize", update);

    const observer =
      typeof ResizeObserver !== "undefined"
        ? new ResizeObserver(update)
        : null;

    if (rootRef.current && observer) {
      observer.observe(rootRef.current);
    }

    return () => {
      scrollTarget.removeEventListener("scroll", update);
      window.removeEventListener("resize", update);
      observer?.disconnect();
    };
  }, [compact, scrollTopPosition, data.items.length]);

  const visibleCategories = data.categories.filter((category) =>
    data.items.some(
      (item) => item.category_id === category.id,
    ),
  );

  useEffect(() => {
    if (!isBunsMenu || !visibleCategories.length) {
      setCategoryBarFixed(false);
      return;
    }

    const updateCategoryBarPosition = () => {
      const sentinel = categoryBarSentinelRef.current;
      const root = rootRef.current;
      const measure = categoryBarMeasureRef.current;

      if (!sentinel || !root) return;

      const isMobile = window.matchMedia("(max-width: 767px)").matches;
      if (!isMobile) {
        setCategoryBarFixed(false);
        return;
      }

      const measuredHeight = Math.max(
        48,
        Math.round(measure?.getBoundingClientRect().height || 0),
      );
      setCategoryBarHeight(measuredHeight);

      const sentinelTop = sentinel.getBoundingClientRect().top;
      const rootBottom = root.getBoundingClientRect().bottom;

      // 카테고리 바의 원래 위치를 지나면 화면 위에 고정하고,
      // 메뉴 영역의 끝에 도달하면 다시 해제합니다.
      setCategoryBarFixed(
        sentinelTop <= 0 && rootBottom > measuredHeight + 8,
      );
    };

    updateCategoryBarPosition();

    window.addEventListener("scroll", updateCategoryBarPosition, {
      passive: true,
    });
    window.addEventListener("resize", updateCategoryBarPosition);

    return () => {
      window.removeEventListener("scroll", updateCategoryBarPosition);
      window.removeEventListener("resize", updateCategoryBarPosition);
    };
  }, [isBunsMenu, visibleCategories.length]);

  function scrollToCategory(categoryId: number) {
    setActiveCategoryId(categoryId);

    document
      .getElementById(
        `restaurant-menu-${businessId}-${categoryId}`,
      )
      ?.scrollIntoView({
        behavior: "smooth",
        block: "start",
      });
  }

  function persistCart(items: StoredCartItem[]) {
    setCartItems(items);
    writeStoredCart(businessId, items);
  }

  function changeCartQuantity(cartItemId: string, delta: number) {
    const next = cartItems
      .map((item) => {
        if (item.cartItemId !== cartItemId) return item;

        const nextQuantity = Math.max(0, (Number(item.quantity) || 1) + delta);
        if (nextQuantity === 0) return null;

        return {
          ...item,
          quantity: nextQuantity,
          totalPrice: Math.max(0, Number(item.unitPrice) || 0) * nextQuantity,
        };
      })
      .filter((item): item is StoredCartItem => Boolean(item));

    persistCart(next);
  }

  function removeCartItem(cartItemId: string) {
    persistCart(cartItems.filter((item) => item.cartItemId !== cartItemId));
  }

  function clearCart() {
    persistCart([]);
  }

  function getSelectedOptionLabels(item: StoredCartItem) {
    const menuItem = data.items.find((menu) => menu.id === item.menuItemId);
    if (!menuItem) return [];

    const groups = getOptionGroups(menuItem);
    const labels: string[] = [];

    groups.forEach((group, groupIndex) => {
      const selectedGroup = item.selections?.[groupKey(group, groupIndex)] || {};

      group.options.forEach((option, optionIndex) => {
        const selectedQuantity = Math.max(
          0,
          Math.floor(Number(selectedGroup[optionKey(option, optionIndex)]) || 0),
        );
        if (selectedQuantity <= 0) return;

        const priceDelta = Number(option.priceDelta || 0);
        const quantityText = selectedQuantity > 1 ? ` ×${selectedQuantity}` : "";
        const priceText =
          priceDelta !== 0
            ? ` (${priceDelta > 0 ? "+" : "-"}$${Math.abs(priceDelta).toFixed(2)})`
            : "";

        labels.push(`${option.name}${quantityText}${priceText}`);
      });
    });

    return labels;
  }

  function handleAddToOrder(draft: MenuOrderDraft) {
    if (!orderingAvailable) return;

    const fulfillmentType: "pickup" | "delivery" =
      activeService === "delivery" && effectiveDeliveryEnabled
        ? "delivery"
        : effectivePickupEnabled
          ? "pickup"
          : "delivery";

    const currentCart = readStoredCart(businessId);

    const newCartItem: StoredCartItem = {
      cartItemId:
        typeof crypto !== "undefined" &&
        typeof crypto.randomUUID === "function"
          ? crypto.randomUUID()
          : `cart-${Date.now()}-${Math.random()
              .toString(36)
              .slice(2, 9)}`,
      businessId,
      menuItemId: draft.item.id,
      name: draft.item.name,
      basePrice: Math.max(
        0,
        Number(draft.item.price || 0),
      ),
      quantity: Math.max(
        1,
        Number(draft.quantity) || 1,
      ),
      instructions: draft.instructions,
      selections: draft.selections,
      unitPrice: Math.max(
        0,
        Number(draft.unitPrice) || 0,
      ),
      totalPrice: Math.max(
        0,
        Number(draft.totalPrice) || 0,
      ),
      imageUrl:
        draft.item.thumbnail_url ||
        draft.item.image_url ||
        "",
      fulfillmentType,
      addedAt: new Date().toISOString(),
    };

    const nextCart = [...currentCart, newCartItem];
    persistCart(nextCart);

    setSelectedItem(null);
  }

  if (loading) {
    return (
      <div className="flex min-h-[260px] items-center justify-center text-sm font-black">
        메뉴 불러오는 중...
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex min-h-[260px] items-center justify-center px-5 text-center text-sm font-black text-red-600">
        {error}
      </div>
    );
  }

  return (
    <div
      ref={rootRef}
      className="relative w-full"
      style={{
        backgroundColor: "transparent",
        color: textColor,
      }}
    >
      {orderingAvailable ? (
        <div
          className={`border-b px-3 py-2 sm:px-5 ${
            isBunsMenu
              ? "border-white/10 bg-[#0b0b0b]"
              : "border-black/10"
          }`}
          style={{
            backgroundColor: isBunsMenu ? "#0b0b0b" : "transparent",
          }}
        >
          <div className="flex gap-2 overflow-x-auto">
            {resolvedMenuEnabled && !orderingAvailable ? (
              <button
                type="button"
                onClick={() => setActiveService("menu")}
                className={`shrink-0 rounded-full border px-3 py-2 text-[11px] font-black ${
                  activeService === "menu"
                    ? isBunsMenu
                      ? "border-white bg-white text-black"
                      : "bg-gray-950 text-white"
                    : isBunsMenu
                      ? "border-white/20 bg-white/5 text-white"
                      : "bg-white text-gray-900"
                }`}
              >
                MENU
              </button>
            ) : null}

            {effectivePickupEnabled ? (
              <button
                type="button"
                onClick={() => setActiveService("pickup")}
                className={`shrink-0 rounded-full border px-4 py-2 text-[11px] font-black transition-all ${
                  activeService === "pickup"
                    ? isBunsMenu
                      ? "border-white/30 bg-white/12 text-white"
                      : "border-gray-300 bg-gray-900 text-white"
                    : isBunsMenu
                      ? "border-white/20 bg-white/5 text-gray-200"
                      : "border-gray-300 bg-gray-100 text-gray-800"
                }`}
              >
                PICKUP
              </button>
            ) : null}

            {effectiveDeliveryEnabled ? (
              <button
                type="button"
                onClick={() => setActiveService("delivery")}
                className={`shrink-0 rounded-full border-2 px-4 py-2 text-[11px] font-black shadow-sm transition-all ${
                  activeService === "delivery"
                    ? "border-blue-400 bg-blue-600 text-white"
                    : isBunsMenu
                      ? "border-blue-400/60 bg-blue-400/10 text-blue-300"
                      : "border-blue-500 bg-blue-100 text-blue-950"
                }`}
              >
                DELIVERY
              </button>
            ) : null}
          </div>
        </div>
      ) : null}

      {visibleCategories.length ? (
        <>
          <div ref={categoryBarSentinelRef} className="h-px w-full" />

          {categoryBarFixed && isBunsMenu ? (
            <div
              aria-hidden="true"
              style={{ height: categoryBarHeight }}
            />
          ) : null}

          <div
            ref={categoryBarMeasureRef}
            className={`${
              categoryBarFixed && isBunsMenu
                ? "fixed inset-x-0 top-0 z-[12500]"
                : "sticky top-0 z-[70]"
            } border-b px-3 py-2.5 shadow-sm backdrop-blur-md ${
              isBunsMenu
                ? "border-white/10 bg-[#0b0b0b]/95"
                : "border-black/10"
            }`}
            style={{
              backgroundColor: isBunsMenu
                ? "rgba(11,11,11,0.96)"
                : backgroundColor,
              ...(categoryBarFixed && isBunsMenu
                ? {
                    paddingTop:
                      "max(10px, env(safe-area-inset-top, 0px))",
                  }
                : {}),
            }}
          >
            <div className="mx-auto flex max-w-[760px] gap-2 overflow-x-auto overscroll-x-contain [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
              {visibleCategories.map((category, categoryIndex) => {
                const accent =
                  bunsCategoryAccents[
                    categoryIndex % bunsCategoryAccents.length
                  ];
                const isActive =
                  activeCategoryId === category.id ||
                  (activeCategoryId == null && categoryIndex === 0);

                return (
                  <button
                    key={category.id}
                    type="button"
                    onClick={() => scrollToCategory(category.id)}
                    className={`shrink-0 rounded-full border px-3.5 py-2 text-[11px] font-black uppercase tracking-[0.02em] transition ${
                      isBunsMenu
                        ? "shadow-[0_2px_8px_rgba(0,0,0,0.24)]"
                        : ""
                    }`}
                    style={
                      isBunsMenu
                        ? {
                            borderColor: isActive
                              ? accent
                              : `${accent}66`,
                            backgroundColor: isActive
                              ? accent
                              : "rgba(255,255,255,0.05)",
                            color: isActive ? "#111827" : accent,
                          }
                        : {
                            backgroundColor: isActive
                              ? "#111827"
                              : "#ffffff",
                            color: isActive ? "#ffffff" : "#111827",
                            borderColor: isActive
                              ? "#111827"
                              : "rgba(17,24,39,0.16)",
                          }
                    }
                  >
                    {category.name}
                  </button>
                );
              })}
            </div>
          </div>
        </>
      ) : null}

      <div
        className={
          compact
            ? "px-3 py-4"
            : "px-4 py-5 sm:px-7 sm:py-7"
        }
        style={{ backgroundColor: "transparent" }}
      >
        {visibleCategories.map((category) => {
          const items = data.items.filter(
            (item) =>
              item.category_id === category.id,
          );

          return (
            <section
              key={category.id}
              id={`restaurant-menu-${businessId}-${category.id}`}
              className={`scroll-mt-[76px] pb-6 pt-3 last:border-b-0 ${
                isBunsMenu
                  ? "border-b border-white/10"
                  : "border-b border-gray-200"
              }`}
            >
              {(() => {
                const categoryIndex = visibleCategories.findIndex(
                  (entry) => entry.id === category.id,
                );
                const accent =
                  bunsCategoryAccents[
                    Math.max(0, categoryIndex) %
                      bunsCategoryAccents.length
                  ];

                return isBunsMenu ? (
                  <div className="mb-4 flex items-center gap-3">
                    <span
                      aria-hidden="true"
                      className="block h-10 w-1.5 shrink-0 rounded-full"
                      style={{ backgroundColor: accent }}
                    />
                    <h2 className="text-[22px] font-black tracking-tight text-white sm:text-2xl">
                      {category.name}
                    </h2>
                  </div>
                ) : (
                  <h2
                    className="mb-4 inline-block rounded-lg px-2 py-1 text-xl font-black tracking-tight sm:text-2xl"
                    style={{ backgroundColor }}
                  >
                    {category.name}
                  </h2>
                );
              })()}

              <div
                className={`grid grid-cols-1 gap-3 ${
                  compact ? "" : "lg:grid-cols-2"
                }`}
              >
                {items.map((item) => {
                  const hasImage = Boolean(
                    item.thumbnail_url ||
                      item.image_url,
                  );

                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => {
                        recordMenuItemClick(item, category.name);
                        setSelectedItem(
                          withServicePrice(item, activeService),
                        );
                      }}
                      className={`group flex min-h-[112px] w-full overflow-hidden rounded-xl border text-left transition ${
                        isBunsMenu
                          ? "shadow-[0_4px_18px_rgba(0,0,0,0.20)] hover:bg-white/[0.07]"
                          : "shadow-sm hover:shadow-md"
                      }`}
                      style={{
                        backgroundColor: isBunsMenu
                          ? "rgba(255,255,255,0.055)"
                          : backgroundColor,
                        borderColor: isBunsMenu
                          ? "rgba(255,255,255,0.12)"
                          : `${textColor}22`,
                        color: isBunsMenu ? "#ffffff" : textColor,
                      }}
                    >
                      <div className="min-w-0 flex-1 p-4">
                        <div className="flex items-start justify-between gap-3">
                          <h3 className="line-clamp-2 text-[15px] font-black leading-snug sm:text-base">
                            {item.name}
                          </h3>

                          {getPriceForService(item, activeService) != null ? (
                            <span
                              className="shrink-0 text-sm font-black"
                              style={
                                isBunsMenu
                                  ? {
                                      color:
                                        bunsCategoryAccents[
                                          Math.max(
                                            0,
                                            visibleCategories.findIndex(
                                              (entry) =>
                                                entry.id === category.id,
                                            ),
                                          ) %
                                            bunsCategoryAccents.length
                                        ],
                                    }
                                  : undefined
                              }
                            >
                              $
                              {Number(
                                getPriceForService(item, activeService),
                              ).toFixed(2)}
                            </span>
                          ) : null}
                        </div>

                        {item.description ? (
                          <p className="mt-2 line-clamp-3 text-xs font-medium leading-5 opacity-65 sm:text-sm">
                            {item.description}
                          </p>
                        ) : null}
                      </div>

                      {hasImage ? (
                        <div className="relative m-2 h-[94px] w-[94px] shrink-0 sm:h-[116px] sm:w-[116px]">
                          <img
                            src={
                              item.thumbnail_url ||
                              item.image_url ||
                              ""
                            }
                            alt={item.name}
                            className="h-full w-full rounded-xl object-cover"
                          />

                          {orderingAvailable ? (
                            <span
                              aria-hidden="true"
                              className="absolute bottom-2 right-2 flex h-9 w-9 items-center justify-center rounded-full border border-black/10 bg-white text-[24px] font-medium leading-none text-gray-950 shadow-md sm:h-10 sm:w-10"
                            >
                              +
                            </span>
                          ) : null}
                        </div>
                      ) : orderingAvailable ? (
                        <div className="flex shrink-0 items-end p-3">
                          <span
                            aria-hidden="true"
                            className="flex h-9 w-9 items-center justify-center rounded-full border border-black/10 bg-white text-[24px] font-medium leading-none text-gray-950 shadow-md sm:h-10 sm:w-10"
                          >
                            +
                          </span>
                        </div>
                      ) : null}
                    </button>
                  );
                })}
              </div>
            </section>
          );
        })}
      </div>

      {typeof document !== "undefined"
        ? createPortal(
            <>
              {orderingAvailable && !externalCartButton ? (
                <button
                  type="button"
                  onClick={() => setCartOpen(true)}
                  aria-label={`Shopping cart, ${cartCount} item${cartCount === 1 ? "" : "s"}`}
                  className="fixed bottom-5 right-5 z-[12000] flex h-14 items-center gap-2 rounded-full border border-black/10 bg-gray-950 px-4 text-white shadow-2xl transition hover:scale-[1.02] sm:bottom-7 sm:right-7"
                >
                  <span aria-hidden="true" className="text-xl leading-none">🛒</span>
                  <span className="text-xs font-black uppercase tracking-wide">Cart</span>
                  <span className="flex min-w-6 h-6 items-center justify-center rounded-full bg-white px-1.5 text-[11px] font-black text-gray-950">
                    {cartCount}
                  </span>
                </button>
              ) : null}

              {cartOpen ? (
                <div
                  className={
                    isIPhone
                      ? "fixed inset-0 z-[12600] flex items-start justify-center overflow-hidden bg-black/60 px-2 pt-[max(0.5rem,env(safe-area-inset-top))] pb-[max(0.5rem,env(safe-area-inset-bottom))]"
                      : "fixed inset-0 z-[12600] flex items-center justify-center bg-black/60 px-2 py-4 sm:p-4"
                  }
                  onClick={() => setCartOpen(false)}
                >
                  <div
                    className={
                      isIPhone
                        ? "mt-1 flex h-[85dvh] max-h-[85dvh] w-[calc(100%-1rem)] max-w-[350px] flex-col overflow-hidden rounded-2xl bg-white text-gray-950 shadow-2xl"
                        : "flex max-h-[88vh] w-full flex-col rounded-t-3xl bg-white text-gray-950 shadow-2xl sm:max-w-lg sm:rounded-3xl"
                    }
                    onClick={(event) => event.stopPropagation()}
                  >
                    <div
                      className={
                        isIPhone
                          ? "flex items-center justify-between border-b border-gray-200 px-4 py-3"
                          : "flex items-center justify-between border-b border-gray-200 px-5 py-4"
                      }
                    >
                      <div>
                        <p className="text-[10px] font-black uppercase tracking-[0.18em] text-gray-400">
                          {activeService === "delivery" ? "DELIVERY ORDER" : "PICKUP ORDER"}
                        </p>
                        <h3 className="mt-1 text-xl font-black">Shopping Cart</h3>
                      </div>
                      <button
                        type="button"
                        onClick={() => setCartOpen(false)}
                        className="flex h-9 w-9 items-center justify-center rounded-full bg-gray-100 text-lg font-black"
                        aria-label="Close cart"
                      >
                        ×
                      </button>
                    </div>

                    <div
                      className={
                        isIPhone
                          ? "min-h-0 flex-1 overflow-y-auto px-3 py-2.5"
                          : "min-h-0 flex-1 overflow-y-auto px-4 py-3 sm:px-5"
                      }
                    >
                      {cartItems.length ? (
                        <div className="space-y-3">
                          {cartItems.map((item) => (
                            <div
                              key={item.cartItemId}
                              className="flex gap-3 rounded-2xl border border-gray-200 p-3"
                            >
                              {item.imageUrl ? (
                                <img
                                  src={item.imageUrl}
                                  alt={item.name}
                                  className="h-20 w-20 shrink-0 rounded-xl object-cover"
                                />
                              ) : (
                                <div className="flex h-20 w-20 shrink-0 items-center justify-center rounded-xl bg-gray-100 text-2xl">
                                  🍽️
                                </div>
                              )}

                              <div className="min-w-0 flex-1">
                                <div className="flex items-start justify-between gap-2">
                                  <div className="min-w-0">
                                    <p className="truncate text-sm font-black">{item.name}</p>
                                    {getSelectedOptionLabels(item).length ? (
                                      <p className="mt-0.5 line-clamp-2 text-[10px] font-medium leading-4 text-gray-500">
                                        {getSelectedOptionLabels(item).join(" · ")}
                                      </p>
                                    ) : null}
                                    {item.instructions ? (
                                      <p className="mt-0.5 line-clamp-2 text-[10px] font-medium leading-4 text-gray-400">
                                        {item.instructions}
                                      </p>
                                    ) : null}
                                  </div>
                                  <span className="shrink-0 text-sm font-black">
                                    ${Math.max(0, Number(item.totalPrice) || 0).toFixed(2)}
                                  </span>
                                </div>

                                <div className="mt-3 flex items-center justify-between gap-3">
                                  <div className="inline-flex items-center rounded-full border border-gray-200">
                                    <button
                                      type="button"
                                      onClick={() => changeCartQuantity(item.cartItemId, -1)}
                                      className="flex h-8 w-8 items-center justify-center text-lg font-black"
                                      aria-label={`Decrease ${item.name} quantity`}
                                    >
                                      −
                                    </button>
                                    <span className="min-w-8 text-center text-xs font-black">
                                      {Math.max(1, Number(item.quantity) || 1)}
                                    </span>
                                    <button
                                      type="button"
                                      onClick={() => changeCartQuantity(item.cartItemId, 1)}
                                      className="flex h-8 w-8 items-center justify-center text-lg font-black"
                                      aria-label={`Increase ${item.name} quantity`}
                                    >
                                      +
                                    </button>
                                  </div>

                                  <button
                                    type="button"
                                    onClick={() => removeCartItem(item.cartItemId)}
                                    className="text-[11px] font-black uppercase tracking-wide text-red-600"
                                  >
                                    Remove
                                  </button>
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div className="flex min-h-[220px] flex-col items-center justify-center text-center">
                          <div className="text-4xl">🛒</div>
                          <p className="mt-3 text-base font-black">Your cart is empty</p>
                          <p className="mt-1 text-xs font-medium text-gray-500">
                            Tap the + button on a menu item to add it.
                          </p>
                        </div>
                      )}
                    </div>

                    <div
                      className={
                        isIPhone
                          ? "shrink-0 border-t border-gray-200 px-4 pb-[max(8px,env(safe-area-inset-bottom))] pt-3"
                          : "border-t border-gray-200 px-5 pb-[max(20px,env(safe-area-inset-bottom))] pt-4"
                      }
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-bold text-gray-600">Subtotal</span>
                        <span className="text-xl font-black">${cartSubtotal.toFixed(2)}</span>
                      </div>
                      <p className="mt-1 text-[10px] font-medium text-gray-400">
                        Taxes, fees, and delivery charges are calculated at checkout.
                      </p>

                      <div className="mt-4 grid grid-cols-[auto_1fr] gap-2">
                        {cartItems.length ? (
                          <button
                            type="button"
                            onClick={clearCart}
                            className={
                              isIPhone
                                ? "rounded-xl border border-gray-300 px-3 py-2.5 text-xs font-black"
                                : "rounded-xl border border-gray-300 px-4 py-3 text-xs font-black"
                            }
                          >
                            CLEAR
                          </button>
                        ) : <span />}
                        <button
                          type="button"
                          onClick={() => setCartOpen(false)}
                          className={
                              isIPhone
                                ? "rounded-xl border border-gray-300 px-3 py-2.5 text-xs font-black"
                                : "rounded-xl border border-gray-300 px-4 py-3 text-xs font-black"
                            }
                        >
                          CONTINUE ORDERING
                        </button>
                        {cartItems.length ? (
                          <button
                            type="button"
                            onClick={() => {
                              setCartOpen(false);
                              setCheckoutOpen(true);
                            }}
                            className={
                              isIPhone
                                ? "col-span-2 rounded-xl bg-gray-950 px-4 py-2.5 text-xs font-black text-white"
                                : "col-span-2 rounded-xl bg-gray-950 px-4 py-3 text-xs font-black text-white"
                            }
                          >
                            CHECKOUT
                          </button>
                        ) : null}
                      </div>
                    </div>
                  </div>
                </div>
              ) : null}
            </>,
            document.body,
          )
        : null}

      {checkoutOpen && orderingAvailable ? (
        <RestaurantCheckoutModal
          businessId={businessId}
          fulfillmentType={
            activeService === "delivery" && effectiveDeliveryEnabled
              ? "delivery"
              : "pickup"
          }
          cartItems={cartItems}
          onClose={() => setCheckoutOpen(false)}
          onOrderPlaced={() => {
            clearCart();
            setCheckoutOpen(false);
          }}
        />
      ) : null}

      {showScrollTop &&
      typeof document !== "undefined"
        ? createPortal(
            <button
              type="button"
              onClick={scrollMenuToTop}
              className={`fixed z-[11900] flex items-center justify-center rounded-full border text-xl font-black shadow-2xl ${
                compact
                  ? "h-12 w-12"
                  : "h-14 w-14"
              }`}
              style={{
                ...scrollTopButtonStyle,
                backgroundColor:
                  scrollTopButtonColor,
                borderColor: `${scrollTopIconColor}55`,
                color: scrollTopIconColor,
              }}
            >
              ↑
            </button>,
            document.body,
          )
        : null}

      {selectedItem &&
      typeof document !== "undefined" ? (
        <MenuItemModal
          key={selectedItem.id}
          item={selectedItem}
          backgroundColor={backgroundColor}
          textColor={textColor}
          orderEnabled={orderingAvailable}
          onAddToOrder={handleAddToOrder}
          onClose={() =>
            setSelectedItem(null)
          }
        />
      ) : null}
    </div>
  );
}