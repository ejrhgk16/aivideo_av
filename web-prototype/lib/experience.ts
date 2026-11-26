import {dramas} from './dramas';
// Device-local demonstration state. Real entitlements require server verification.
export type Entry={id:string;label:string;amount:number;at:string};
// 시청 기록은 장면 단위다. scene은 보던 장면(1~3), done은 끝 카드까지 본 회차다.
export type History={id:string;ep:number;scene:1|2|3;done?:boolean};
export type Experience={balance:number;saved:string[];opened:string[];history:History[];ledger:Entry[];ads:number;adDay:string};
export const today=()=>new Date().toLocaleDateString('en-CA');
export const initialExperience=():Experience=>({balance:4,saved:[],opened:[],history:[],ledger:[{id:'welcome',label:'처음 드리는 포인트',amount:4,at:new Date().toISOString()}],ads:0,adDay:today()});
export const episodeKey=(id:string,ep:number)=>`${id}:${ep}`;
export function unlock(state:Experience,id:string,ep:number,free:number,total:number){
 if(!Number.isInteger(ep)||ep<1||ep>total)return {state,ok:false};
 const key=episodeKey(id,ep);
 if(ep<=free||state.opened.includes(key))return {state,ok:true};
 if(state.balance<10)return {state,ok:false};
 return {ok:true,state:{...state,balance:state.balance-10,opened:[...state.opened,key],ledger:[{id:crypto.randomUUID(),label:`${id} ${ep}화 열기`,amount:-10,at:new Date().toISOString()},...state.ledger]}};
}
export function credit(state:Experience,kind:'ad'|'pack',amount:number):Experience{
 const day=today(); const ads=state.adDay===day?state.ads:0;
 if(kind==='ad'&&ads>=5)return state;
 if((kind==='ad'&&amount!==10)||(kind==='pack'&&![100,300,600].includes(amount)))return state;
 return {...state,balance:state.balance+amount,ads:kind==='ad'?ads+1:ads,adDay:day,ledger:[{id:crypto.randomUUID(),label:kind==='ad'?'광고 보상':'포인트 충전',amount,at:new Date().toISOString()},...state.ledger]};
}
// 예전 기록은 초 단위(time 0~60)로 남아 있다. 읽을 때 장면으로 바꾼다: 20초 미만 1, 40초 미만 2, 60초 미만 3, 60초는 다 봄.
function readHistory(h:unknown):History|null{
 if(!h||typeof h!=='object')return null;const {id,ep,scene,done,time}=h as Record<string,unknown>;
 if(typeof id!=='string'||typeof ep!=='number')return null;
 if(scene===1||scene===2||scene===3)return done===true?{id,ep,scene,done}:{id,ep,scene};
 if(typeof time!=='number'||!Number.isFinite(time)||time<0||time>60)return null;
 return time>=60?{id,ep,scene:3,done:true}:{id,ep,scene:time<20?1:time<40?2:3};
}
export function readExperience(value:string|null):Experience{
 const base=initialExperience();if(!value)return base;
 try{const s=JSON.parse(value);if(!Number.isSafeInteger(s.balance)||s.balance<0||!Array.isArray(s.saved)||!Array.isArray(s.opened)||!Array.isArray(s.history)||!Array.isArray(s.ledger))return base;
 const validEpisode=(id:unknown,ep:unknown)=>dramas.some(d=>d.id===id&&Number.isInteger(ep)&&Number(ep)>0&&Number(ep)<=d.total);
 return {...base,...s,saved:[...new Set<string>(s.saved.filter((x:unknown)=>dramas.some(d=>d.id===x)))],opened:[...new Set<string>(s.opened.filter((x:unknown)=>{if(typeof x!=='string')return false;const [id,ep]=x.split(':');return validEpisode(id,Number(ep))}))],history:s.history.map(readHistory).filter((h:History|null):h is History=>!!h&&validEpisode(h.id,h.ep)),ledger:s.ledger.filter((e:Entry)=>e&&typeof e.id==='string'&&typeof e.label==='string'&&Number.isFinite(e.amount)&&typeof e.at==='string'&&!Number.isNaN(Date.parse(e.at))),ads:s.adDay===today()&&Number.isInteger(s.ads)?Math.min(5,Math.max(0,s.ads)):0,adDay:today()};}catch{return base}
}
