import Link from "next/link";
import { notFound } from "next/navigation";
import { supabase } from "../../../../lib/supabase";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function BusinessNewsDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const { data: item, error } = await supabase
    .from("business_news")
    .select("*")
    .eq("id", id)
    .eq("published", true)
    .maybeSingle();

  if (error || !item) notFound();

  return (
    <main className="min-h-screen bg-[#F7F7F7] px-3 py-4 text-[#172033]">
      <article className="mx-auto max-w-2xl overflow-hidden rounded-2xl bg-white shadow-sm">
        <img
          src={item.image_url || "/event.png"}
          alt={item.title}
          className="aspect-[16/9] w-full object-cover"
        />

        <div className="p-5">
          <div className="text-xs font-bold text-gray-500">
            {item.category} ·{" "}
            {new Date(item.published_at).toLocaleDateString()}
          </div>

          <h1 className="mt-2 text-2xl font-extrabold leading-tight">
            {item.title}
          </h1>

          {item.summary && (
            <p className="mt-3 text-sm font-semibold leading-relaxed text-gray-600">
              {item.summary}
            </p>
          )}

          <div className="mt-5 whitespace-pre-wrap text-[15px] leading-7">
            {item.content}
          </div>

          <div className="mt-6 flex gap-2">
            <Link
              href="/community/news"
              className="rounded-xl border px-4 py-2 text-sm font-bold"
            >
              뉴스 목록
            </Link>

            {item.source_url && (
              <a
                href={item.source_url}
                target="_blank"
                rel="noopener noreferrer"
                className="rounded-xl bg-[#172033] px-4 py-2 text-sm font-bold text-white"
              >
                원문 보기
              </a>
            )}
          </div>
        </div>
      </article>
    </main>
  );
}
