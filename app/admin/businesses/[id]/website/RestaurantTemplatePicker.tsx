"use client";

import { useState } from "react";
import { RESTAURANT_TEMPLATES, type RestaurantTemplateId } from "@/lib/website/restaurant-templates";

export default function RestaurantTemplatePicker({ businessId, onApply, onClose }: {
  businessId: string;
  onApply: (id: RestaurantTemplateId, images: Record<string, string[]>) => void | Promise<void>;
  onClose: () => void;
}) {
  const [industry, setIndustry] = useState("");
  const [selected, setSelected] = useState<RestaurantTemplateId | null>(() => {
    if (typeof window === "undefined") return null;
    const pending = sessionStorage.getItem(`restaurant-template-${businessId}`);
    return RESTAURANT_TEMPLATES.find(item => item.id === pending)?.id || null;
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [missing, setMissing] = useState(false);
  const template = RESTAURANT_TEMPLATES.find(item => item.id === selected);

  async function generate() {
    if (!template || busy) return;
    setBusy(true); setError(""); setMissing(false);
    try {
      const images: Record<string, string[]> = {};
      for (const requirement of template.images) {
        const response = await fetch(`/api/owner/businesses/${businessId}/website-images?type=${requirement.type}`, { cache: "no-store", credentials: "include" });
        const result = await response.json();
        if (!response.ok) throw new Error(result.error || "이미지를 불러오지 못했습니다.");
        images[requirement.type] = (result.images || []).map((item: {image_url: string}) => item.image_url).filter(Boolean);
      }
      const absent = template.images.filter(item => images[item.type].length < item.minimum);
      if (absent.length) {
        sessionStorage.setItem(`restaurant-template-${businessId}`, template.id);
        setMissing(true);
        setError(`${absent.map(item => item.label).join(", ")} 이미지를 먼저 등록해주세요. 아래 이미지 관리에서 등록 후 돌아오세요.`);
        return;
      }
      await onApply(template.id, images);
      sessionStorage.removeItem(`restaurant-template-${businessId}`);
    } catch (err) { setError(err instanceof Error ? err.message : "템플릿 생성에 실패했습니다."); }
    finally { setBusy(false); }
  }

  return <div className="fixed inset-0 z-[10000] overflow-y-auto bg-slate-950/60 p-4" role="dialog" aria-modal="true" aria-labelledby="template-title">
    <div className="mx-auto my-8 max-w-5xl rounded-3xl bg-white p-6 text-slate-900 shadow-xl">
      <div className="flex items-center justify-between gap-4"><h2 id="template-title" className="text-2xl font-black">웹사이트 기본 디자인 선택</h2><button type="button" onClick={onClose} className="rounded-xl border px-4 py-2">건너뛰고 기존 디자인 편집</button></div>
      <p className="mt-3 text-sm text-slate-600">업종 → 템플릿 → 이미지 등록 → 디자인 수정 → 미리보기·런칭</p>
      <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">{["식당", "부동산", "미용실", "일반"].map(label => <button type="button" key={label} onClick={() => { setIndustry(label); setError(""); }} className={`rounded-xl border-2 p-4 font-bold ${industry === label || (!industry && selected && label === "식당") ? "border-orange-600 bg-orange-50" : "border-slate-200"}`}>{label}</button>)}</div>
      {industry && industry !== "식당" ? <p className="mt-6 rounded-xl bg-slate-50 p-5">이 업종의 기본 템플릿은 준비 중입니다. 기존 디자인 편집에서 자유롭게 만들 수 있습니다.</p> : industry === "식당" || selected ? <>
        <div className="mt-6 grid gap-4 md:grid-cols-3">{RESTAURANT_TEMPLATES.map(item => <button type="button" key={item.id} onClick={() => { setSelected(item.id); setMissing(false); setError(""); }} className={`rounded-2xl border-2 p-4 text-left ${selected === item.id ? "border-orange-600 bg-orange-50" : "border-slate-200"}`}>
          <div aria-hidden="true" className="mb-4 space-y-2 rounded-lg border bg-white p-3">{item.id !== "restaurant-3" && <div className="rounded bg-slate-100 p-2 text-xs">로고 · 식당명 · 전화</div>}<div className="rounded bg-orange-100 px-2 py-7 text-center text-xs">{item.id === "restaurant-1" ? "‹ 이미지 슬라이드 ›" : "큰 메인 이미지"}{item.id !== "restaurant-1" && <span className="mx-auto mt-4 block w-fit rounded bg-orange-700 px-3 py-2 text-white">ONLINE ORDER</span>}</div>{item.id === "restaurant-1" && <div className="rounded bg-orange-700 p-2 text-center text-xs text-white">ONLINE ORDER</div>}{item.id === "restaurant-2" && <div className="rounded bg-orange-50 p-2 text-center text-xs">사진 · 사진 · 사진 →</div>}<div className="rounded bg-slate-100 p-2 text-center text-xs">Business Hours</div><div className="flex gap-2 text-xs"><div className="flex-1 bg-slate-100 p-2">연락처 · Policy</div>{<div className="flex-1 bg-emerald-50 p-2">지도</div>}</div></div>
          <strong>{item.name}</strong><p className="mt-2 text-xs leading-6 text-slate-600">{item.description}</p>
        </button>)}</div>
        {template && <div className="mt-6 rounded-xl bg-slate-50 p-5"><h3 className="font-black">먼저 준비할 이미지</h3><p className="mt-2 text-sm">로고는 기존 비즈니스 로고를 사용합니다. 권장 크기에 맞춘 사진을 이미지 관리의 해당 탭에 등록하세요.</p>{template.images.map(item => <p key={item.type} className="mt-2 text-sm font-bold">{item.label}: {item.size}, 최소 {item.minimum}장</p>)}<p className="mt-2 text-xs">모바일에서는 화면 비율에 맞춰 사진 가장자리가 잘릴 수 있으므로 주요 피사체를 가운데에 배치하세요.</p>
        <div className="mt-4 flex flex-wrap gap-3"><a className="rounded-xl border bg-white px-4 py-3 font-bold" href={`/owner/business/${businessId}/gallery?template=${template.id}&type=${template.images[0].type}`} onClick={() => sessionStorage.setItem(`restaurant-template-${businessId}`, template.id)}>이미지 관리 열기</a><button type="button" disabled={busy} onClick={() => void generate()} className="rounded-xl bg-orange-700 px-4 py-3 font-bold text-white disabled:opacity-50">{busy ? "이미지 확인 중…" : missing ? "등록한 이미지 다시 확인" : "등록된 이미지로 템플릿 만들기"}</button></div></div>}
      </> : null}
      {error && <p role="alert" className="mt-4 rounded-xl bg-red-50 p-4 text-sm text-red-700">{error}</p>}
      <p className="mt-5 text-xs text-slate-500">기본 디자인은 편집 초안으로 적용됩니다. 수정 후 서버 저장·미리보기하고 상태를 Published로 변경해 런칭하세요.</p>
    </div>
  </div>;
}
