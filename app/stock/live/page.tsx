"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "@/lib/supabase";

type Snapshot = {
  symbol: string; price?: number; action?: string; forecast?: string; score?: number;
  down_risk?: number; pnl?: number; entry?: number; buy60?: number; sell60?: number;
  vwap?: number; ema9?: number; ema20?: number; resistance?: number; support?: number;
  local_support?: number; fast_drop?: string; trend_1m?: string;
};

const MAX_SYMBOLS = 5;
const fmt=(v:unknown,d=2)=>Number.isFinite(Number(v))?Number(v).toFixed(d):"-";

export default function StockLivePage() {
  const wsRef=useRef<WebSocket|null>(null);
  const [symbols,setSymbols]=useState<string[]>([]);
  const [snapshots,setSnapshots]=useState<Record<string,Snapshot>>({});
  const [status,setStatus]=useState("연결 확인 중...");

  const connect=useCallback((url?:string|null)=>{
    if(!url){setStatus("분석 서버 연결 대기");return;}
    if(wsRef.current) try{wsRef.current.close();}catch{}
    const ws=new WebSocket(url); wsRef.current=ws;
    ws.onopen=()=>setStatus("실시간 분석 서버 연결됨");
    ws.onmessage=(e)=>{
      try{
        const p=JSON.parse(e.data);
        const list:Snapshot[]=Array.isArray(p?.data)?p.data:[];
        setSnapshots(prev=>{
          const next={...prev};
          list.forEach(x=>{if(x?.symbol)next[x.symbol]=x;});
          return next;
        });
      }catch{}
    };
    ws.onerror=()=>setStatus("분석 서버 연결 오류");
    ws.onclose=()=>setStatus("분석 서버 연결 끊김");
  },[]);

  const load=useCallback(async()=>{
    const {data:{session}}=await supabase.auth.getSession();
    if(!session?.user){setStatus("로그인이 필요합니다.");return;}
    const {data,error}=await supabase.from("stock_watchlists").select("symbols")
      .eq("user_id",session.user.id).maybeSingle();
    if(error){setStatus(error.message);return;}
    const list=Array.isArray(data?.symbols)?data.symbols.slice(0,MAX_SYMBOLS):[];
    setSymbols(list);
    try{
      const r=await fetch("/api/stocks/session",{headers:{authorization:`Bearer ${session.access_token}`},cache:"no-store"});
      const j=await r.json().catch(()=>({}));
      if(r.ok&&j?.wsUrl)connect(j.wsUrl); else setStatus("분석 서버 연결 대기");
    }catch{setStatus("분석 서버 연결 대기");}
  },[connect]);

  useEffect(()=>{void load();return()=>{if(wsRef.current)try{wsRef.current.close();}catch{}}},[load]);

  const rows=Array.from({length:MAX_SYMBOLS},(_,i)=>({symbol:symbols[i]||"",item:symbols[i]?snapshots[symbols[i]]:undefined}));

  return <main className="min-h-screen bg-slate-50 pb-16">
    <div className="mx-auto max-w-[1600px] px-3 py-4">
      <div className="mb-4 flex items-center justify-between gap-3">
        <div>
          <Link href="/stock" className="text-xs font-black text-blue-600 hover:underline">← Market Dashboard</Link>
          <h1 className="mt-2 text-2xl font-black text-slate-950">LIVE DATA</h1>
          <p className="mt-1 text-sm text-slate-500">등록 종목 실시간 분석 · {status}</p>
        </div>
        <button onClick={()=>void load()} className="rounded-lg bg-blue-600 px-4 py-2 text-xs font-black text-white hover:bg-blue-700">재연결</button>
      </div>

      <section className="rounded-xl border border-slate-300 bg-white p-3 shadow-sm">
        <div className="overflow-x-auto border border-slate-300">
          <table className="min-w-[1180px] w-full border-collapse text-[11px]">
            <thead className="bg-slate-100">
              <tr>{["Ticker","?","Action","Price","Forecast","Score","Down Risk","P/L","Entry","Buy60","Sell60","VWAP","EMA9","EMA20","Resistance","Support","Fast Drop","1m Trend"].map(h=>
                <th key={h} className="whitespace-nowrap border-b border-r border-slate-300 px-2 py-2 font-black">{h}</th>)}
              </tr>
            </thead>
            <tbody>{rows.map(({symbol,item},i)=><tr key={symbol||i} className="h-12">
              <Cell strong>{symbol||"-"}</Cell>
              <Cell>{symbol?<button className="mx-auto flex h-7 w-7 items-center justify-center rounded-md border-2 border-blue-700 bg-blue-600 font-black text-white">?</button>:"-"}</Cell>
              <Cell>{symbol?<b>{item?.action||"DATA WAIT"}</b>:"-"}</Cell>
              <Cell>{item?.price!=null?`$${fmt(item.price)}`:"-"}</Cell>
              <Cell>{item?.forecast||"-"}</Cell><Cell>{item?.score??"-"}</Cell>
              <Cell>{item?.down_risk!=null?`${fmt(item.down_risk,0)}%`:"-"}</Cell>
              <Cell>{item?fmt(item.pnl):"-"}</Cell><Cell>{item?fmt(item.entry):"-"}</Cell>
              <Cell>{item?.buy60??"-"}</Cell><Cell>{item?.sell60??"-"}</Cell>
              <Cell>{item?fmt(item.vwap):"-"}</Cell><Cell>{item?fmt(item.ema9):"-"}</Cell><Cell>{item?fmt(item.ema20):"-"}</Cell>
              <Cell>{item?fmt(item.resistance):"-"}</Cell><Cell>{item?fmt(item.local_support??item.support):"-"}</Cell>
              <Cell>{item?.fast_drop||"-"}</Cell><Cell>{item?.trend_1m||"-"}</Cell>
            </tr>)}</tbody>
          </table>
        </div>
      </section>
    </div>
  </main>;
}

function Cell({children,strong=false}:{children:React.ReactNode;strong?:boolean}){
  return <td className={`whitespace-nowrap border-b border-r border-slate-300 px-2 py-2 text-center ${strong?"font-black text-slate-950":"font-medium text-slate-700"}`}>{children}</td>;
}
