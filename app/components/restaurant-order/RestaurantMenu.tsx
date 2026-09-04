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

  // TEMP TEST: 실제 80mm 영수증처럼 보이는 출력 미리보기
  const [receiptPreviewOpen, setReceiptPreviewOpen] = useState(false);

  const [showScrollTop, setShowScrollTop] = useState(false);
  const [scrollTopButtonStyle, setScrollTopButtonStyle] =
    useState<CSSProperties>({});
  const rootRef = useRef<HTMLDivElement>(null);
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

    window.addEventListener("restaurant-order-cart-updated", syncCart as EventListener);
    window.addEventListener("storage", syncStorage);

    return () => {
      window.removeEventListener("restaurant-order-cart-updated", syncCart as EventListener);
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

  function escapeReceiptHtml(value: unknown) {
    return String(value ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  function buildTestReceiptHtml() {
    const serviceLabel =
      activeService === "delivery" ? "DELIVERY" : "PICKUP";

    const itemRows = cartItems
      .map((item) => {
        const optionLines = getSelectedOptionLabels(item)
          .map(
            (label) =>
              `<div class="option">+ ${escapeReceiptHtml(label)}</div>`,
          )
          .join("");

        const noteLine = item.instructions
          ? `<div class="note">NOTE: ${escapeReceiptHtml(item.instructions)}</div>`
          : "";

        return `
          <div class="item">
            <div class="item-row">
              <span>${Math.max(1, Number(item.quantity) || 1)} x ${escapeReceiptHtml(item.name)}</span>
              <span>$${Math.max(0, Number(item.totalPrice) || 0).toFixed(2)}</span>
            </div>
            ${optionLines}
            ${noteLine}
          </div>
        `;
      })
      .join("");

    const now = new Date();

    return `<!doctype html>
<html>
<head>
<meta charset="utf-8" />
<title>Test Receipt</title>
<style>
  @page { size: 80mm auto; margin: 4mm; }
  * { box-sizing: border-box; }
  body {
    margin: 0;
    padding: 0;
    background: #fff;
    color: #000;
    font-family: "Courier New", monospace;
    font-size: 12px;
    line-height: 1.35;
  }
  .receipt {
    width: 72mm;
    margin: 0 auto;
  }
  .center { text-align: center; }
  .title { font-size: 18px; font-weight: 900; }
  .strong { font-weight: 900; }
  .dash {
    border-top: 1px dashed #000;
    margin: 8px 0;
  }
  .meta-row,
  .item-row,
  .total-row {
    display: flex;
    justify-content: space-between;
    gap: 10px;
  }
  .item { margin: 8px 0; }
  .item-row {
    font-size: 13px;
    font-weight: 900;
  }
  .option {
    margin-left: 18px;
    font-size: 11px;
  }
  .note {
    margin-left: 18px;
    margin-top: 2px;
    font-size: 11px;
    font-weight: 900;
  }
  .total-row {
    font-size: 16px;
    font-weight: 900;
  }
  .test {
    margin-top: 14px;
    border: 2px solid #000;
    padding: 5px;
    text-align: center;
    font-weight: 900;
  }
  .no-print {
    margin: 14px auto;
    width: 72mm;
    display: flex;
    gap: 8px;
  }
  .no-print button {
    flex: 1;
    padding: 10px 8px;
    border: 1px solid #000;
    background: #fff;
    font: 700 12px Arial, sans-serif;
    cursor: pointer;
  }
  @media print {
    .no-print { display: none !important; }
  }
</style>
</head>
<body>
  <div class="receipt">
    <div class="center title">KTOWN ORDER</div>
    <div class="center strong">BUSINESS #${businessId}</div>
    <div class="center">${serviceLabel}</div>

    <div class="dash"></div>

    <div class="meta-row">
      <span>DATE</span>
      <span>${escapeReceiptHtml(now.toLocaleDateString())}</span>
    </div>
    <div class="meta-row">
      <span>TIME</span>
      <span>${escapeReceiptHtml(now.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }))}</span>
    </div>

    <div class="dash"></div>

    ${itemRows || '<div class="center">NO ITEMS</div>'}

    <div class="dash"></div>

    <div class="total-row">
      <span>SUBTOTAL</span>
      <span>$${cartSubtotal.toFixed(2)}</span>
    </div>

    <div class="dash"></div>

    <div class="center">THANK YOU</div>
    <div class="test">TEST RECEIPT - NOT AN ORDER</div>
  </div>

  <div class="no-print">
    <button onclick="window.print()">PRINT</button>
    <button onclick="window.close()">CLOSE</button>
  </div>
</body>
</html>`;
  }

  function printTestReceipt() {
    const printWindow = window.open(
      "",
      "ktown-test-receipt",
      "width=420,height=760,scrollbars=yes",
    );

    if (!printWindow) {
      window.alert("팝업이 차단되었습니다. 브라우저에서 팝업을 허용해 주세요.");
      return;
    }

    printWindow.document.open();
    printWindow.document.write(buildTestReceiptHtml());
    printWindow.document.close();
    printWindow.focus();
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
      <div
        className="border-b border-black/10 px-3 py-3 sm:px-5"
        style={{ backgroundColor: "transparent" }}
      >
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div
            className="rounded-lg px-2 py-1"
            style={{ backgroundColor }}
          >
            <p className="text-[10px] font-black uppercase tracking-[0.18em] opacity-50">
              {orderingAvailable ? "ORDER ONLINE" : "MENU"}
            </p>
            <h2 className="mt-0.5 text-lg font-black tracking-tight">
              {activeService === "pickup"
                ? "Pickup Order"
                : activeService === "delivery"
                  ? "Delivery Order"
                  : "Menu"}
            </h2>
          </div>

          {(resolvedMenuEnabled || effectivePickupEnabled || effectiveDeliveryEnabled) ? (
            <div className="flex flex-wrap gap-2">
              {resolvedMenuEnabled ? (
                <button
                  type="button"
                  onClick={() => setActiveService("menu")}
                  className={`rounded-full border px-3 py-2 text-[11px] font-black ${
                    activeService === "menu"
                      ? "bg-gray-950 text-white"
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
                  className={`rounded-full border-2 px-4 py-2 text-[11px] font-black shadow-md transition-all ${
                    activeService === "pickup"
                      ? "border-amber-300 bg-amber-400 text-black ring-2 ring-amber-200"
                      : "border-amber-400 bg-amber-100 text-amber-950 hover:bg-amber-200"
                  }`}
                >
                  PICKUP ONLY
                </button>
              ) : null}

              {effectiveDeliveryEnabled ? (
                <button
                  type="button"
                  onClick={() => setActiveService("delivery")}
                  className={`rounded-full border-2 px-4 py-2 text-[11px] font-black shadow-md transition-all ${
                    activeService === "delivery"
                      ? "border-blue-400 bg-blue-600 text-white ring-2 ring-blue-300"
                      : "border-blue-500 bg-blue-100 text-blue-950 hover:bg-blue-200"
                  }`}
                >
                  DELIVERY ONLY
                </button>
              ) : null}
            </div>
          ) : null}
        </div>
      </div>

      {visibleCategories.length ? (
        <div
          className="sticky top-0 z-20 border-b border-black/10 px-3 py-3"
          style={{
            backgroundColor: "transparent",
          }}
        >
          <div className="flex gap-2 overflow-x-auto">
            {visibleCategories.map((category) => (
              <button
                key={category.id}
                type="button"
                onClick={() =>
                  scrollToCategory(category.id)
                }
                className={`shrink-0 rounded-full border px-3 py-2 text-xs font-black ${
                  activeCategoryId === category.id
                    ? "bg-gray-950 text-white"
                    : "bg-white text-gray-900"
                }`}
              >
                {category.name}
              </button>
            ))}
          </div>
        </div>
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
              className="scroll-mt-[90px] border-b border-gray-200 pb-7 pt-2 last:border-b-0"
            >
              <h2
                className="mb-4 inline-block rounded-lg px-2 py-1 text-xl font-black tracking-tight sm:text-2xl"
                style={{ backgroundColor }}
              >
                {category.name}
              </h2>

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
                      className="group flex min-h-[118px] w-full overflow-hidden rounded-xl border text-left shadow-sm transition hover:shadow-md"
                      style={{
                        backgroundColor,
                        borderColor: `${textColor}22`,
                        color: textColor,
                      }}
                    >
                      <div className="min-w-0 flex-1 p-4">
                        <div className="flex items-start justify-between gap-3">
                          <h3 className="line-clamp-2 text-[15px] font-black leading-snug sm:text-base">
                            {item.name}
                          </h3>

                          {getPriceForService(item, activeService) != null ? (
                            <span className="shrink-0 text-sm font-black">
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

      {orderingAvailable && typeof document !== "undefined"
        ? createPortal(
            <>
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

              {cartOpen ? (
                <div
                  className="fixed inset-0 z-[12600] flex items-end justify-center bg-black/60 sm:items-center sm:p-4"
                  onClick={() => setCartOpen(false)}
                >
                  <div
                    className="flex max-h-[88vh] w-full flex-col rounded-t-3xl bg-white text-gray-950 shadow-2xl sm:max-w-lg sm:rounded-3xl"
                    onClick={(event) => event.stopPropagation()}
                  >
                    <div className="flex items-center justify-between border-b border-gray-200 px-5 py-4">
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

                    <div className="min-h-0 flex-1 overflow-y-auto px-4 py-3 sm:px-5">
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

                    <div className="border-t border-gray-200 px-5 pb-[max(20px,env(safe-area-inset-bottom))] pt-4">
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
                            className="rounded-xl border border-gray-300 px-4 py-3 text-xs font-black"
                          >
                            CLEAR
                          </button>
                        ) : <span />}
                        <button
                          type="button"
                          onClick={() => setCartOpen(false)}
                          className="rounded-xl border border-gray-300 px-4 py-3 text-xs font-black"
                        >
                          CONTINUE ORDERING
                        </button>
                        {cartItems.length ? (
                          <button
                            type="button"
                            onClick={() => {
                              setCartOpen(false);
                              setReceiptPreviewOpen(true);
                            }}
                            className="col-span-2 rounded-xl bg-gray-950 px-4 py-3 text-xs font-black text-white"
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

      {receiptPreviewOpen && typeof document !== "undefined"
        ? createPortal(
            <div
              className="fixed inset-0 z-[13000] flex items-end justify-center bg-black/70 p-0 sm:items-center sm:p-4"
              onClick={() => setReceiptPreviewOpen(false)}
            >
              <div
                className="flex max-h-[92vh] w-full max-w-[390px] flex-col overflow-hidden rounded-t-3xl bg-gray-100 shadow-2xl sm:rounded-3xl"
                onClick={(event) => event.stopPropagation()}
              >
                <div className="flex items-center justify-between border-b border-gray-200 bg-white px-4 py-3">
                  <div>
                    <p className="text-[10px] font-black uppercase tracking-[0.16em] text-red-600">
                      TEST ONLY
                    </p>
                    <h3 className="text-base font-black text-gray-950">
                      80mm Receipt Preview
                    </h3>
                  </div>
                  <button
                    type="button"
                    onClick={() => setReceiptPreviewOpen(false)}
                    className="flex h-9 w-9 items-center justify-center rounded-full bg-gray-100 text-lg font-black text-gray-950"
                    aria-label="Close receipt preview"
                  >
                    ×
                  </button>
                </div>

                <div className="min-h-0 flex-1 overflow-y-auto p-4">
                  <div
                    className="mx-auto bg-white px-4 py-5 text-black shadow"
                    style={{
                      width: "302px",
                      fontFamily: '"Courier New", monospace',
                      fontSize: "12px",
                      lineHeight: 1.35,
                    }}
                  >
                    <div className="text-center text-[18px] font-black">
                      KTOWN ORDER
                    </div>
                    <div className="text-center font-black">
                      BUSINESS #{businessId}
                    </div>
                    <div className="text-center font-black">
                      {activeService === "delivery" ? "DELIVERY" : "PICKUP"}
                    </div>

                    <div className="my-2 border-t border-dashed border-black" />

                    <div className="flex justify-between gap-2">
                      <span>DATE</span>
                      <span>{new Date().toLocaleDateString()}</span>
                    </div>
                    <div className="flex justify-between gap-2">
                      <span>TIME</span>
                      <span>
                        {new Date().toLocaleTimeString([], {
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </span>
                    </div>

                    <div className="my-2 border-t border-dashed border-black" />

                    {cartItems.map((item) => {
                      const selectedOptions = getSelectedOptionLabels(item);

                      return (
                        <div key={item.cartItemId} className="my-2">
                          <div className="flex items-start justify-between gap-2 text-[13px] font-black">
                            <span className="min-w-0">
                              {Math.max(1, Number(item.quantity) || 1)} x{" "}
                              {item.name}
                            </span>
                            <span className="shrink-0">
                              $
                              {Math.max(
                                0,
                                Number(item.totalPrice) || 0,
                              ).toFixed(2)}
                            </span>
                          </div>

                          {selectedOptions.map((label, optionIndex) => (
                            <div
                              key={`${item.cartItemId}-option-${optionIndex}`}
                              className="ml-[18px] text-[11px]"
                            >
                              + {label}
                            </div>
                          ))}

                          {item.instructions ? (
                            <div className="ml-[18px] mt-0.5 text-[11px] font-black">
                              NOTE: {item.instructions}
                            </div>
                          ) : null}
                        </div>
                      );
                    })}

                    <div className="my-2 border-t border-dashed border-black" />

                    <div className="flex items-center justify-between text-[16px] font-black">
                      <span>SUBTOTAL</span>
                      <span>${cartSubtotal.toFixed(2)}</span>
                    </div>

                    <div className="my-2 border-t border-dashed border-black" />

                    <div className="text-center">THANK YOU</div>
                    <div className="mt-3 border-2 border-black p-1.5 text-center font-black">
                      TEST RECEIPT - NOT AN ORDER
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2 border-t border-gray-200 bg-white px-4 pb-[max(16px,env(safe-area-inset-bottom))] pt-3">
                  <button
                    type="button"
                    onClick={() => setReceiptPreviewOpen(false)}
                    className="rounded-xl border border-gray-300 px-4 py-3 text-xs font-black text-gray-950"
                  >
                    CLOSE
                  </button>
                  <button
                    type="button"
                    onClick={printTestReceipt}
                    className="rounded-xl bg-gray-950 px-4 py-3 text-xs font-black text-white"
                  >
                    PRINT TEST
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setReceiptPreviewOpen(false);
                      setCheckoutOpen(true);
                    }}
                    className="col-span-2 rounded-xl border-2 border-gray-950 bg-white px-4 py-3 text-xs font-black text-gray-950"
                  >
                    CONTINUE TO REAL CHECKOUT
                  </button>
                </div>
              </div>
            </div>,
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
          onOrderPlaced={() => { clearCart(); setCheckoutOpen(false); }}
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