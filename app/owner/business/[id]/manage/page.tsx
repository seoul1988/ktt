import Link from "next/link";
import { notFound } from "next/navigation";
import { requireBusinessManagementAccess } from "@/lib/requireBusinessManagementAccess";

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
   * 로그인 여부, 오너 연결 여부,
   * website_enabled 상태를 서버에서 모두 확인합니다.
   *
   * 관리자는 website_enabled 상태와 관계없이 접근할 수 있고,
   * 일반 오너는 자신에게 연결된 비즈니스이면서
   * 관리자가 사이트를 활성화한 경우에만 접근할 수 있습니다.
   */
  const access =
    await requireBusinessManagementAccess(
      businessId,
    );

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

          <div className="mt-4 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <p className="text-sm font-black uppercase tracking-[0.16em] text-[#B64032]">
                  Business #{businessId}
                </p>

                <span className="rounded-full bg-green-100 px-2.5 py-1 text-[11px] font-black text-green-700">
                  사이트 관리 활성화
                </span>
              </div>

              <h1 className="mt-2 text-3xl font-black text-[#172033]">
                비즈니스 사이트 관리
              </h1>

              <p className="mt-2 text-sm font-medium text-[#667085]">
                메뉴, 가격, 카테고리와 홈페이지를 관리합니다.
              </p>
            </div>

            <Link
              href={`/business/${businessId}`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex h-11 items-center justify-center rounded-xl border border-[#D9CFC2] bg-white px-5 text-sm font-black text-[#172033] shadow-sm"
            >
              공개 페이지 보기
            </Link>
          </div>
        </div>

        <section className="grid gap-4 sm:grid-cols-2">
          <ManagementCard
            href={`/owner/business/${businessId}/categories`}
            icon="📂"
            title="카테고리 관리"
            description="Burgers, Drinks, Lunch 등 메뉴 카테고리를 추가하고 순서를 변경합니다."
          />

          <ManagementCard
            href={`/owner/business/${businessId}/items`}
            icon="🍔"
            title="품목 및 가격 관리"
            description="메뉴 이름, 설명, 이미지, 가격과 판매 상태를 관리합니다."
          />

          <ManagementCard
            href={`/owner/business/${businessId}/menu`}
            icon="📋"
            title="전체 메뉴 관리"
            description="카테고리별 메뉴 품목과 가격을 한 화면에서 빠르게 수정합니다."
          />

          <ManagementCard
            href={`/admin/businesses/${businessId}/website`}
            icon="🖥️"
            title="웹사이트 디자인"
            description="홈페이지 레이어, 이미지, 버튼, 메뉴와 모바일 디자인을 편집합니다."
          />
        </section>

        <section className="mt-6 rounded-3xl border border-[#E9DED0] bg-white p-5 shadow-sm">
          <h2 className="text-lg font-black text-[#172033]">
            빠른 작업
          </h2>

          <div className="mt-4 flex flex-wrap gap-3">
            <Link
              href={`/owner/business/${businessId}/categories/new`}
              className="rounded-xl bg-[#172033] px-4 py-3 text-sm font-black text-white"
            >
              + 카테고리 추가
            </Link>

            <Link
              href={`/owner/business/${businessId}/items/new`}
              className="rounded-xl bg-[#B64032] px-4 py-3 text-sm font-black text-white"
            >
              + 메뉴 품목 추가
            </Link>

            <Link
              href={`/admin/businesses/${businessId}/website`}
              className="rounded-xl border border-[#D9CFC2] bg-white px-4 py-3 text-sm font-black text-[#172033]"
            >
              웹사이트 편집
            </Link>
          </div>
        </section>
      </div>
    </main>
  );
}
