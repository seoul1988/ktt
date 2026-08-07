"use client";

import type { CSSProperties } from "react";
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import MenuItemModal from "./MenuItemModal";
import type { MenuOrderDraft } from "./MenuItemModal";
import type { RestaurantMenuItem, RestaurantMenuPayload } from "./types";

type Props = {
  businessId: number;
  compact?: boolean;
  backgroundColor?: string;
  textColor?: string;
  scrollTopEnabled?: boolean;
  scrollTopButtonColor?: string;
  scrollTopIconColor?: string;
  scrollTopPosition?: "right" | "left";

  // false = MENU(보기 전용), true = ORDER(주문 가능)
  orderEnabled?: boolean;
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
    function update() {
      const root = rootRef.current;
      if (!root) return;

      const rect = root.getBoundingClientRect();

      setShowScrollTop(rect.top < -240);

      setScrollTopButtonStyle({
        bottom: compact ? 82 : 28,
        [scrollTopPosition]: compact ? 14 : 28,
      });
    }

    update();

    window.addEventListener("scroll", update, {
      passive: true,
    });
    window.addEventListener("resize", update);

    return () => {
      window.removeEventListener("scroll", update);
      window.removeEventListener("resize", update);
    };
  }, [compact, scrollTopPosition]);

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
    // MENU 페이지에서는 절대로 장바구니에 저장하지 않음
    if (!orderEnabled) return;

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
                        setSelectedItem(item)
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

                          {item.price != null ? (
                            <span className="shrink-0 text-sm font-black">
                              $
                              {Number(
                                item.price,
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
                        <img
                          src={
                            item.thumbnail_url ||
                            item.image_url ||
                            ""
                          }
                          alt={item.name}
                          className="m-2 h-[94px] w-[94px] shrink-0 rounded-xl object-cover sm:h-[116px] sm:w-[116px]"
                        />
                      ) : null}
                    </button>
                  );
                })}
              </div>
            </section>
          );
        })}
      </div>

      {scrollTopEnabled &&
      showScrollTop &&
      typeof document !== "undefined"
        ? createPortal(
            <button
              type="button"
              onClick={() =>
                rootRef.current?.scrollIntoView({
                  behavior: "smooth",
                  block: "start",
                })
              }
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
          orderEnabled={orderEnabled}
          onAddToOrder={handleAddToOrder}
          onClose={() =>
            setSelectedItem(null)
          }
        />
      ) : null}
    </div>
  );
}