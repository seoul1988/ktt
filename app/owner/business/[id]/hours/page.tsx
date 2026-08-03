import "server-only";

import Link from "next/link";
import {
  unstable_noStore as noStore,
} from "next/cache";
import { notFound } from "next/navigation";

import CommunityBottomNav from "@/app/components/CommunityBottomNav";
import ProfileButton from "@/app/components/ProfileButton";
import { requireBusinessManagementAccess } from "@/lib/requireBusinessManagementAccess";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

import BusinessHoursEditor from "./BusinessHoursEditor";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;
export const fetchCache = "force-no-store";

type PageProps = {
  params: Promise<{
    id: string;
  }>;
};

export default async function BusinessHoursPage({
  params,
}: PageProps) {
  noStore();

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

  const {
    data: business,
    error: businessError,
  } = await supabaseAdmin
    .from("businesses")
    .select("id, name, hours")
    .eq("id", businessId)
    .maybeSingle();

  if (businessError) {
    throw new Error(
      `비즈니스 영업시간 조회 실패: ${businessError.message}`,
    );
  }

  if (!business) {
    notFound();
  }

  const businessName =
    typeof business.name === "string" &&
    business.name.trim()
      ? business.name.trim()
      : `Business #${businessId}`;

  return (
    <>
      <main className="min-h-screen bg-[#F8F5F0] px-4 pb-28 pt-6 sm:px-6 sm:pt-8">
        <div className="mx-auto max-w-4xl">
          <div className="mb-5 flex items-center justify-between gap-4">
            <Link
              href={`/owner/business/${businessId}/manage`}
              className="text-sm font-black text-[#B64032]"
            >
              ← 사이트 관리
            </Link>

            <ProfileButton />
          </div>

          <div className="mb-6 rounded-3xl border border-[#E9DED0] bg-white p-5 shadow-sm sm:p-7">
            <div className="flex flex-wrap items-center gap-2">
              <p className="text-sm font-black uppercase tracking-[0.16em] text-[#B64032]">
                Business #{businessId}
              </p>

              <span className="rounded-full bg-green-100 px-2.5 py-1 text-[11px] font-black text-green-700">
                영업시간 관리
              </span>

              {access.isAdmin && (
                <span className="rounded-full bg-blue-100 px-2.5 py-1 text-[11px] font-black text-blue-700">
                  관리자
                </span>
              )}
            </div>

            <h1 className="mt-2 text-3xl font-black text-[#172033]">
              Business Hours 관리
            </h1>

            <p className="mt-2 text-sm font-medium leading-6 text-[#667085]">
              {businessName}에 현재 저장된
              영업시간을 불러왔습니다. 시간을 수정하거나
              Google 영업시간을 가져온 후 저장하세요.
            </p>
          </div>

          <BusinessHoursEditor
            key={businessId}
            businessId={businessId}
            initialHours={
              business.hours ?? null
            }
          />
        </div>
      </main>

      <CommunityBottomNav />
    </>
  );
}