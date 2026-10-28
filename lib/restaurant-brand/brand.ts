export function normalizeBrandCode(value: unknown): string {
  const code = String(value ?? "").trim().toLowerCase().replace(/\s+/g, "");
  if (code && !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(code)) throw new Error("브랜드 코드는 영문 소문자·숫자·하이픈만 사용하세요. 예: kimono");
  if (code.length > 60) throw new Error("브랜드 코드는 60자 이내로 입력하세요.");
  return code;
}
export type BrandStore = {id:number;name:string;address:string|null;phone:string|null;lat:number|string|null;lng:number|string|null;hours:unknown;image_url:string|null;brand_code:string};
export function orderLink(brand: string, businessId?: number, service?: string) {
  const query = new URLSearchParams({brandId:normalizeBrandCode(brand)});
  if(businessId) query.set("businessId",String(businessId));
  if(service === "pickup" || service === "delivery") query.set("service",service);
  return `/order?${query}`;
}
export function chooseBrandStore(stores:BrandStore[], requested?:string) {
  if(requested !== undefined) {
    if(!/^[1-9]\d*$/.test(requested)) return null;
    return stores.find(store=>store.id===Number(requested)) || null;
  }
  return stores.length === 1 ? stores[0] : null;
}
export function coordinates(store: Pick<BrandStore,"lat"|"lng">): [number,number] | null {
  if(store.lat===null||store.lng===null||store.lat===""||store.lng==="") return null;
  const lat=Number(store.lat),lng=Number(store.lng);
  return Number.isFinite(lat)&&Number.isFinite(lng)&&Math.abs(lat)<=90&&Math.abs(lng)<=180?[lat,lng]:null;
}
export function distanceMiles(a:[number,number],b:[number,number]) {
  const rad=(n:number)=>n*Math.PI/180;
  const x=Math.sin(rad(b[0]-a[0])/2)**2+Math.cos(rad(a[0]))*Math.cos(rad(b[0]))*Math.sin(rad(b[1]-a[1])/2)**2;
  return 3958.8*2*Math.atan2(Math.sqrt(x),Math.sqrt(Math.max(0,1-x)));
}
