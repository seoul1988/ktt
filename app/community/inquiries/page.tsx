import Link from "next/link";
import { createSupabaseServerClient } from "@/lib/supabaseServer";
import CommunityBottomNav from "../../components/CommunityBottomNav";
import BackButton from "@/app/components/BackButton";


export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function CommunityInquiriesPage() {
  const supabase = await createSupabaseServerClient();

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError) {
    console.error("로그인 확인 오류:", authError);
  }

  console.log("현재 로그인 사용자:", user?.id);

  const { data: inquiries, error } = await supabase
    .from("inquiries")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) {
    console.error("문의 목록 불러오기 오류:", {
      message: error.message,
      details: error.details,
      hint: error.hint,
      code: error.code,
    });
  }

  const inquiryWriteHref = user
    ? "/community/inquiries/new"
    : "/login?redirect=/community/inquiries/new";

  return (
    <>
      <main className="min-h-screen bg-[#F8F3EC] px-4 py-6 pb-24">
        <div className="mx-auto max-w-md">

 
 <div className="relative mb-5 flex items-center justify-center">
  {/* 뒤로가기 버튼 */}
  <div className="absolute left-0">
    <BackButton />
  </div>

  {/* 가운데 제목 */}
  <h1 className="text-2xl font-black text-[#172033]">
    문의 게시판
  </h1>

  {/* 문의하기 버튼 */}
  <div className="absolute right-0">
    <Link
      href={inquiryWriteHref}
      className="rounded-full bg-[#172033] px-4 py-2 text-sm font-bold text-white"
    >
      문의하기
    </Link>
  </div>
</div>

          {!user && (
            <div className="mb-4 rounded-2xl border border-orange-200 bg-orange-50 p-4">
              <p className="text-sm font-bold text-orange-700">
                로그인하면 본인이 작성한 비밀 문의도 확인할 수 있습니다.
              </p>

              <Link
                href="/login?redirect=/community/inquiries"
                className="mt-2 inline-block text-sm font-black text-[#172033] underline"
              >
                로그인하기
              </Link>
            </div>
          )}

          <div className="space-y-3">
            {inquiries && inquiries.length > 0 ? (
              inquiries.map((item) => (
                <Link
                  key={item.id}
                  href={`/community/inquiries/${item.id}`}
                  className="block rounded-2xl bg-white p-4 shadow-sm transition hover:shadow-md"
                >
                  <div className="mb-1 flex items-center justify-between">
                    <span className="text-xs font-bold text-gray-500">
                      {item.visibility === "private"
                        ? "🔒"
                        : "오픈 문의"}
                    </span>

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
                  </div>

                  <h2 className="font-black text-[#172033]">
                    {item.visibility === "private"
                      ? " 비밀 문의입니다"
                      : item.title}
                  </h2>

                 <div className="mt-2 flex items-center justify-between text-sm text-gray-500">
  <span className="font-medium">
    익명 #
    {item.user_id
      ? item.user_id.slice(-4).toUpperCase()
      : "0000"}
  </span>

  <span className="text-xs text-gray-400">
    {new Date(item.created_at).toLocaleDateString("ko-KR", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    })}
  </span>
</div>
                </Link>
              ))
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