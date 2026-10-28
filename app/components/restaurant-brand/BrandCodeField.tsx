"use client";
import {useState} from "react";
import {normalizeBrandCode,orderLink} from "@/lib/restaurant-brand/brand";
export default function BrandCodeField({value,onChange}:{value:string;onChange:(value:string)=>void}){
 const [copied,setCopied]=useState(false);
 let normalized="",error="";try{normalized=normalizeBrandCode(value);}catch(err){error=err instanceof Error?err.message:"브랜드 코드를 확인하세요.";}
 async function copy(){if(!normalized)return;const link=new URL(orderLink(normalized),window.location.origin).href;try{await navigator.clipboard.writeText(link);setCopied(true);}catch{window.prompt("주문 링크를 복사하세요.",link);}}
 return <div className="rounded-2xl border border-blue-200 bg-blue-50 p-4"><label className="block text-sm font-black text-slate-900">브랜드 코드 (여러 매장일 때)<input value={value} onChange={e=>{onChange(e.target.value);setCopied(false);}} onBlur={()=>{if(!error)onChange(normalized);}} placeholder="예: kimono" autoCapitalize="none" spellCheck={false} maxLength={100} className="mt-2 w-full rounded-xl border bg-white px-4 py-3 text-slate-900"/></label><p className="mt-2 text-xs leading-5 text-slate-600">같은 브랜드의 모든 매장에 같은 코드를 입력하세요. 단독 매장은 비워두세요. 영문·숫자·하이픈을 사용하며 대문자와 공백은 저장할 때 정리됩니다.</p>{error?<p role="alert" className="mt-2 text-xs text-red-700">{error}</p>:normalized?<div className="mt-3 flex flex-wrap items-center gap-3"><code className="break-all text-xs">{orderLink(normalized)}</code><button type="button" onClick={()=>void copy()} className="rounded-lg border border-blue-200 bg-white px-3 py-2 text-xs font-bold">{copied?"복사됨":"주문 링크 복사"}</button><span className="text-xs text-slate-500">매장 정보를 저장한 뒤 사용하세요.</span></div>:null}</div>;
}
