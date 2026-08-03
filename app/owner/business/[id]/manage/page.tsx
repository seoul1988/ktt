import "server-only";

import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@supabase/supabase-js";

import { requireBusinessManagementAccess } from "@/lib/requireBusinessManagementAccess";

import BusinessSwitcher, {
  type ManageableBusiness,
} from "./BusinessSwitcher";

type PageProps = {
  params: Promise<{
    id: string;
  }>;
};

type ManagementCardProps = {
  href: string;
  icon: string;
  title: string;
  description: string;
};

type BusinessRow = {
  id: number;
  name: string | null;
};

function getServerSupabase() {
  const supabaseUrl =
    process.env.NEXT_PUBLIC_SUPABASE_URL;

  const serviceRoleKey =
    process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl) {
    throw new Error(
      "NEXT_PUBLIC_SUPABASE_URL 환경변수가 없습니다.",
    );
  }

  if (!serviceRoleKey) {
    throw new Error(
      "SUPABASE_SERVICE_ROLE_KEY 환경변수가 없습니다.",
    );
  }

  return createClient(
    supabaseUrl,
    serviceRoleKey,
    {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    },
  );
}

async function getManageableBusinesses({
  userId,
  isAdmin,
}: {
  userId: string;
  isAdmin: boolean;
}): Promise<ManageableBusiness[]> {
  const supabase = getServerSupabase();

  /*
   * 관리자는 등록된 모든 비즈니스를 볼 수 있습니다.
   */
  if (isAdmin) {
    const { data, error } = await supabase
      .from("businesses")
      .select("id, name")
      .order("name", {
        ascending: true,
        nullsFirst: false,
      });

    if (error) {
      console.error(
        "관리자 비즈니스 목록 조회 오류:",
        error,
      );

      return [];
    }

    return ((data ?? []) as BusinessRow[])
      .filter(
        (business) =>
          Number.isInteger(Number(business.id)) &&
          Number(business.id) > 0,
      )
      .map((business) => ({
        id: Number(business.id),
        name:
          business.name?.trim() ||
          `Business #${business.id}`,
      }));
  }

  /*
   * 일반 오너는 business_owners에서 approved 상태인
   * 비즈니스만 선택할 수 있습니다.
   */
  const {
    data: ownershipRows,
    error: ownershipError,
  } = await supabase
    .from("business_owners")
    .select("business_id")
    .eq("user_id", userId)
    .eq("status", "approved");

  if (ownershipError) {
    console.error(
      "오너 비즈니스 권한 조회 오류:",
      ownershipError,
    );

    return [];
  }

  const businessIds = Array.from(
    new Set(
      (ownershipRows ?? [])
        .map((row) => Number(row.business_id))
        .filter(
          (businessId) =>
            Number.isInteger(businessId) &&
            businessId > 0,
        ),
    ),
  );

  if (businessIds.length === 0) {
    return [];
  }

  const { data, error } = await supabase
    .from("businesses")
    .select("id, name")
    .in("id", businessIds)
    .order("name", {
      ascending: true,
      nullsFirst: false,
    });

  if (error) {
    console.error(
      "오너 비즈니스 목록 조회 오류:",
      error,
    );

    return [];
  }

  return ((data ?? []) as BusinessRow[])
    .filter(
      (business) =>
        Number.isInteger(Number(business.id)) &&
        Number(business.id) > 0,
    )
    .map((business) => ({
      id: Number(business.id),
      name:
        business.name?.trim() ||
        `Business #${business.id}`,
    }));
}

async function getCurrentBusinessName(
  businessId: number,
): Promise<string> {
  const supabase = getServerSupabase();

  const { data, error } = await supabase
    .from("businesses")
    .select("name")
    .eq("id", businessId)
    .maybeSingle();

  if (error) {
    console.error(
      "현재 비즈니스 이름 조회 오류:",
      error,
    );
  }

  return (
    data?.name?.trim() ||
    `Business #${businessId}`
  );
}

