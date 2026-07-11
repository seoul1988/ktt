import Link from "next/link";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";

import { createSupabaseServerClient } from "@/lib/supabaseServer";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import CommunityBottomNav from "../../../components/CommunityBottomNav";
import BackButton from "@/app/components/BackButton";

export const dynamic = "force-dynamic";
export const revalidate = 0;

/* 관리자 권한 확인 */
async function checkAdmin() {
  const cookieStore = await cookies();

  /* 기존 관리자 쿠키 확인 */
  const cookieRole =
    cookieStore.get("ktt_admin")?.value ||
    cookieStore.get("kacc_admin")?.value ||
    cookieStore.get("admin")?.value ||
    "";

  if (
    cookieRole === "admin" ||
    cookieRole === "super_admin"
  ) {
    return true;
  }

  /* Supabase 로그인 사용자 확인 */
  const supabase = await createSupabaseServerClient();

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError) {
    console.error(
      "관리자 확인 중 사용자 조회 오류:",
      userError,
    );

    return false;
  }

  if (!user) {
    return false;
  }

  /* profiles 테이블에서 관리자 권한 확인 */
  const { data: profile, error: profileError } =
    await supabaseAdmin
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .maybeSingle();

  if (profileError) {
    console.error(
      "관리자 프로필 확인 오류:",
      profileError,
    );

    return false;
  }

  return (
    profile?.role === "admin" ||
    profile?.role === "super_admin"
  );
}

/* 관리자 답변 저장 */
async function submitAnswer(formData: FormData) {
  "use server";

  const isAdmin = await checkAdmin();

  if (!isAdmin) {
    throw new Error(
      "관리자만 문의에 답변할 수 있습니다.",
    );
  }

  const id = String(
    formData.get("id") ?? "",
  ).trim();

  const answer = String(
    formData.get("answer") ?? "",
  ).trim();

  if (!id) {
    throw new Error("문의글 ID가 없습니다.");
  }

  if (!answer) {
    throw new Error(
      "답변 내용을 입력해 주세요.",
    );
  }

  const { data, error } = await supabaseAdmin
    .from("inquiries")
    .update({
      answer,
      status: "answered",
      answered_at: new Date().toISOString(),
    })
    .eq("id", id)
    .select("id")
    .maybeSingle();

  if (error) {
    console.error(
      "문의 답변 저장 오류:",
      error,
    );

    throw new Error(
      `문의 답변 저장 실패: ${error.message}`,
    );
  }

  if (!data) {
    throw new Error(
      "문의글이 없거나 답변을 저장하지 못했습니다.",
    );
  }

  revalidatePath(
    `/community/inquiries/${id}`,
  );

  revalidatePath(
    "/community/inquiries",
  );

  redirect("/community/inquiries");
}

/* 비밀글 안내 화면 */
function PrivateInquiryNotice({
  loggedIn,
}: {
  loggedIn: boolean;
}) {
  return (
    <>
      <main className="min-h-screen bg-[#F8F3EC] px-4 py-6 pb-28 sm:px-6">
        <div className="mx-auto w-full max-w-2xl">
          {/* 상단 제목 */}
          <div className="relative mb-6 flex items-center justify-center">
            <div className="absolute left-0">
              <BackButton />
            </div>

            <h1 className="text-2xl font-black text-[#172033]">
              문 의
            </h1>
          </div>

          {/* 비밀글 안내 */}
          <div className="rounded-3xl bg-white px-6 py-10 text-center shadow-sm sm:px-10 sm:py-12">
            <div className="mb-4 text-5xl">
              🔒
            </div>

            <h2 className="text-xl font-black text-[#172033]">
              비밀글입니다
            </h2>

            <p className="mt-3 text-sm leading-7 text-gray-600">
              이 문의는 작성자와 관리자만
              <br />
              내용을 확인할 수 있습니다.
            </p>

            {!loggedIn && (
              <Link
                href={`/login?redirect=${encodeURIComponent(
                  "/community/inquiries",
                )}`}
                className="mx-auto mt-6 block w-full max-w-sm rounded-full bg-[#172033] py-3.5 text-sm font-bold text-white"
              >
                로그인
              </Link>
            )}

            <Link
              href="/community/inquiries"
              className="mt-6 inline-block text-sm font-bold text-[#172033] underline underline-offset-4"
            >
              문의 목록으로
            </Link>
          </div>
        </div>
      </main>

      <CommunityBottomNav activeNav="ads" />
    </>
  );
}

