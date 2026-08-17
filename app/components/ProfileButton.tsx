"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { supabase } from "../../lib/supabase";

type Profile = {
  role: string | null;
};

type ConnectedBusiness = {
  website_enabled: boolean | null;
};

type BusinessOwnerRow = {
  business_id: number;
  businesses:
    | ConnectedBusiness
    | ConnectedBusiness[]
    | null;
};

function timeout<T>(
  promise: PromiseLike<T>,
  ms = 10000,
): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    let settled = false;

    const timer = window.setTimeout(() => {
      if (settled) return;
      settled = true;
      reject(new Error("Request timeout"));
    }, ms);

    Promise.resolve(promise)
      .then((value) => {
        if (settled) return;
        settled = true;
        window.clearTimeout(timer);
        resolve(value);
      })
      .catch((error) => {
        if (settled) return;
        settled = true;
        window.clearTimeout(timer);
        reject(error);
      });
  });
}

export default function ProfileButton() {
  const [userId, setUserId] =
    useState<string | null>(null);

  const [role, setRole] =
    useState<string | null>(null);

  const [businessIds, setBusinessIds] =
    useState<number[]>([]);

  const [
    hasConnectedBusiness,
    setHasConnectedBusiness,
  ] = useState(false);

  const [open, setOpen] =
    useState(false);

  const [checking, setChecking] =
    useState(true);

  const menuRef =
    useRef<HTMLDivElement | null>(null);

  const loadingRef = useRef(false);
  const lastLoadedAtRef = useRef(0);
  const mountedRef = useRef(true);

  const isUser = role === "user";
  const isOwner = role === "owner";
  const isAdmin = role === "admin";

  const canManage =
    isOwner || isAdmin;

  const hasEnabledBusiness =
    businessIds.length > 0;

  const managementHref =
    businessIds.length === 1
      ? `/owner/business/${businessIds[0]}/manage`
      : "/owner/business";

  function resetBusinessState() {
    setBusinessIds([]);
    setHasConnectedBusiness(false);
  }

  async function loadBusinessIds(
    currentUserId: string,
    currentRole: string,
  ) {
    if (currentRole === "admin") {
      if (mountedRef.current) {
        resetBusinessState();
      }
      return;
    }

    try {
      const { data, error } =
        await timeout(
          supabase
            .from("business_owners")
            .select(`
              business_id,
              businesses (
                website_enabled
              )
            `)
            .eq(
              "user_id",
              currentUserId,
            ),
          10000,
        );

      if (error) {
        throw error;
      }

      if (!mountedRef.current) {
        return;
      }

      const rows =
        (data || []) as BusinessOwnerRow[];

      setHasConnectedBusiness(
        rows.length > 0,
      );

      const enabledBusinessIds =
        rows
          .filter((row) => {
            const business =
              Array.isArray(
                row.businesses,
              )
                ? row.businesses[0]
                : row.businesses;

            return (
              business?.website_enabled ===
              true
            );
          })
          .map((row) =>
            Number(row.business_id),
          )
          .filter(
            (id) =>
              Number.isFinite(id) &&
              id > 0,
          );

      setBusinessIds(
        Array.from(
          new Set(
            enabledBusinessIds,
          ),
        ),
      );
    } catch (error) {
      console.error(
        "Failed to load connected businesses:",
        error,
      );

      // 기존 상태를 유지합니다.
      // 일시적인 timeout 때문에 관리 메뉴가 사라지는 것을 방지합니다.
    }
  }

  async function loadUser(force = false) {
    const now = Date.now();

    if (loadingRef.current) {
      return;
    }

    if (
      !force &&
      now - lastLoadedAtRef.current < 3000
    ) {
      return;
    }

    loadingRef.current = true;

    try {
      if (mountedRef.current) {
        setChecking(true);
      }

      const sessionResult =
        await timeout(
          supabase.auth.getSession(),
          10000,
        );

      if (!mountedRef.current) {
        return;
      }

      const user =
        sessionResult.data.session
          ?.user || null;

      if (!user) {
        setUserId(null);
        setRole(null);
        resetBusinessState();
        setOpen(false);
        lastLoadedAtRef.current = Date.now();
        return;
      }

      setUserId(user.id);

      let loadedRole = role || "user";

      try {
        const { data, error } =
          await timeout(
            supabase
              .from("profiles")
              .select("role")
              .eq("id", user.id)
              .maybeSingle<Profile>(),
            10000,
          );

        if (error) {
          throw error;
        }

        if (!mountedRef.current) {
          return;
        }

        loadedRole =
          data?.role || "user";
      } catch (error) {
        console.error(
          "Failed to load profile:",
          error,
        );

        // 프로필 조회 timeout 시 기존 role을 유지합니다.
        // 기존 role이 없다면 user로만 fallback 합니다.
        loadedRole = role || "user";
      }

      if (!mountedRef.current) {
        return;
      }

      setRole(loadedRole);

      if (
        loadedRole === "owner" ||
        loadedRole === "admin"
      ) {
        await loadBusinessIds(
          user.id,
          loadedRole,
        );
      } else {
        resetBusinessState();
      }

      lastLoadedAtRef.current = Date.now();
    } catch (error) {
      console.error(
        "Failed to load user:",
        error,
      );

      // 중요:
      // timeout이나 일시적인 네트워크 오류만으로
      // 현재 로그인 상태를 강제로 지우지 않습니다.
    } finally {
      loadingRef.current = false;

      if (mountedRef.current) {
        setChecking(false);
      }
    }
  }

  useEffect(() => {
    mountedRef.current = true;

    void loadUser(true);

    const {
      data: { subscription },
    } =
      supabase.auth.onAuthStateChange(
        () => {
          void loadUser(true);
        },
      );

    const handleOnline = () => {
      void loadUser(true);
    };

    const handleFocus = () => {
      void loadUser(false);
    };

    const handlePageShow = () => {
      void loadUser(false);
    };

    window.addEventListener(
      "online",
      handleOnline,
    );

    window.addEventListener(
      "focus",
      handleFocus,
    );

    window.addEventListener(
      "pageshow",
      handlePageShow,
    );

    return () => {
      mountedRef.current = false;

      subscription.unsubscribe();

      window.removeEventListener(
        "online",
        handleOnline,
      );

      window.removeEventListener(
        "focus",
        handleFocus,
      );

      window.removeEventListener(
        "pageshow",
        handlePageShow,
      );
    };
  }, []);

  useEffect(() => {
    function handleClickOutside(
      event:
        | MouseEvent
        | TouchEvent,
    ) {
      if (!menuRef.current) {
        return;
      }

      if (
        !menuRef.current.contains(
          event.target as Node,
        )
      ) {
        setOpen(false);
      }
    }

    document.addEventListener(
      "mousedown",
      handleClickOutside,
    );

    document.addEventListener(
      "touchstart",
      handleClickOutside,
    );

    return () => {
      document.removeEventListener(
        "mousedown",
        handleClickOutside,
      );

      document.removeEventListener(
        "touchstart",
        handleClickOutside,
      );
    };
  }, []);

  async function logout() {
    try {
      await supabase.auth.signOut();
    } finally {
      setUserId(null);
      setRole(null);
      resetBusinessState();
      setOpen(false);

      window.location.href = "/";
    }
  }

  if (checking) {
    return (
      <div className="h-8 w-8 animate-pulse rounded-lg border border-[#E8DED1] bg-white" />
    );
  }

  if (!userId) {
    return (
      <Link
        href="/login"
        className="relative z-[99999] inline-flex h-8 items-center justify-center rounded-lg border border-[#E8DED1] bg-white px-3 text-xs font-black text-[#172033] shadow-sm"
      >
        Login
      </Link>
    );
  }

  return (
    <div
      ref={menuRef}
      className="relative z-[99999]"
    >
      <button
        type="button"
        onClick={(event) => {
          event.preventDefault();
          event.stopPropagation();

          setOpen(
            (current) =>
              !current,
          );
        }}
        className="relative z-[99999] flex h-8 w-8 items-center justify-center rounded-lg border border-[#E8DED1] bg-white text-[#172033] shadow-sm active:scale-95"
        aria-label="Open profile menu"
        aria-expanded={open}
      >
        <span className="flex flex-col items-center justify-center gap-[3px]">
          <span className="h-[2px] w-[14px] rounded-full bg-[#172033]" />
          <span className="h-[2px] w-[14px] rounded-full bg-[#172033]" />
          <span className="h-[2px] w-[14px] rounded-full bg-[#172033]" />
        </span>
      </button>

      {open && (
        <div className="absolute right-0 top-10 z-[999999] w-64 overflow-hidden rounded-2xl border border-[#E8DED1] bg-white text-sm font-bold text-[#172033] shadow-xl">
          <Link
            href="/profile"
            className="flex items-center justify-between px-4 py-3 hover:bg-[#F8F3EC]"
            onClick={() =>
              setOpen(false)
            }
          >
            <span>
              Edit Profile
            </span>

            {isUser && (
              <span className="rounded-full bg-[#FFF3C9] px-2.5 py-1 text-[11px] font-black text-[#C4483A]">
                🏪 오너 신청
              </span>
            )}
          </Link>

          <div className="border-t border-[#EFE5D8]" />

          <Link
            href="/my-coupons"
            className="block px-4 py-3 hover:bg-[#F8F3EC]"
            onClick={() =>
              setOpen(false)
            }
          >
            My Coupons
          </Link>

          {canManage && (
            <>
              <div className="border-t border-[#EFE5D8]" />

              {isAdmin ? (
                <Link
                  href="/admin/businesses"
                  className="flex items-center justify-between bg-[#FFF9EF] px-4 py-3 font-black text-[#B64032] hover:bg-[#FFF3DF]"
                  onClick={() =>
                    setOpen(false)
                  }
                >
                  <span>
                    ⚙️ 사이트 관리
                  </span>

                  <span>›</span>
                </Link>
              ) : hasEnabledBusiness ? (
                <Link
                  href={
                    managementHref
                  }
                  className="flex items-center justify-between bg-[#FFF9EF] px-4 py-3 font-black text-[#B64032] hover:bg-[#FFF3DF]"
                  onClick={() =>
                    setOpen(false)
                  }
                >
                  <span>
                    ⚙️ 사이트 관리
                  </span>

                  <span>›</span>
                </Link>
              ) : hasConnectedBusiness ? (
                <div className="bg-[#FFFBEB] px-4 py-3">
                  <div className="text-xs font-black text-[#A16207]">
                    🔒 사이트 관리 승인 대기 중
                  </div>

                  <div className="mt-1 text-[11px] font-bold leading-5 text-gray-500">
                    관리자가 사이트를 활성화하면
                    카테고리, 품목, 가격 및
                    웹사이트 관리 기능을 사용할 수
                    있습니다.
                  </div>
                </div>
              ) : (
                <div className="px-4 py-3 text-xs font-bold leading-5 text-gray-500">
                  연결된 비즈니스가 없습니다.
                </div>
              )}

              <Link
                href="/owner"
                className="block px-4 py-3 hover:bg-[#F8F3EC]"
                onClick={() =>
                  setOpen(false)
                }
              >
                My Business
              </Link>

              <Link
                href="/grand-opening/new"
                className="block px-4 py-3 hover:bg-[#F8F3EC]"
                onClick={() =>
                  setOpen(false)
                }
              >
                🎉 Grand Opening
              </Link>

              <Link
                href="/business/new"
                className="block px-4 py-3 hover:bg-[#F8F3EC]"
                onClick={() =>
                  setOpen(false)
                }
              >
                Register Business
              </Link>

              <Link
                href="/events/new"
                className="block px-4 py-3 hover:bg-[#F8F3EC]"
                onClick={() =>
                  setOpen(false)
                }
              >
                Create Event
              </Link>

              <Link
                href="/deals/new"
                className="block px-4 py-3 hover:bg-[#F8F3EC]"
                onClick={() =>
                  setOpen(false)
                }
              >
                Create Deal
              </Link>

              <Link
                href="/coupons/new"
                className="block px-4 py-3 hover:bg-[#F8F3EC]"
                onClick={() =>
                  setOpen(false)
                }
              >
                Register Coupon
              </Link>
            </>
          )}

          {isAdmin && (
            <>
              <div className="border-t border-[#EFE5D8]" />

              <Link
                href="/admin/owner-requests"
                className="block px-4 py-3 hover:bg-[#F8F3EC]"
                onClick={() =>
                  setOpen(false)
                }
              >
                Owner Requests
              </Link>

              <Link
                href="/admin/event-requests"
                className="block px-4 py-3 hover:bg-[#F8F3EC]"
                onClick={() =>
                  setOpen(false)
                }
              >
                Event Requests
              </Link>
            </>
          )}

          <div className="border-t border-[#EFE5D8]" />

          <button
            type="button"
            onClick={logout}
            className="block w-full px-4 py-3 text-left text-red-600 hover:bg-red-50"
          >
            Logout
          </button>
        </div>
      )}
    </div>
  );
}