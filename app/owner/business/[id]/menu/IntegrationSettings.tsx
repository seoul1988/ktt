"use client";
import { useEffect, useState } from "react";
type Kind="payment"|"pos";
type Field={key:string;label:string};
type Service={id:string;kind:Kind;code:string;name:string;enabled:boolean;fields:Field[]};
type Connection={kind:Kind;service_id:string;updated_at:string};
type Draft={id?:string;kind:Kind;code:string;name:string;enabled:boolean;fieldsText:string};
type LegacyPayment={provider:"stripe"|"square";configured:boolean;merchantName:string;merchantId:string;locationName:string;locationId:string;secretMasked:string};
export default function IntegrationSettings({businessId,businessName,getToken,legacyPayment,onEditPayment,onDeletePayment}:{businessId:number;businessName:string;getToken:()=>Promise<string>;legacyPayment:LegacyPayment;onEditPayment:()=>void;onDeletePayment?:()=>void}) {
 const [services,setServices]=useState<Service[]>([]),[connections,setConnections]=useState<Connection[]>([]);
 const [admin,setAdmin]=useState(false),[busy,setBusy]=useState(false),[loaded,setLoaded]=useState(false),[message,setMessage]=useState('');
 const [selected,setSelected]=useState<Record<Kind,string>>({payment:'',pos:''});
 const [values,setValues]=useState<Record<Kind,Record<string,string>>>({payment:{},pos:{}});
 const [editing,setEditing]=useState<Record<Kind,boolean>>({payment:false,pos:false});
 const [draft,setDraft]=useState<Draft|null>(null);
 const endpoint=`/api/owner/business/${businessId}/integrations`;
 async function api(body?:unknown) {
 const token=await getToken();
 const response=await fetch(endpoint,{method:body?'POST':'GET',headers:{Authorization:`Bearer ${token}`,...(body?{'Content-Type':'application/json'}:{})},...(body?{body:JSON.stringify(body)}:{}),cache:'no-store'});
 const data=await response.json();if(!response.ok) throw new Error(data.error||'요청 실패');return data;
 }
 async function load() {const data=await api();setServices(data.services);setConnections(data.connections);setAdmin(data.isAdmin===true);setSelected({payment:data.connections.find((c:Connection)=>c.kind==='payment')?.service_id||'',pos:data.connections.find((c:Connection)=>c.kind==='pos')?.service_id||''});setLoaded(true);}
 useEffect(()=>{let live=true;setLoaded(false);setAdmin(false);setValues({payment:{},pos:{}});api().then(data=>{if(!live)return;setServices(data.services);setConnections(data.connections);setAdmin(data.isAdmin===true);setSelected({payment:data.connections.find((c:Connection)=>c.kind==='payment')?.service_id||'',pos:data.connections.find((c:Connection)=>c.kind==='pos')?.service_id||''});setLoaded(true);}).catch(e=>{if(live)setMessage(e.message);});return()=>{live=false;};},[businessId]); // Token is fetched for each request.
 async function mutate(body:unknown,ok:string) {if(busy)return;setBusy(true);setMessage('');try{await api(body);await load();setValues({payment:{},pos:{}});setEditing({payment:false,pos:false});setDraft(null);setMessage(ok);}catch(e){setMessage(e instanceof Error?e.message:'저장 실패');}finally{setBusy(false);}}
 function edit(s:Service){setDraft({id:s.id,kind:s.kind,code:s.code,name:s.name,enabled:s.enabled,fieldsText:s.fields.map(f=>`${f.key}|${f.label}`).join('\n')});}
 const button="rounded-lg border border-violet-300 bg-white px-3 py-2 text-xs font-bold disabled:opacity-50";
 const input="mt-1 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900";
 return <section className="mt-4 space-y-4 rounded-2xl border-2 border-violet-200 bg-violet-50 p-4 text-gray-900">
 <p className="text-sm font-black">{businessName} · 결제 및 POS 연결 정보</p>
 <p className="text-xs text-gray-600">여기서는 서비스와 계정 정보를 등록합니다. 현재 실제 결제는 아래 기존 Stripe / Square 설정을 사용합니다. 새 POS의 주문 전송은 별도 연동이 완료되어야 작동합니다.</p>
 {message&&<p role="status" className="rounded-lg bg-white p-3 text-sm">{message}</p>}
 {!loaded&&<p className="text-xs">설정을 불러오지 못하면 아래 오류와 DB 설치 여부를 확인하세요.</p>}
 {(['payment','pos'] as Kind[]).map(kind=>{
 const service=services.find(s=>s.id===selected[kind]&&s.kind===kind);
 const saved=connections.find(c=>c.kind===kind);
 const isSaved=saved?.service_id===service?.id&&!!service;
 return <div key={kind} className="rounded-xl bg-white p-4">
 <div className="flex flex-wrap items-center justify-between gap-2"><h3 className="text-sm font-black">{kind==='payment'?'결제 서비스':'주문 받을 POS'}</h3>
 {admin&&<div className="flex gap-2"><button type="button" disabled={busy} className={button} onClick={()=>setDraft({kind,code:'',name:'',enabled:true,fieldsText:'api_key|API Key\nlocation_id|매장 ID'})}>서비스 등록</button><button type="button" className={button} disabled={!service||busy} onClick={()=>service&&edit(service)}>양식 수정</button><button type="button" className={button} disabled={!service||busy} onClick={()=>{if(service&&window.confirm(`${service.name} 서비스를 전체 식당 목록에서 삭제할까요?`))void mutate({action:'deleteService',id:service.id},'서비스 삭제 완료');}}>서비스 삭제</button></div>}
 </div>
 {kind==='payment'&&legacyPayment.configured&&<div className="mt-3 rounded-xl border border-emerald-200 bg-emerald-50 p-3">
 <div className="flex flex-wrap items-center justify-between gap-2"><strong className="text-sm">{businessName} · {legacyPayment.provider==='square'?'Square':'Stripe'} 연결됨</strong><div className="flex gap-2"><button type="button" className={button} disabled={busy} onClick={onEditPayment}>수정</button>{onDeletePayment&&<button type="button" className={button} disabled={busy} onClick={onDeletePayment}>연결 삭제</button>}<button type="button" className={button} onClick={()=>setEditing(p=>({...p,payment:true}))}>추가</button></div></div>
 {legacyPayment.provider==='square'?<dl className="mt-2 space-y-1 text-xs"><div>사업자: {legacyPayment.merchantName||'이름 미제공'}</div><div>Merchant ID: {legacyPayment.merchantId||'미제공'}</div><div>매장: {legacyPayment.locationName||'이름 미제공'}</div><div>Location ID: {legacyPayment.locationId||'미제공'}</div><div>Access Token: •••••••• (저장됨)</div></dl>:<p className="mt-2 text-xs">Secret Key: {legacyPayment.secretMasked||'•••••••• (저장됨)'}</p>}
 <p className="mt-2 text-xs text-emerald-800">이 식당의 기존 결제 설정입니다. 추가 등록 정보와 별도로 현재 결제에 사용됩니다.</p>
 </div>}
 {saved&&<div className="mt-3 rounded-xl border p-3"><div className="flex flex-wrap items-center justify-between gap-2"><strong className="text-sm">{businessName} · {services.find(s=>s.id===saved.service_id)?.name||'비활성 서비스'}</strong><div className="flex gap-2"><button type="button" className={button} onClick={()=>{setSelected(p=>({...p,[kind]:saved.service_id}));setEditing(p=>({...p,[kind]:true}));}}>수정</button><button type="button" className={button} disabled={busy} onClick={()=>{if(window.confirm(`${businessName}의 이 연결 정보를 삭제할까요?`))void mutate({action:'disconnect',kind},'식당 연결 정보 삭제 완료');}}>삭제</button><button type="button" className={button} onClick={()=>setEditing(p=>({...p,[kind]:true}))}>추가</button></div></div><p className="mt-2 text-xs">연결 정보 저장됨 · 값은 숨김 · 실제 동작 검증 전</p></div>}
 {!saved&&!(kind==='payment'&&legacyPayment.configured)&&<div className="mt-3 flex items-center justify-between text-xs"><span>{businessName}의 등록된 {kind==='pos'?'POS':'추가 결제 서비스'} 정보가 없습니다.</span><button type="button" className={button} onClick={()=>setEditing(p=>({...p,[kind]:true}))}>추가</button></div>}
 {editing[kind]&&<>
 <label className="mt-3 block text-xs">서비스 선택<select aria-label={kind==='payment'?'등록된 결제 서비스':'주문 받을 POS'} disabled={busy||!loaded} className={input} value={selected[kind]} onChange={e=>{setSelected(p=>({...p,[kind]:e.target.value}));setValues(p=>({...p,[kind]:{}}));}}><option value="">선택하세요</option>{services.filter(s=>s.kind===kind).map(s=><option key={s.id} value={s.id}>{s.name}{!s.enabled?' (사용 중지)':''}</option>)}</select></label>
 {saved&&<p className="mt-2 text-xs">저장된 서비스: {services.find(s=>s.id===saved.service_id)?.name||'비활성 서비스'} · 연결 정보 저장됨 (동작 검증 전)</p>}
 {service&&<div className="mt-3 space-y-3">
 {service.fields.map(f=><label key={f.key} className="block text-xs font-bold">{f.label}<input type="password" autoComplete="new-password" maxLength={10000} disabled={busy} className={input} value={values[kind][f.key]||''} placeholder={isSaved?'변경할 때만 입력 · 공란은 기존 값 유지':'연결 정보를 입력하세요'} onChange={e=>setValues(p=>({...p,[kind]:{...p[kind],[f.key]:e.target.value}}))}/></label>)}
 <p className="text-xs text-gray-500">값은 서버 전용 DB에 저장하며 화면으로 다시 보내지 않습니다.</p>
 <button type="button" className={button} disabled={busy||!service.enabled} onClick={()=>void mutate({action:'connect',serviceId:service.id,values:values[kind]},'연결 정보 저장 완료. 실제 결제·POS 전송 테스트는 아직 수행되지 않았습니다.')}>{busy?'저장 중...':'연결 정보 저장'}</button>
 </div>}
 {saved&&<button type="button" disabled={busy} className={`${button} mt-3`} onClick={()=>{if(window.confirm('저장된 연결 정보를 삭제할까요?'))void mutate({action:'disconnect',kind},'연결 정보 삭제 완료');}}>연결 정보 삭제</button>}
 <button type="button" className={`${button} mt-3`} onClick={()=>setEditing(p=>({...p,[kind]:false}))}>닫기</button></>}
 </div>;
 })}
 {admin&&draft&&<div role="region" aria-label="서비스 편집" className="space-y-3 rounded-xl border-2 border-violet-400 bg-white p-4">
 <h3 className="font-black">{draft.id?'서비스 수정':'서비스 등록'}</h3>
 <label className="block text-xs">종류<select disabled={!!draft.id||busy} className={input} value={draft.kind} onChange={e=>setDraft({...draft,kind:e.target.value as Kind})}><option value="payment">결제 서비스</option><option value="pos">주문 수신 POS</option></select></label>
 <label className="block text-xs">서비스 코드 (영문 소문자·숫자·밑줄)<input disabled={!!draft.id||busy} className={input} value={draft.code} onChange={e=>setDraft({...draft,code:e.target.value})}/></label>
 <label className="block text-xs">서비스 이름<input disabled={busy} maxLength={100} className={input} value={draft.name} onChange={e=>setDraft({...draft,name:e.target.value})}/></label>
 <label className="block text-xs">입력 항목 (한 줄에 영문키|표시이름)<textarea disabled={busy} rows={5} className={input} value={draft.fieldsText} onChange={e=>setDraft({...draft,fieldsText:e.target.value})}/></label>
 <label className="flex gap-2 text-xs"><input type="checkbox" checked={draft.enabled} onChange={e=>setDraft({...draft,enabled:e.target.checked})}/>오너 선택 목록에 공개</label>
 <p className="text-xs text-gray-600">항목 키를 바꾸면 기존 값은 새 항목으로 이전되지 않습니다. 새 서비스 등록은 결제·주문 전송 기능을 활성화하지 않습니다.</p>
 <div className="flex gap-2"><button type="button" disabled={busy} className={button} onClick={()=>{const fields=draft.fieldsText.split('\n').filter(x=>x.trim()).map(line=>{const [key,...label]=line.split('|');return {key:key.trim(),label:label.join('|').trim()};});void mutate({action:'saveService',id:draft.id,kind:draft.kind,code:draft.code,name:draft.name,enabled:draft.enabled,fields},'서비스 저장 완료');}}>저장</button><button type="button" disabled={busy} className={button} onClick={()=>setDraft(null)}>취소</button></div>
 </div>}
 </section>;
}