export default async function InquiryDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const supabase =
    await createSupabaseServerClient();

  /* 현재 로그인 사용자 확인 */
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError) {
    console.error(
      "로그인 사용자 확인 오류:",
      userError,
    );
  }

  /* 관리자 권한 확인 */
  const isAdmin = await checkAdmin();

  /*
    관리자는 service role 클라이언트 사용.
    일반 사용자는 RLS가 적용되는 사용자 클라이언트 사용.
  */
  const queryClient = isAdmin
    ? supabaseAdmin
    : supabase;

  const { data: inquiry, error } =
    await queryClient
      .from("inquiries")
      .select("*")
      .eq("id", id)
      .maybeSingle();

  if (error) {
    console.error(
      "문의글 조회 오류:",
      error,
    );
  }

  /*
    일반 사용자가 RLS로 차단된 경우
    실제 존재 여부는 노출하지 않고
    비밀글 안내 화면을 보여줍니다.
  */
  if (!inquiry) {
    return (
      <PrivateInquiryNotice
        loggedIn={Boolean(user)}
      />
    );
  }

  const isPrivate =
    inquiry.visibility === "private";

  /*
    작성자 확인:
    inquiries.user_id와
    로그인 사용자의 user.id 비교
  */
  const isOwner =
    Boolean(user?.id) &&
    Boolean(inquiry.user_id) &&
    inquiry.user_id === user?.id;

  /*
    공개글, 작성자 본인, 관리자는 열람 가능
  */
  const canRead =
    !isPrivate ||
    isOwner ||
    isAdmin;

  if (!canRead) {
    return (
      <PrivateInquiryNotice
        loggedIn={Boolean(user)}
      />
    );
  }

  return (
    <>
      <main className="min-h-screen bg-[#F8F3EC] px-4 py-6 pb-32 sm:px-6">
        <div className="mx-auto w-full max-w-2xl">
          {/* 상단 제목 */}
          <div className="relative mb-5 flex items-center justify-center">
            <div className="absolute left-0">
              <BackButton />
            </div>

            <h1 className="text-2xl font-black text-[#172033]">
              문 의
            </h1>
          </div>

          {/* 문의 내용 */}
          <div className="rounded-3xl bg-white p-5 shadow-sm sm:p-7">
            <div className="mb-4 flex items-center justify-between gap-3">
              <span className="text-xs font-bold text-gray-500">
                {isPrivate
                  ? "🔒 비밀 문의"
                  : "오픈 문의"}
              </span>

              <span
                className={`shrink-0 text-xs font-bold ${
                  inquiry.status ===
                  "answered"
                    ? "text-green-600"
                    : "text-orange-500"
                }`}
              >
                {inquiry.status ===
                "answered"
                  ? "답변완료"
                  : "답변대기"}
              </span>
            </div>

            <h2 className="mb-3 break-words text-2xl font-black leading-tight text-[#172033] sm:text-3xl">
              {inquiry.title}
            </h2>

            <div className="mb-5 text-sm text-gray-500">
              작성자:{" "}
              {inquiry.name || "익명"}
            </div>

            <p className="whitespace-pre-wrap break-words text-[15px] leading-7 text-gray-800">
              {inquiry.message}
            </p>
          </div>

          {/* 관리자 답변 */}
          {inquiry.answer && (
            <div className="mt-4 rounded-3xl bg-[#172033] p-5 text-white shadow-sm sm:p-7">
              <div className="mb-4 flex items-center justify-between gap-3">
                <span className="text-sm font-bold text-yellow-300">
                  관리자 답변
                </span>

                {inquiry.answered_at && (
                  <span className="shrink-0 text-xs text-gray-300">
                    {new Date(
                      inquiry.answered_at,
                    ).toLocaleDateString(
                      "ko-KR",
                    )}
                  </span>
                )}
              </div>

              <p className="whitespace-pre-wrap break-words text-sm leading-7">
                {inquiry.answer}
              </p>
            </div>
          )}

          {/* 관리자 답변 입력창 */}
          {isAdmin && (
            <form
              action={submitAnswer}
              className="mt-4 rounded-3xl border border-gray-200 bg-white p-5 shadow-sm sm:p-7"
            >
              <input
                type="hidden"
                name="id"
                value={String(
                  inquiry.id,
                )}
              />

              <label
                htmlFor="answer"
                className="mb-3 block text-base font-black text-[#172033]"
              >
                {inquiry.answer
                  ? "관리자 답변 수정"
                  : "관리자 답변 작성"}
              </label>

              <textarea
                id="answer"
                name="answer"
                defaultValue={
                  inquiry.answer ?? ""
                }
                rows={7}
                className="w-full resize-none rounded-2xl border border-gray-300 bg-white p-4 text-sm leading-6 text-gray-900 outline-none transition focus:border-[#172033] focus:ring-2 focus:ring-[#172033]/10"
                placeholder="문의에 대한 답변을 입력하세요."
                required
              />

              <button
                type="submit"
                className="mt-4 w-full rounded-full bg-[#172033] py-3.5 text-sm font-bold text-white transition hover:bg-[#26334d] active:scale-[0.98]"
              >
                {inquiry.answer
                  ? "답변 수정하기"
                  : "답변 저장하기"}
              </button>
            </form>
          )}
        </div>
      </main>

      <CommunityBottomNav activeNav="ads" />
    </>
  );
}