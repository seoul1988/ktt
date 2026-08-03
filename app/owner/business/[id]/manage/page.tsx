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
                메뉴, 배너와 홈페이지를 관리합니다.
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
