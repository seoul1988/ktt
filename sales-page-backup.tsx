import Link from "next/link";

export default async function SalesHome({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const cards = [
    { path: "../orders", icon: "🧾", title: "주문 관리 · Order Management", desc: "주문 상태, 주문 조회, 취소 및 주문 처리" },
    { path: "summary", icon: "📊", title: "판매 집계 · Sales Summary", desc: "일별 매출, 주문 건수, 평균 주문금액" },
    { path: "payments", icon: "💳", title: "결제수단별 매출 · Payment Methods", desc: "Apple Pay, Google Pay, 카드 브랜드별 매출" },
    { path: "items", icon: "🍽️", title: "메뉴별 판매 · Menu Sales", desc: "메뉴별 판매량, 판매금액, 순위" },
    { path: "refunds", icon: "↩️", title: "취소 및 환불 · Refunds", desc: "취소 주문 및 환불 상태 확인" },
    { path: "reports", icon: "📥", title: "보고서 다운로드 · Reports", desc: "주문, 일별, 메뉴, 결제수단 CSV" },
  ];
  return <main className="mx-auto max-w-5xl px-4 py-7 pb-24">
    <Link href={`/owner/business/${id}/manage`} className="text-sm font-semibold text-gray-600">← 비즈니스 관리</Link>
    <h1 className="mt-4 text-3xl font-black text-slate-900">판매 관리 · Sales & Reports</h1>
    <p className="mt-2 text-sm text-gray-500">KTown 온라인 주문 기준 · Eastern Time</p>
    <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2">
      {cards.map(card => <Link key={card.title} href={card.path === "../orders" ? `/owner/business/${id}/orders` : `/owner/business/${id}/sales/${card.path}`} className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm transition hover:border-amber-300 hover:shadow-md">
        <div className="text-3xl">{card.icon}</div><h2 className="mt-3 text-lg font-bold text-slate-900">{card.title}</h2><p className="mt-2 text-sm text-gray-500">{card.desc}</p><p className="mt-4 text-sm font-semibold text-amber-700">관리하기 →</p>
      </Link>)}
    </div>
  </main>;
}
