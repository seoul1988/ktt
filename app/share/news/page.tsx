

import { Suspense, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { supabase } from "@/lib/supabase";

type Preview = {
  title: string;
  url: string;
  source?: string;
  description?: string;
  imageUrl?: string;
};

function firstHttpUrl(...values: Array<string | null>) {
  for (const value of values) {
    const match = String(value || "").match(/https?:\/\/[^\s]+/i);
    if (match) return match[0].replace(/[),.;]+$/, "");
  }
  return "";
}

function ShareNewsContent() {
  const params = useSearchParams();
  const router = useRouter();
  const sharedTitle = params.get("title") || "";
  const sharedText = params.get("text") || "";
  const sharedUrl = params.get("url") || "";

  const detectedUrl = useMemo(
    () => firstHttpUrl(sharedUrl, sharedText, sharedTitle),
    [sharedTitle, sharedText, sharedUrl],
  );

  const [preview, setPreview] = useState<Preview | null>(null);
  const [status, setStatus] = useState("공유 내용을 확인하는 중...");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      if (!detectedUrl) {
        setPreview({
          title: sharedTitle || sharedText || "공유 뉴스",
          url: "",
          source: "Shared",
        });
        setStatus("링크가 없어서 제목만 등록할 수 있습니다.");
        return;
      }

      try {
        const res = await fetch(`/api/share/news/preview?url=${encodeURIComponent(detectedUrl)}`);
        const data = await res.json();
        if (!res.ok) throw new Error(data?.error || "기사 정보를 읽지 못했습니다.");
        if (cancelled) return;
        setPreview({
          title: data.title || sharedTitle || "공유 뉴스",
          url: detectedUrl,
          source: data.source || new URL(detectedUrl).hostname.replace(/^www\./, ""),
          description: data.description || sharedText || undefined,
          imageUrl: data.imageUrl || undefined,
        });
        setStatus("내용을 확인한 뒤 등록하세요.");
      } catch (error) {
        if (cancelled) return;
        setPreview({
          title: sharedTitle || sharedText || "공유 뉴스",
          url: detectedUrl,
          source: new URL(detectedUrl).hostname.replace(/^www\./, ""),
        });
        setStatus(error instanceof Error ? error.message : "기사 정보를 일부만 가져왔습니다.");
      }
    }

    void load();
    return () => { cancelled = true; };
  }, [detectedUrl, sharedText, sharedTitle]);

  async function save() {
    if (!preview) return;
    setSaving(true);
    setStatus("KTown에 저장하는 중...");

    try {
      // 로그인 여부와 관계없이 등록할 수 있습니다.
      // 로그인되어 있으면 user_id를 함께 저장하고, 아니면 null로 저장합니다.
      const {
        data: { session },
      } = await supabase.auth.getSession();

      const { error } = await supabase.from("shared_news").insert({
        user_id: session?.user?.id ?? null,
        title: preview.title,
        url: preview.url || null,
        source: preview.source || "Shared",
        description: preview.description || null,
        image_url: preview.imageUrl || null,
        published_at: new Date().toISOString(),
      });

      if (error) throw error;

      setStatus("등록 완료. LATEST NEWS에 표시됩니다.");
      window.setTimeout(() => router.replace("/stock"), 700);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "저장하지 못했습니다.");
      setSaving(false);
    }
  }

  return (
    <main className="min-h-[100dvh] bg-slate-50 px-4 py-6 text-slate-900">
      <div className="mx-auto max-w-lg">
        <div className="mb-4">
          <div className="text-xs font-black uppercase tracking-[0.18em] text-rose-600">KTown Share</div>
          <h1 className="mt-1 text-2xl font-black">뉴스 등록</h1>
          <p className="mt-1 text-sm text-slate-500">다른 앱에서 공유한 기사를 확인하고 KTown에 저장합니다.</p>
        </div>

        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          {preview?.imageUrl ? (
            <img src={preview.imageUrl} alt="" className="h-52 w-full object-cover" />
          ) : null}
          <div className="p-4">
            <div className="text-xs font-bold text-slate-500">{preview?.source || "Shared"}</div>
            <div className="mt-1 text-lg font-black leading-6">{preview?.title || "불러오는 중..."}</div>
            {preview?.description ? (
              <div className="mt-2 text-sm leading-5 text-slate-600">{preview.description}</div>
            ) : null}
            {preview?.url ? (
              <div className="mt-3 break-all text-xs text-slate-400">{preview.url}</div>
            ) : null}
          </div>
        </div>

        <div className="mt-3 rounded-xl bg-slate-100 px-3 py-2 text-xs font-semibold text-slate-600">{status}</div>

        <div className="mt-4 grid grid-cols-2 gap-3">
          <button type="button" onClick={() => router.replace("/stock")} className="h-11 rounded-xl border border-slate-300 bg-white font-black">취소</button>
          <button type="button" disabled={!preview || saving} onClick={() => void save()} className="h-11 rounded-xl bg-slate-950 font-black text-white disabled:opacity-40">
            {saving ? "저장 중..." : "KTown에 등록"}
          </button>
        </div>
      </div>
    </main>
  );
}


export default function ShareNewsPage() {
  return (
    <Suspense
      fallback={
        <main className="min-h-[100dvh] bg-slate-50 px-4 py-6 text-slate-900">
          <div className="mx-auto max-w-lg">
            <div className="rounded-xl bg-white p-4 text-sm font-semibold text-slate-600 shadow-sm">
              공유 내용을 불러오는 중...
            </div>
          </div>
        </main>
      }
    >
      <ShareNewsContent />
    </Suspense>
  );
}
