"use client";

import type { CSSProperties } from "react";
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import MenuItemModal from "./MenuItemModal";
import type { MenuOrderDraft } from "./MenuItemModal";
import type { RestaurantMenuItem, RestaurantMenuPayload } from "./types";

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

type DeliveryProvider = {
  id: number;
  provider_key: string;
  name: string;
  url: string;
  display_order: number;
};

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
  const [showScrollTop, setShowScrollTop] = useState(false);
  const [scrollTopButtonStyle, setScrollTopButtonStyle] =
    useState<CSSProperties>({});
  const rootRef = useRef<HTMLDivElement>(null);

  const hasOrderModes = pickupEnabled || deliveryEnabled || orderEnabled;
  const effectivePickupEnabled =
    pickupEnabled || (orderEnabled && !pickupEnabled && !deliveryEnabled);
  const effectiveDeliveryEnabled = deliveryEnabled;

  const getInitialService = (): "menu" | "pickup" | "delivery" => {
    if (typeof window !== "undefined") {
      const requested = new URLSearchParams(window.location.search).get("service");
      if (requested === "menu" && menuEnabled) return "menu";
      if (requested === "pickup" && effectivePickupEnabled) return "pickup";
      if (requested === "delivery" && effectiveDeliveryEnabled) return "delivery";
    }

    if (menuEnabled && !hasOrderModes) return "menu";
    if (!menuEnabled && effectivePickupEnabled) return "pickup";
    if (!menuEnabled && effectiveDeliveryEnabled) return "delivery";
    if (menuEnabled) return "menu";
    if (effectivePickupEnabled) return "pickup";
    return "delivery";
  };

  const [activeService, setActiveService] =
    useState<"menu" | "pickup" | "delivery">(getInitialService);

  const activeOrderEnabled =
    activeService === "pickup" || activeService === "delivery";

  useEffect(() => {
    // 서비스 변경 후 기존 가격으로 열린 모달이 남지 않게 닫습니다.
    setSelectedItem(null);
  }, [activeService]);

  useEffect(() => {
    // 페이지 설정이 바뀌어 현재 선택 방식이 더 이상 허용되지 않으면
    // 가능한 첫 방식으로 자동 전환합니다.
    if (activeService === "menu" && menuEnabled) return;
    if (activeService === "pickup" && effectivePickupEnabled) return;
    if (activeService === "delivery" && effectiveDeliveryEnabled) return;

    if (menuEnabled) {
      setActiveService("menu");
    } else if (effectivePickupEnabled) {
      setActiveService("pickup");
    } else if (effectiveDeliveryEnabled) {
      setActiveService("delivery");
    }
  }, [
    activeService,
    menuEnabled,
    effectivePickupEnabled,
    effectiveDeliveryEnabled,
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

  useEffect(() => {
    let cancelled = false;

    async function loadDeliveryProviders() {
      try {
        const response = await fetch(
          `/api/businesses/${encodeURIComponent(
            businessId,
          )}/delivery-providers`,
          { cache: "no-store" },
        );

        const payload = await response.json();

        if (!response.ok) {
          throw new Error(
            payload?.error || "배달 업체를 불러오지 못했습니다.",
          );
        }

        if (!cancelled) {
          setDeliveryProviders(
            Array.isArray(payload?.providers)
              ? payload.providers
              : [],
          );
        }
      } catch {
        if (!cancelled) {
          setDeliveryProviders([]);
        }
      }
    }

    void loadDeliveryProviders();

    return () => {
      cancelled = true;
    };
  }, [businessId]);

  function openDeliveryProviders() {
    setActiveService("delivery");
    setSelectedItem(null);
    setDeliveryProviderOpen(true);
  }

  function openDeliveryProviderUrl(url: string) {
    const raw = String(url || "").trim();
    if (!raw) return;

    const href =
      /^https?:\/\//i.test(raw)
        ? raw
        : `https://${raw}`;

    window.open(href, "_blank", "noopener,noreferrer");
  }

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

  function handleAddToOrder(draft: MenuOrderDraft) {
    // MENU 보기에서는 절대로 장바구니에 저장하지 않음
    if (!activeOrderEnabled) return;

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
      fulfillmentType:
        activeService === "delivery"
          ? "delivery"
          : "pickup",
      addedAt: new Date().toISOString(),
    };

    writeStoredCart(
      businessId,
      [...currentCart, newCartItem],
    );

    setSelectedItem(null);
  }

  if (loading) {
    return (
      <div className="flex min-h-[260px] items-center justify-center text-sm font-black text-gray-500">
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
        backgroundColor,
        color: textColor,
      }}
    >
      <div
        className="border-b border-black/10 px-3 py-3 sm:px-5"
        style={{ backgroundColor }}
      >
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-[10px] font-black uppercase tracking-[0.18em] opacity-50">
              {activeOrderEnabled ? "ORDER ONLINE" : "MENU"}
            </p>
            <h2 className="mt-0.5 text-lg font-black tracking-tight">
              {activeService === "pickup"
                ? "Pickup Order"
                : activeService === "delivery"
                  ? "Delivery Order"
                  : "Menu"}
            </h2>
          </div>

          {(menuEnabled || effectivePickupEnabled || effectiveDeliveryEnabled) ? (
            <div className="flex flex-wrap gap-2">
              {menuEnabled ? (
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
                  className={`rounded-full border px-3 py-2 text-[11px] font-black ${
                    activeService === "pickup"
                      ? "bg-gray-950 text-white"
                      : "bg-white text-gray-900"
                  }`}
                >
                  PICKUP ONLY
                </button>
              ) : null}

              {effectiveDeliveryEnabled ? (
                <button
                  type="button"
                  onClick={openDeliveryProviders}
                  className={`rounded-full border px-3 py-2 text-[11px] font-black ${
                    activeService === "delivery"
                      ? "bg-gray-950 text-white"
                      : "bg-white text-gray-900"
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
          className="sticky top-0 z-20 border-b border-black/10 px-3 py-3 backdrop-blur"
          style={{
            backgroundColor,
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
              <h2 className="mb-4 text-xl font-black tracking-tight sm:text-2xl">
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
                      onClick={() =>
                        setSelectedItem(
                          withServicePrice(item, activeService),
                        )
                      }
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

                          {!menuEnabled && activeOrderEnabled ? (
                            <span
                              aria-hidden="true"
                              className="absolute bottom-2 right-2 flex h-9 w-9 items-center justify-center rounded-full border border-black/10 bg-white text-[24px] font-medium leading-none text-gray-950 shadow-md sm:h-10 sm:w-10"
                            >
                              +
                            </span>
                          ) : null}
                        </div>
                      ) : !menuEnabled && activeOrderEnabled ? (
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

      {deliveryProviderOpen &&
      typeof document !== "undefined"
        ? createPortal(
            <div
              className="fixed inset-0 z-[12500] flex items-center justify-center bg-black/60 p-4"
              onClick={() => setDeliveryProviderOpen(false)}
            >
              <div
                className="w-full max-w-md rounded-3xl bg-white p-5 shadow-2xl"
                onClick={(event) => event.stopPropagation()}
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-[10px] font-black uppercase tracking-[0.18em] text-gray-400">
                      Place order with:
                    </p>
                    <h3 className="mt-1 text-xl font-black text-gray-950">
                      배달 업체를 선택하세요
                    </h3>
                  </div>

                  <button
                    type="button"
                    onClick={() => setDeliveryProviderOpen(false)}
                    className="flex h-9 w-9 items-center justify-center rounded-full bg-gray-100 text-lg font-black"
                  >
                    ×
                  </button>
                </div>

                {deliveryProviders.length ? (
                  <div className="mt-4 space-y-2">
                    {deliveryProviders.map((provider) => (
                      <button
                        key={provider.id || provider.provider_key}
                        type="button"
                        onClick={() =>
                          openDeliveryProviderUrl(provider.url)
                        }
                        className="flex w-full items-center justify-between rounded-2xl border border-gray-200 bg-white px-4 py-3 text-left transition hover:border-gray-400 hover:bg-gray-50"
                      >
                        <span className="font-black text-gray-950">
                          {provider.name}
                        </span>
                        <span className="text-lg font-black text-gray-400">
                          ↗
                        </span>
                      </button>
                    ))}
                  </div>
                ) : (
                  <div className="mt-4 rounded-2xl bg-yellow-50 p-4 text-sm font-bold text-yellow-800">
                    현재 등록된 배달 주문 업체가 없습니다.
                  </div>
                )}
              </div>
            </div>,
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
          orderEnabled={activeOrderEnabled}
          onAddToOrder={handleAddToOrder}
          onClose={() =>
            setSelectedItem(null)
          }
        />
      ) : null}
    </div>
  );
}