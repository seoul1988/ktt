import Link from "next/link";
import { supabase } from "@/lib/supabase";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function CommunityInquiriesPage() {
  const { data: inquiries } = await supabase
    .from("inquiries")
    .select("*")
    .order("created_at", { ascending: false });

  return (
    <main className="min-h-screen bg-[#F8F3EC] px-4 py-6 pb-24">
      <div className="mx-auto max-w-md">
        <div className="mb-5 flex items-center justify-between">
          <h1 className="text-2xl font-black text-[#172033]">문의 게시판</h1>

          <Link
            href="/community/inquiries/new"
            className="rounded-full bg-[#172033] px-4 py-2 text-sm font-bold text-white"
          >
            문의하기
          </Link>
        </div>

        <div className="space-y-3">
          {inquiries?.map((item) => (
            <Link
              key={item.id}
              href={`/community/inquiries/${item.id}`}
              className="block rounded-2xl bg-white p-4 shadow-sm"
            >
              <div className="mb-1 flex items-center justify-between">
                <span className="text-xs font-bold text-gray-500">
                  {item.visibility === "private" ? "🔒 비밀 문의" : "오픈 문의"}
                </span>

                <span className="text-xs font-bold text-gray-500">
                  {item.status === "answered" ? "답변완료" : "답변대기"}
                </span>
              </div>

              <h2 className="font-black text-[#172033]">
                {item.visibility === "private" ? "🔒 비밀 문의입니다" : item.title}
              </h2>

              <p className="mt-1 text-sm text-gray-500">
                {item.name || "익명"}
              </p>
            </Link>
          ))}
        </div>
      </div>
    </main>
  );
}