export type RestaurantTemplateId = "restaurant-1" | "restaurant-2" | "restaurant-3";
export const RESTAURANT_TEMPLATES = [
  { id: "restaurant-1", name: "1. 클래식 슬라이드", description: "헤더 → 이미지 슬라이드 → 온라인 주문 → 영업시간 → 연락처·지도 → 숨김 정책", images: [{ type: "slider", label: "슬라이드", size: "1920 × 800 px", minimum: 1 }] },
  { id: "restaurant-2", name: "2. 이미지 + 흐르는 사진", description: "헤더 → 큰 이미지와 하단 주문 버튼 → 흐르는 이미지 → 영업시간 → 연락처·지도 → 숨김 정책", images: [{ type: "hero", label: "HERO", size: "1920 × 1080 px", minimum: 1 }, { type: "scroll", label: "흐르는 이미지", size: "800 × 600 px", minimum: 1 }] },
  { id: "restaurant-3", name: "3. 심플 이미지", description: "큰 이미지와 하단 주문 버튼 → 영업시간 → 연락처·지도·정책 (별도 헤더 없음)", images: [{ type: "hero", label: "HERO", size: "1920 × 1080 px", minimum: 1 }] },
] as const;
export function getRestaurantTemplate(id: string | null) {
  return RESTAURANT_TEMPLATES.find(template => template.id === id);
}
