import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";

import { createSupabaseServerClient } from "@/lib/supabaseServer";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

import CommunityBottomNav from "../../../components/CommunityBottomNav";
import BackButton from "@/app/components/BackButton";

export const dynamic = "force-dynamic";
export const revalidate = 0;

async function createInquiry(formData: FormData) {
  "use server";

  const authSupabase =
    await createSupabaseServerClient();

  const {
    data: { user },
    error: authError,
  } = await authSupabase.auth.getUser();

  if (authError || !user) {
    redirect(
      "/login?redirect=/community/inquiries/new",
    );
  }

  const title = String(
    formData.get("title") || "",
  ).trim();

  const message = String(
    formData.get("message") || "",
  ).trim();

  const enteredName = String(
    formData.get("name") || "",
  ).trim();

  const selectedVisibility = String(
    formData.get("visibility") || "private",
  );

  if (!title || !message) {
    redirect(
      `/community/inquiries/new?error=${encodeURIComponent(
        "제목과 문의 내용을 입력해주세요.",
      )}`,
    );
  }

  const visibility =
    selectedVisibility === "public"
      ? "public"
      : "private";

  const name =
    enteredName ||
    user.user_metadata?.name ||
    user.user_metadata?.full_name ||
    user.email?.split("@")[0] ||
    "회원";

  const { data, error } = await supabaseAdmin
    .from("inquiries")
    .insert({
      title,
      message,
      name,
      visibility,
      status: "pending",
      user_id: user.id,
      email: user.email || null,
    })
    .select("id")
    .single();

  if (error) {
    console.error("문의 저장 오류:", error);

    redirect(
      `/community/inquiries/new?error=${encodeURIComponent(
        `${error.message}${
          error.details
            ? ` / ${error.details}`
            : ""
        }`,
      )}`,
    );
  }

  revalidatePath("/community/inquiries");

  if (data?.id) {
    redirect(
      `/community/inquiries/${data.id}`,
    );
  }

  redirect("/community/inquiries");
}

type PageProps = {
  searchParams: Promise<{
    error?: string;
  }>;
};

export default async function NewInquiryPage({
  searchParams,
}: PageProps) {
  const params = await searchParams;

  const supabase =
    await createSupabaseServerClient();

  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error || !user) {
    redirect(
      "/login?redirect=/community/inquiries/new",
    );
  }

  const defaultName =
    user.user_metadata?.name ||
    user.user_metadata?.full_name ||
    user.email?.split("@")[0] ||
    "";

  return (
    <>
      <main className="min-h-screen bg-[#F8F3EC] px-4 py-6 pb-28 sm:px-6">
        <div className="mx-auto w-full max-w-xl">
          {/* 상단 제목 */}
          <div className="relative mb-5 flex min-h-10 items-center justify-center">
            <div className="absolute left-0">
              <BackButton />
            </div>

            <h1 className="text-2xl font-black text-[#172033]">
              문의 작성
            </h1>
          </div>

          <p className="mb-5 text-center text-sm leading-6 text-gray-500">
            문의 내용을 작성하면 관리자가 확인 후
            답변드립니다.
          </p>

          {params.error && (
            <div className="mb-4 rounded-2xl border border-red-200 bg-red-50 p-4">
              <p className="font-bold text-red-700">
                문의를 저장하지 못했습니다.
              </p>

              <p className="mt-1 break-words text-sm leading-6 text-red-600">
                {params.error}
              </p>
            </div>
          )}

          <form
            action={createInquiry}
            className="space-y-5 rounded-3xl bg-white p-5 shadow-sm sm:p-6"
          >
            {/* 이름 */}
            <div>
              <label
                htmlFor="name"
                className="mb-2 block text-sm font-bold text-gray-700"
              >
                이름
              </label>

              <input
                id="name"
                type="text"
                name="name"
                defaultValue={defaultName}
                placeholder="이름을 입력하세요"
                className="w-full rounded-xl border border-gray-300 bg-white px-4 py-3 text-sm text-gray-900 outline-none transition placeholder:text-gray-400 focus:border-[#172033] focus:ring-2 focus:ring-[#172033]/10"
              />
            </div>

            {/* 제목 */}
            <div>
              <label
                htmlFor="title"
                className="mb-2 block text-sm font-bold text-gray-700"
              >
                제목
              </label>

              <input
                id="title"
                type="text"
                name="title"
                required
                maxLength={200}
                placeholder="문의 제목을 입력하세요"
                className="w-full rounded-xl border border-gray-300 bg-white px-4 py-3 text-sm text-gray-900 outline-none transition placeholder:text-gray-400 focus:border-[#172033] focus:ring-2 focus:ring-[#172033]/10"
              />
            </div>

            {/* 공개 여부 */}
            <div>
              <label
                htmlFor="visibility"
                className="mb-2 block text-sm font-bold text-gray-700"
              >
                공개 여부
              </label>

              <select
                id="visibility"
                name="visibility"
                defaultValue="private"
                className="w-full rounded-xl border border-gray-300 bg-white px-4 py-3 text-sm text-gray-900 outline-none transition focus:border-[#172033] focus:ring-2 focus:ring-[#172033]/10"
              >
                <option value="private">
                  비밀 문의
                </option>

                <option value="public">
                  오픈 문의
                </option>
              </select>

              <p className="mt-2 text-xs leading-5 text-gray-500">
                비밀 문의는 작성자와 관리자만 내용을
                확인할 수 있습니다.
              </p>
            </div>

            {/* 문의 내용 */}
            <div>
              <label
                htmlFor="message"
                className="mb-2 block text-sm font-bold text-gray-700"
              >
                문의 내용
              </label>

              <textarea
                id="message"
                name="message"
                required
                rows={9}
                placeholder="문의 내용을 자세히 입력하세요."
                className="w-full resize-none rounded-xl border border-gray-300 bg-white px-4 py-3 text-sm leading-6 text-gray-900 outline-none transition placeholder:text-gray-400 focus:border-[#172033] focus:ring-2 focus:ring-[#172033]/10"
              />
            </div>

            {/* 등록 버튼 */}
            <button
              type="submit"
              className="w-full rounded-xl bg-[#172033] py-3.5 text-sm font-black text-white transition hover:bg-[#26334d] active:scale-[0.99]"
            >
              문의 등록
            </button>
          </form>
        </div>
      </main>

      <CommunityBottomNav activeNav="ads" />
    </>
  );
}