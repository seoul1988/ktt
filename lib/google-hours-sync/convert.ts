export type PeriodTime={day?:number;hour?:number;minute?:number};
export type Period={open?:PeriodTime;close?:PeriodTime};
const LABELS=['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
function valid(time:PeriodTime|undefined){return !!time&&Number.isInteger(time.day)&&time.day!>=0&&time.day!<=6&&Number.isInteger(time.hour)&&time.hour!>=0&&time.hour!<=23&&Number.isInteger(time.minute??0)&&(time.minute??0)>=0&&(time.minute??0)<=59;}
function minutes(time:PeriodTime){return time.hour!*60+(time.minute??0);}
function clock(value:number){const hour=Math.floor(value/60)%24,minute=value%60;return `${hour%12||12}:${String(minute).padStart(2,'0')} ${hour>=12?'PM':'AM'}`;}
/** null means no publishable data; never turn missing or malformed periods into seven closed days. */
export function googlePeriodsToHours(input:unknown):string|null{
 if(input===undefined||input===null)return null;
 if(!Array.isArray(input))throw new Error('Google 영업시간 응답 형식이 올바르지 않아 기존 시간을 유지합니다.');
 if(!input.length)return null;
 const periods=input as Period[];
 const groups=new Map<number,Array<{start:number;end:number}>>();
 if(periods.length===1&&valid(periods[0].open)&&periods[0].open!.day===0&&minutes(periods[0].open!)===0&&!periods[0].close){return [1,2,3,4,5,6,0].map(day=>`${LABELS[day]} 12:00 AM - 12:00 AM`).join('\n');}
 for(const period of periods){
  if(!valid(period.open)||!valid(period.close))throw new Error('Google 영업 구간이 불완전하여 기존 시간을 유지합니다.');
  const start=minutes(period.open!),delta=(period.close!.day!-period.open!.day!+7)%7,end=delta*1440+minutes(period.close!);
  if(end<=start||end-start>1440)throw new Error('지원하지 않는 Google 영업 구간으로 기존 시간을 유지합니다.');
  const group=groups.get(period.open!.day!)||[];group.push({start,end});groups.set(period.open!.day!,group);
 }
 return [1,2,3,4,5,6,0].map(day=>{
  const ranges=(groups.get(day)||[]).sort((a,b)=>a.start-b.start);
  if(!ranges.length)return `${LABELS[day]} Closed`;
  // The existing editor can represent one break per day. Reject more complex schedules instead of inventing hours.
  if(ranges.length>2||(ranges.length===2&&(ranges[0].end>ranges[1].start||ranges[0].end>=1440||ranges[1].end>=1440)))throw new Error('하루 여러 영업 구간을 자동 반영할 수 없어 기존 시간을 유지합니다.');
  const last=ranges[ranges.length-1];
  let result=`${LABELS[day]} ${clock(ranges[0].start)} - ${clock(last.end)}`;
  if(ranges.length===2)result+=` / Break ${clock(ranges[0].end)} - ${clock(ranges[1].start)}`;
  return result;
 }).join('\n');
}
export function newYorkSchedule(now:Date){
 const parts=new Intl.DateTimeFormat('en-US',{timeZone:'America/New_York',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',hourCycle:'h23'}).formatToParts(now);
 const part=(type:string)=>parts.find(item=>item.type===type)?.value||'';
 return {day:`${part('year')}-${part('month')}-${part('day')}`,hour:Number(part('hour'))};
}