function ManagementCard({
  href,
  icon,
  title,
  description,
}: ManagementCardProps) {
  return (
    <Link
      href={href}
      className="group rounded-3xl border border-[#E9DED0] bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:border-[#D9C6B0] hover:shadow-md"
    >
      <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-[#FFF4E5] text-2xl">
        {icon}
      </div>

      <div className="text-lg font-black text-[#172033]">
        {title}
      </div>

      <p className="mt-2 text-sm font-medium leading-6 text-[#667085]">
        {description}
      </p>

      <div className="mt-4 text-sm font-black text-[#B64032]">
        관리하기 →
      </div>
    </Link>
  );
}

export default async function BusinessManagePage({
  params,
}: PageProps) {
  const { id } = await params;
  const businessId = Number(id);

  if (
    !Number.isInteger(businessId) ||
    businessId <= 0
  ) {
    notFound();
  }

  /*
   * 현재 선택된 비즈니스에 실제 접근 권한이 있는지
   * 먼저 검사합니다.
   */
  const access =
    await requireBusinessManagementAccess(
      businessId,
    );

  const [businesses, currentBusinessName] =
    await Promise.all([
      getManageableBusinesses({
        userId: access.userId,
        isAdmin: access.isAdmin,
      }),
      getCurrentBusinessName(businessId),
    ]);

  /*
   * 목록 조회 문제로 현재 비즈니스가 빠져 있더라도
   * 현재 페이지를 사용할 수 있도록 목록에 추가합니다.
   */
  const hasCurrentBusiness = businesses.some(
    (business) => business.id === businessId,
  );

  const availableBusinesses =
    hasCurrentBusiness
      ? businesses
      : [
          {
            id: businessId,
            name: currentBusinessName,
          },
          ...businesses,
        ];

  return (
    <main className="min-h-screen bg-[#F8F5F0] px-4 py-8 sm:px-6">
      <div className="mx-auto max-w-5xl">
        <div className="mb-7">
          <Link
            href={
              access.isAdmin
                ? "/admin/businesses"
                : "/owner/business"
            }
            className="text-sm font-black text-[#B64032]"
          >
            ←{" "}
            {access.isAdmin
              ? "비즈니스 목록"
              : "내 비즈니스"}
          </Link>

          <div className="mt-4 flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <p className="text-sm font-black uppercase tracking-[0.16em] text-[#B64032]">
                  Business #{businessId}
                </p>

                <span className="rounded-full bg-green-100 px-2.5 py-1 text-[11px] font-black text-green-700">
                  사이트 관리 활성화
                </span>

                {access.isAdmin && (
                  <span className="rounded-full bg-blue-100 px-2.5 py-1 text-[11px] font-black text-blue-700">
                    관리자
                  </span>
                )}
              </div>

              <h1 className="mt-2 truncate text-3xl font-black text-[#172033]">
                {currentBusinessName}
              </h1>

              <p className="mt-2 text-sm font-medium text-[#667085]">
                메뉴, 배너와 홈페이지를
                관리합니다.
              </p>
            </div>

            <div className="flex w-full flex-col gap-3 lg:w-[340px]">
              <BusinessSwitcher
                currentBusinessId={businessId}
                businesses={
                  availableBusinesses
                }
              />

              <Link
                href={`/business/${businessId}`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex h-11 items-center justify-center rounded-xl border border-[#D9CFC2] bg-white px-5 text-sm font-black text-[#172033] shadow-sm transition hover:border-[#B64032]"
              >
                공개 페이지 보기
              </Link>
            </div>
          </div>
        </div>

        {availableBusinesses.length > 1 && (
          <div className="mb-5 rounded-2xl border border-[#E9DED0] bg-[#FFF9F1] px-4 py-3 text-sm font-bold text-[#667085]">
            현재{" "}
            <span className="font-black text-[#172033]">
              {currentBusinessName}
            </span>
            을 관리하고 있습니다. 위의 비즈니스
            선택 메뉴에서 다른 비즈니스로 변경할 수
            있습니다.
          </div>
        )}

        <section className="grid gap-4 sm:grid-cols-2">
          <ManagementCard
            href={`/owner/business/${businessId}/menu`}
            icon="📋"
            title="전체 메뉴 관리"
            description="카테고리, 메뉴 품목, 설명, 가격, 이미지, 순서와 판매 상태를 한 화면에서 관리합니다."
          />

          <ManagementCard
            href={`/owner/business/${businessId}/banners`}
            icon="📣"
            title="배너 관리"
            description="공지바, 할인행사, 쿠폰, 이미지형, 팝업 등 준비된 배너 종류를 선택해 등록하고 노출합니다."
          />

          <ManagementCard
            href={`/admin/businesses/${businessId}/website`}
            icon="🖥️"
            title="웹사이트 디자인"
            description="홈페이지 레이어, 이미지, 버튼, 메뉴와 모바일 디자인을 편집합니다."
          />
        </section>
      </div>
    </main>
  );
}