import Link from "next/link";

import { createSupabaseServerClient } from "@/lib/supabaseServer";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { checkAdmin } from "@/lib/checkAdmin";

import CommunityBottomNav from "../../components/CommunityBottomNav";
import { deleteInquiry } from "./actions";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function CommunityInquiriesPage() {
  const supabase =
    await createSupabaseServerClient();

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError) {
    console.error(
      "로그인 확인 오류:",
      authError,
    );
  }

  const isAdmin = await checkAdmin();

  const queryClient = isAdmin
    ? supabaseAdmin
    : supabase;

  const { data: inquiries, error } =
    await queryClient
      .from("inquiries")
      .select(
        "id,title,user_id,visibility,status,created_at",
      )
      .order("created_at", {
        ascending: false,
      });

  if (error) {
    console.error(
      "문의 목록 불러오기 오류:",
      {
        message: error.message,
        details: error.details,
        hint: error.hint,
        code: error.code,
      },
    );
  }

  const inquiryWriteHref = user
    ? "/community/inquiries/new"
    : "/login?redirect=/community/inquiries/new";

  return (
    <>
      <main className="min-h-screen bg-[#F8F3EC] px-4 py-6 pb-28 sm:px-6">
        <div className="mx-auto w-full max-w-2xl">
          {/* 상단 */}
          <div className="relative mb-5 flex min-h-10 items-center justify-center">
            <Link
              href="/community"
              className="absolute left-0 inline-flex items-center text-sm font-bold text-[#172033]"
            >
              ← Back
            </Link>

            <h1 className="text-2xl font-black text-[#172033]">
              문의 게시판
            </h1>

            <Link
              href={inquiryWriteHref}
              className="absolute right-0 rounded-full bg-[#172033] px-4 py-2 text-sm font-bold text-white transition hover:bg-[#26334d]"
            >
              문의하기
            </Link>
          </div>

          {/* 비로그인 안내 */}
          {!user && (
            <div className="mb-4 rounded-2xl border border-orange-200 bg-orange-50 p-4">
              <p className="text-sm font-bold leading-6 text-orange-700">
                로그인하면 본인이 작성한 비밀 문의도
                확인할 수 있습니다.
              </p>

              <Link
                href="/login?redirect=/community/inquiries"
                className="mt-2 inline-block text-sm font-black text-[#172033] underline underline-offset-4"
              >
                로그인하기
              </Link>
            </div>
          )}

          {/* 관리자 표시 */}
          {isAdmin && (
            <div className="mb-4 flex items-center justify-between rounded-2xl border border-blue-200 bg-blue-50 px-4 py-3">
              <span className="text-sm font-bold text-blue-800">
                관리자 모드
              </span>

              <span className="text-xs font-bold text-blue-600">
                모든 문의 확인 가능
              </span>
            </div>
          )}

          {/* 문의 목록 */}
          <div className="space-y-3">
            {inquiries && inquiries.length > 0 ? (
              inquiries.map((item) => {
                const isOwner =
                  Boolean(user?.id) &&
                  item.user_id === user?.id;

                const canSeePrivateTitle =
                  isAdmin || isOwner;

                const displayTitle =
                  item.visibility === "private" &&
                  !canSeePrivateTitle
                    ? "비밀 문의입니다"
                    : item.title ||
                      "제목 없는 문의";

                return (
                  <article
                    key={item.id}
                    className="rounded-2xl bg-white p-4 shadow-sm transition hover:shadow-md sm:p-5"
                  >
                    <div className="mb-2 flex items-center justify-between gap-3">
                      <span className="text-xs font-bold text-gray-500">
                        {item.visibility === "private"
                          ? "🔒 비밀 문의"
                          : "오픈 문의"}
                      </span>

                      <div className="flex shrink-0 items-center gap-2">
                        <span
                          className={`text-xs font-bold ${
                            item.status === "answered"
                              ? "text-green-600"
                              : "text-orange-500"
                          }`}
                        >
                          {item.status === "answered"
                            ? "답변완료"
                            : "답변대기"}
                        </span>

                        {isAdmin && (
                          <form action={deleteInquiry}>
                            <input
                              type="hidden"
                              name="id"
                              value={String(item.id)}
                            />

                            <button
                              type="submit"
                              className="rounded-md border border-red-200 bg-red-50 px-2 py-1 text-[10px] font-bold text-red-600 transition hover:bg-red-500 hover:text-white"
                            >
                              삭제
                            </button>
                          </form>
                        )}
                      </div>
                    </div>

                    <Link
                      href={`/community/inquiries/${item.id}`}
                      className="block"
                    >
                      <h2 className="break-words text-lg font-black leading-6 text-[#172033]">
                        {displayTitle}
                      </h2>

                      <div className="mt-3 flex items-center justify-between gap-3 text-sm text-gray-500">
                        <span className="min-w-0 truncate font-medium">
                          익명 #
                          {item.user_id
                            ? item.user_id
                                .slice(-4)
                                .toUpperCase()
                            : "0000"}
                        </span>

                        <span className="shrink-0 text-xs text-gray-400">
                          {item.created_at
                            ? new Date(
                                item.created_at,
                              ).toLocaleDateString(
                                "ko-KR",
                                {
                                  year: "numeric",
                                  month: "2-digit",
                                  day: "2-digit",
                                },
                              )
                            : ""}
                        </span>
                      </div>
                    </Link>
                  </article>
                );
              })
            ) : (
              <div className="rounded-2xl bg-white p-8 text-center shadow-sm">
                <p className="text-sm font-bold text-gray-500">
                  등록된 문의가 없습니다.
                </p>
              </div>
            )}
          </div>
        </div>
      </main>

      <CommunityBottomNav activeNav="ads" />
    </>
  );
}