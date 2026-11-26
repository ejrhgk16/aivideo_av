'use client';
import {useEffect,useEffectEvent,useRef,useState,useSyncExternalStore,type ReactNode} from 'react';
import Image from 'next/image';
import RecommendationFeed,{SceneSteps,subscribeMotion,getMotion} from '@/components/recommendation-feed';
import {Play,Search,House,Bookmark,UserRound,ArrowUpRight,ChevronRight,ChevronLeft,X,ArrowRight,LockKeyhole,Layers,Share2,Gift,Wallet,Clock3,HelpCircle,ArrowDownLeft,ArrowUpRight as Out,Clapperboard,Film,CheckCircle2,LoaderCircle,Sun,Moon,Eye,CircleAlert,RotateCcw,Info} from 'lucide-react';
import {Tabs,TabsList,TabsTrigger,TabsContent} from '@/components/ui/tabs';
import {Dialog,DialogContent,DialogTitle,DialogDescription} from '@/components/ui/dialog';
import {Input} from '@/components/ui/input';
import {Button} from '@/components/ui/button';
import {dramas,getDrama,getEpisode,getActs,type Drama,type Scene} from '@/lib/dramas';
import {unlock,credit,episodeKey,today,type Experience} from '@/lib/experience';
import {getSnapshot,getServerSnapshot,subscribe,writeExperience} from '@/lib/local-experience';
import {getTheme,getServerTheme,subscribeTheme,setTheme} from '@/lib/theme';
import {getHintSeen,getServerHintSeen,subscribeHint,dismissHint} from '@/lib/hints';

type Nav='홈'|'빼꼼'|'찾기'|'보관함'|'내 정보'|'포인트';
type Viewer={id:string;ep:number;preview:boolean};
type Pending={id:string;ep:number};
type Modal='detail'|'episodes'|'unlock'|'peek'|'ad'|'pack'|'help'|'about'|'share'|null;
// 알림: 색은 완료(ok)와 주의(warn) 두 가지. info는 완료와 같은 색에 아이콘만 ⓘ로 바꾼 것으로, 이룬 일이 없는 안내(더 갈 화가 없음)에 쓴다. undo가 있으면 '되돌리기' 버튼을 붙인다. n은 같은 문구가 다시 와도 새 알림으로 다루기 위한 번호다.
type Toast={text:string;n:number;tone:'ok'|'info'|'warn';undo?:()=>void};

const PACKS=[{points:100,price:'₩1,100'},{points:300,price:'₩3,300'},{points:600,price:'₩6,600'}];
const navItems=[{label:'홈',icon:House},{label:'빼꼼',icon:Clapperboard},{label:'찾기',icon:Search},{label:'보관함',icon:Bookmark},{label:'내 정보',icon:UserRound}] as const;
// 포인트는 숫자와 P를 붙여 쓴다.
const pt=(n:number)=>`${n.toLocaleString()}P`;
// 찾기는 띄어쓰기와 대소문자를 가리지 않는다.
const norm=(s:string)=>s.replace(/\s+/g,'').toLowerCase();
// 작품 수가 바뀌어도 되도록 목록에서 계산한다. TOP 3은 순위 1~3, 새로 올라온 이야기는 최신 5편.
const byRank=[...dramas].sort((a,b)=>a.rank-b.rank);const top3=byRank.filter(d=>d.rank<=3);const newest=[...dramas].reverse().slice(0,5);
const genres=[...new Set<string>(dramas.map(d=>d.tag))];const genreLeads=dramas.filter((d,i)=>dramas.findIndex(x=>x.tag===d.tag)===i);
const romance=dramas.find(d=>d.tag==='로맨스')??dramas[0];const freeFrom=Math.min(...dramas.map(d=>d.free));const freeTo=Math.max(...dramas.map(d=>d.free));
// 대표 작품의 첫 선택: 보던 작품이 있으면 이어보기·TOP 3과 겹치지 않는 가장 새 작품, 없으면 1위다. 화면을 연 동안 한 번만 고른다.
let heroStart:string|null=null;
const getHeroStart=()=>heroStart??=(()=>{const history=getSnapshot().history;return (history.length?[...dramas].reverse().find(d=>!top3.includes(d)&&!history.some(h=>h.id===d.id)):undefined)?.id??byRank[0].id})();
const getServerHeroStart=()=>byRank[0].id;const subscribeNothing=()=>()=>{};const getServerMotion=()=>false;
type Sort='순위순'|'최신순';
// 회차 격자의 화살표 이동. 좌우는 막을 넘어 앞뒤 화로, 위아래는 같은 열(한 줄 4칸)로, Home·End는 처음·끝 화로 간다.
const GRID_KEYS=['ArrowLeft','ArrowRight','ArrowUp','ArrowDown','Home','End'];
function gridTarget(d:Drama,ep:number,key:string){
 const acts=getActs(d);const a=acts.findIndex(x=>ep>=x.from&&ep<=x.to);if(a<0)return ep;
 const act=acts[a];const i=ep-act.from;const last=act.to-act.from;
 if(key==='ArrowLeft')return Math.max(1,ep-1);if(key==='ArrowRight')return Math.min(d.total,ep+1);if(key==='Home')return 1;if(key==='End')return d.total;
 if(key==='ArrowUp'){if(i>=4)return ep-4;const p=acts[a-1];if(!p)return ep;const n=p.to-p.from;return p.from+Math.min(n,Math.floor(n/4)*4+i%4)}
 if(i+4<=last)return ep+4;if(Math.floor(i/4)<Math.floor(last/4))return act.to;
 const n=acts[a+1];return n?Math.min(n.to,n.from+i%4):ep;
}
// 엿보기 장면: 회차 장면보다 바짝 당긴다. 얼굴(focus)이 자막 위쪽(창 높이의 38%쯤)에 오도록 확대 기준점을 잡되, 그림 밖이 보이지 않게 0~100 안에 둔다.
const peekScene=(d:Drama,ep:number):Scene=>{const s=getEpisode(d,ep).scene;const zoom=s.zoom+.5;return {x:50+(s.x-50)/2,y:Math.round(Math.max(0,Math.min(100,(d.focus*zoom-38)/(zoom-1)))),zoom}};
// 회차의 세 장면: 같은 표지를 장면마다 다른 배율·좌우 위치로 자른다. 첫 장면은 넓게, 둘째는 바짝, 셋째는 그 사이이고 회차마다 조금씩 다르다.
// 얼굴이 자막보다 위(화면 높이의 26~34%)에 오게 확대 기준점을 잡는다.
// 얼굴이 표지 아래쪽에 있으면 그만큼 더 당긴다. FACE는 표지에서 얼굴이 있는 자리(그림 폭·높이의 %)다. 두 사람이 마주 선 표지는 장면 순서대로 둘의 가운데, 한 사람, 다른 사람을 적는다.
// 적지 않은 작품은 가로 50, 세로는 focus로 본다.
const FACE:Partial<Record<string,{x:number;y:number}[]>>={signal:[{x:65,y:16}],season:[{x:54,y:21},{x:72,y:25},{x:36,y:16}],moon:[{x:40,y:27}],apothecary:[{x:36,y:47}],contract:[{x:50,y:28}],summer:[{x:48,y:39}],passbook:[{x:61,y:36}],shadow:[{x:36,y:75}]};
const pct=(n:number)=>Math.round(Math.max(0,Math.min(100,n)));
function storyScene(d:Drama,ep:number,n:number):Scene{
 const s=getEpisode(d,ep).scene;const faces=FACE[d.id]??[{x:50,y:d.focus}];const face=faces[Math.min(n,faces.length)-1];const side=s.x<50?-1:1;
 const tier=[1.2,1.9,1.5][n-1]+(s.zoom-1.25)/4;const zoom=Math.max(tier,60/(100-face.y)+(tier-1.2)/2);
 // 세로로 긴 화면에는 표지의 가운데 69%쯤만 보여서 가로는 그만큼 더 확대된 셈이다.
 const wide=zoom/.69;
 return {x:pct((face.x*wide-(50+[0,8,-8][n-1]*side))/(wide-1)),y:pct((face.y*zoom-[30,34,26][n-1])/(zoom-1)),zoom};
}
// 자막에 이미 따옴표가 있으면 겹치지 않게 벗기고 다시 씌운다.
const quoted=(s:string)=>`“${s.replace(/^“|”$/g,'')}”`;
// 이용 내역 라벨에 적힌 작품 id를 제목으로 바꿀 때 쓴다. 긴 id부터 맞춘다.
const idPattern=new RegExp(dramas.map(d=>d.id).sort((a,b)=>b.length-a.length).join('|'),'g');
// 이어볼 회차·장면과 버튼 문구를 한 곳에서 정한다. 끝까지 본 회차는 다음 화로 넘기고, 마지막 화까지 다 봤으면 다시 보기다.
// progress는 기록에 남은 회차를 얼마나 봤는지로, 진행 막대가 쓴다. 보던 장면 / 4다(끝 카드가 넷째 칸). 셋째 장면은 75%이고 끝까지 본 회차만 100%다.
function resumePoint(d:Drama,history:Experience['history']){
 const h=history.find(x=>x.id===d.id);
 if(!h)return {ep:1,scene:1,progress:0,label:'1화 무료로 보기',note:''};
 if(!h.done)return {ep:h.ep,scene:h.scene,progress:h.scene/4,label:`${h.ep}화 이어보기`,note:`${h.ep}화 · 장면 ${h.scene} / 3`};
 if(h.ep<d.total)return {ep:h.ep+1,scene:1,progress:1,label:`${h.ep+1}화 보기`,note:`${h.ep}화 다 봄 · 다음 ${h.ep+1}화`};
 return {ep:h.ep,scene:1,progress:1,label:`${h.ep}화 다시 보기`,note:'마지막 화까지 다 봄'};
}
// 이용 안내: 할 일 중심의 세 묶음. topic은 화면의 안내 링크가 바로 여는 문항이다.
const HELP=[
 {group:'보기',items:[
  {topic:'names',q:'빼꼼·미리보기·엿보기는 어떻게 다른가요?',a:'빼꼼은 작품을 넘겨 보는 메뉴, 미리보기는 작품마다 있는 1화 예고, 엿보기는 잠긴 회차를 3초 보는 기능이에요.'},
  {topic:'peek',q:'잠긴 회차를 미리 볼 수 있나요?',a:'잠긴 회차를 길게 누르거나 열기 창의 ‘3초 엿보기’를 누르면 포인트 없이 3초 동안 볼 수 있어요.'},
  {topic:'resume',q:'보던 회차는 어디서 찾나요?',a:'홈의 이어보기와 보관함의 시청 기록에 있어요. 둘째 장면까지 본 회차만 남아요. 마지막 화까지 다 본 작품은 이어보기에서 빠지고 시청 기록에만 남아요.'},
  {topic:'next',q:'한 회차가 끝나면 어떻게 되나요?',a:'한 회차는 자막 장면 세 개예요. 셋째 장면을 넘기면 다음 화로 저절로 넘어가지 않고, 재생 화면 아래에 다음 화의 제목과 첫 자막이 나와요. 버튼을 눌러야 이어 봐요. 잠긴 회차는 열기 창에서 확인한 뒤에만 포인트를 써요.'},
  {topic:'touch',q:'휴대폰에서는 어떻게 조작하나요?',a:'잠긴 회차 칸을 길게 누르면 3초 엿보기가 열려요. 빼꼼에서는 위로 밀어 다음 작품으로 넘겨요. 재생 화면에서는 ‘다음 장면’ 버튼으로 넘기고, 맨 아래 세 칸 막대를 눌러 원하는 장면으로 가요. 장면은 저절로 넘어가지 않아요. 오른쪽에 저장·회차·공유, 위쪽에 조작 안내 버튼이 있어요.'},
  {topic:'keys',q:'키보드로 조작할 수 있나요?',a:'재생 화면은 →·Space 다음 장면, ← 이전 장면, Shift+N·Shift+P 다음·이전 화, Esc 닫기예요. 빼꼼은 ↑/↓로 넘겨요. 회차 목록은 화살표 키로 칸을 옮기고 Home·End로 처음·끝 화로 가며, 잠긴 칸에서는 P 키로 엿봐요. 창이 떠 있지 않을 때 / 키를 누르면 찾기 입력란으로 가요.'},
 ]},
 {group:'회차 열기·포인트',items:[
  {topic:'free',q:'어디까지 무료인가요?',a:`작품에 따라 처음 ${freeFrom===freeTo?freeFrom:`${freeFrom}~${freeTo}`}화가 무료예요. 이후 회차는 10P로 열 수 있어요.`},
  {topic:'points',q:'포인트가 모자라면 어떻게 하나요?',a:'광고를 보면 한 번에 10P를 받아요. 하루 5번까지이고 자정에 다시 채워져요. 포인트 화면에서 100·300·600P를 충전할 수도 있어요. 처음에는 4P를 드려요.'},
  {topic:'ad',q:'광고를 중간에 닫으면 어떻게 되나요?',a:'5초가 지나기 전에 닫으면 포인트를 받지 못해요. 끝까지 본 뒤에는 닫아도 10P를 받아요.'},
  {topic:'again',q:'다시 봐도 포인트를 쓰나요?',a:'한 번 연 회차는 이 브라우저에서 다시 무료로 볼 수 있어요.'},
 ]},
 {group:'체험판·기록',items:[
  {topic:'trial',q:'체험판은 무엇이 다른가요?',a:'실제 영상·광고·결제가 연결되지 않았어요. 회차는 영상 대신 표지 그림과 자막 장면 세 개로 보여 드려요. 충전해도 실제로 청구되지 않아요.'},
  {topic:'data',q:'기록은 어디에 저장되나요?',a:'포인트·열린 회차·보관함·시청 기록은 이 브라우저에만 저장돼요. 브라우저 데이터를 지우면 처음으로 돌아가요.'},
  {topic:'history',q:'시청 기록을 지울 수 있나요?',a:'보관함의 시청 기록에서 줄 끝의 × 버튼을 누르면 그 작품의 기록을 지워요. 바로 뜨는 알림의 ‘되돌리기’로 되살릴 수 있어요. 기록을 지워도 이미 연 회차는 그대로 열려 있어요.'},
 ]},
];
function Art({drama,className='',priority=false,scene}:{drama:Drama;className?:string;priority?:boolean;scene?:Scene}){return <Image unoptimized width={1024} height={1536} className={`${className} ${scene?'scene':''}`} style={scene?{'--sx':`${scene.x}%`,'--sy':`${scene.y}%`,'--sz':scene.zoom} as React.CSSProperties:{'--focus':`${drama.focus}%`} as React.CSSProperties} src={`/art/${drama.id}.jpg`} alt={drama.title+(scene?' 장면':' 표지')} loading={priority?'eager':'lazy'} fetchPriority={priority?'high':'auto'}/>}
// page가 붙으면 화면 제목(h1)이다. 화면마다 h1은 하나만 둔다.
function Heading({title,action,onAction,page}:{title:string;action?:string;onAction?:()=>void;page?:boolean}){return <div className="section-heading">{page?<h1>{title}</h1>:<h2>{title}</h2>}{action&&<button className="text-action" onClick={onAction}>{action}<ChevronRight size={15}/></button>}</div>}
type PeekaSlot='logo'|'strip'|'loading'|'loading-egg'|'empty'|'locked';
// 자리마다 public/peeka/<자리>.png 파일을 따로 둔다. 그림을 바꾸려면 같은 이름의 파일만 교체한다. 장식이라 스크린리더에서는 숨긴다.
function Peeka({slot,size,className=''}:{slot:PeekaSlot;size:number;className?:string}){return <Image unoptimized aria-hidden alt="" width={size} height={size} className={`peeka ${className}`} src={`/peeka/${slot}.png`}/>}
// 기다리는 동안 알이 흔들리고, 끝나면(done) 부화한 병아리로 바뀐다.
function Hatching({done}:{done:boolean}){return <span className={`hatching ${done?'done':''}`} aria-hidden><Peeka slot="loading-egg" size={88} className="hatching-egg"/><Peeka slot="loading" size={88} className="hatching-chick"/></span>}
// 대표 영역의 예시 자막. 실제 영상이 아니라 표지 위에서 문구만 보여 준다. 두 줄을 한 번씩 보여 준 뒤 첫 줄에 머문다(끝없이 바뀌지 않게). 작품을 넘기면 다시 한 바퀴 돈다. 모션 줄이기에서는 바꾸지 않고 두 줄을 함께 보여 준다.
function HeroCaption({copy}:{copy:string}){const lines=copy.split('\n');const reduced=useSyncExternalStore(subscribeMotion,getMotion,getServerMotion);const [step,setStep]=useState(0);useEffect(()=>{if(reduced||lines.length<2||step>=lines.length)return;const timer=setTimeout(()=>setStep(n=>n+1),3600);return()=>clearTimeout(timer)},[lines.length,reduced,step]);return <p className="hero-caption" aria-hidden key={reduced?'all':step}>{reduced?copy:lines[step%lines.length]}</p>}
// 체험판 표시는 화면마다 한 번, 로고나 화면 제목 바로 옆 같은 자리에만 둔다. 광고·충전 창만 창 맨 위 가운데에 한 번 더 둔다.
function Trial(){return <span className="trial-tag" title="실제 영상·결제·광고는 연결되지 않은 체험판이에요">체험판</span>}
function PosterCard({drama,badge,onOpen}:{drama:Drama;badge?:string;onOpen:()=>void}){return <button className="poster-card" onClick={onOpen} aria-label={`${drama.title} 작품 소개`}><span className="thumb"><Art drama={drama}/>{badge&&<span className="badge">{badge}</span>}</span><strong>{drama.title}</strong><small>{drama.tag} · {drama.total}부작</small></button>}
function Row({drama,rank,onOpen,trailing}:{drama:Drama;rank?:number;onOpen:()=>void;trailing?:ReactNode}){return <div className="drama-row"><button className="drama-row-main" onClick={onOpen} aria-label={`${rank?`${rank}위 `:''}${drama.title} 작품 소개`}>{rank&&<span className="row-rank">{rank}</span>}<Art drama={drama}/><span className="row-copy"><strong>{drama.title}</strong><span>{drama.copy.replace('\n',' ')}</span></span></button>{trailing}</div>}
function Empty({title,copy,action,onAction}:{title:string;copy:string;action?:string;onAction?:()=>void}){return <div className="empty-state"><Peeka slot="empty" size={96}/><h2>{title}</h2><p>{copy}</p>{action&&<Button className="primary" onClick={onAction}>{action}<ArrowRight size={16}/></Button>}</div>}
function PointSymbol(){return <span className="point-symbol">P</span>}

export default function DramaApp(){
 const [nav,setNav]=useState<Nav>('홈');const [feedRequest,setFeedRequest]=useState({id:'signal',sequence:0});const feedReturn=useRef(false);const [homeTab,setHomeTab]=useState('오늘');const [libraryTab,setLibraryTab]=useState('저장한 작품');
 const [heroId,setHeroId]=useState<string|null>(null);const [detailId,setDetailId]=useState('signal');const [genre,setGenre]=useState('전체');const [query,setQuery]=useState('');const [sort,setSort]=useState<Sort>('순위순');
 const state=useSyncExternalStore(subscribe,getSnapshot,getServerSnapshot);
 // scene: 재생 화면에서 보고 있는 장면(1~3). 4는 셋째 장면 다음의 끝 카드다.
 const [modal,setModalState]=useState<Modal>(null);const [pending,setPending]=useState<Pending|null>(null);const [viewer,setViewer]=useState<Viewer|null>(null);
 const [scene,setScene]=useState(1);const [adSeconds,setAdSeconds]=useState(0);const [pack,setPack]=useState(PACKS[0]);const [toast,setToast]=useState<Toast|null>(null);const [toastHold,setToastHold]=useState(false);
 const [shareUrl,setShareUrl]=useState('');const [shareFailed,setShareFailed]=useState(false);const [sharing,setSharing]=useState(false);const [detailTab,setDetailTab]=useState('소개');const [walletTab,setWalletTab]=useState('충전하기');const [hideResume,setHideResume]=useState(false);const [helpTopic,setHelpTopic]=useState<string|null>(null);const [heroNote,setHeroNote]=useState('');
 // 포인트 화면에 들어오기 전 자리. '돌아가기' 글자와 돌아갈 곳을 여기서 정한다.
 const [walletFrom,setWalletFrom]=useState<{nav:Nav;player:boolean;scrollY:number}>({nav:'내 정보',player:false,scrollY:0});
 const adClaimed=useRef(false);const packClaimed=useRef(false);const previewReturn=useRef<{viewer:Viewer;scene:number}|null>(null);const walletReturn=useRef<{viewer:Viewer;scene:number}|null>(null);const unlockReturn=useRef<Modal>(null);const detailReturn=useRef<Modal>(null);const heroStartId=useSyncExternalStore(subscribeNothing,getHeroStart,getServerHeroStart);const hero=getDrama(heroId??heroStartId);const detail=getDrama(detailId);const viewing=viewer?getDrama(viewer.id):null;
 const helpReturn=useRef<Modal>(null);const shareReturn=useRef<{modal:Modal;scroll:number}|null>(null);const feedFrom=useRef<{nav:Nav;id:string}|null>(null);const mainRef=useRef<HTMLElement>(null);const shareInput=useRef<HTMLInputElement>(null);const storageWarned=useRef(false);
 const theme=useSyncExternalStore(subscribeTheme,getTheme,getServerTheme);
 useEffect(()=>{document.documentElement.dataset.theme=theme},[theme]);
 const hintSeen=useSyncExternalStore(subscribeHint,getHintSeen,getServerHintSeen);const welcomeSeen=useSyncExternalStore(subscribeHint,()=>getHintSeen('welcome'),getServerHintSeen);const [peekRound,setPeekRound]=useState(0);const [peekLine,setPeekLine]=useState(0);
 const peekFrom=useRef<'list'|'unlock'>('unlock');const listReturn=useRef<{focus:string;scroll:number}|null>(null);
 // 회차 격자에서 Tab이 멈추는 칸. 마지막으로 포커스한 칸을 기억한다.
 const [gridAt,setGridAt]=useState<{id:string;ep:number}|null>(null);
 const playerRef=useRef<HTMLDialogElement>(null);const pressTimer=useRef<ReturnType<typeof setTimeout>|null>(null);const longPressed=useRef(false);
 const viewerOpen=!!viewer;
 // 재생 화면: 열리면 포커스를 재생 화면으로 옮기고, 닫히면 재생 화면을 연 버튼으로 돌려준다(start가 적어 둔 playerOpener). 떠 있는 이어보기 막대는 재생 중에 사라졌다 다시 그려지므로 새 막대의 버튼을 찾는다.
 // 작품 소개 창에서 열었으면 창이 다시 열리며 누른 자리를 되살린다(listReturn).
 const playerOpener=useRef<HTMLElement|null>(null);
 useEffect(()=>{if(!viewerOpen)return;const opener=playerOpener.current??(document.activeElement instanceof HTMLElement?document.activeElement:null);playerRef.current?.focus();return()=>{(opener?.isConnected?opener:opener?.classList.contains('resume-main')?document.querySelector<HTMLElement>('.resume-main'):null)?.focus()}},[viewerOpen]);
 // 3초 엿보기: 3초 뒤 잠금 창으로 돌아간다.
 // 엿보기를 회차 목록에서 시작했으면 목록으로, 잠금 창에서 시작했으면 잠금 창으로 돌아간다.
 function finishPeek(){longPressed.current=false;if(peekFrom.current==='list'){const back=unlockReturn.current;unlockReturn.current=null;setPending(null);setModalState(back==='detail'||back==='episodes'?back:null)}else setModalState('unlock')}
 const claimRef=useRef<HTMLButtonElement>(null);const adDone=modal==='ad'&&adSeconds>=5;
 useEffect(()=>{if(adDone)claimRef.current?.focus()},[adDone]);
 // 창의 첫 포커스는 한 가지 규칙이다. 거래 창(잠금·충전)은 주 버튼, 그 밖의 창(작품 소개·회차·이용 안내·앱 정보·공유·엿보기)은 창 자체다(첫 Tab이 첫 버튼으로 간다). 닫기 ×는 기본 자리가 아니다.
 // 광고 창은 주 버튼이 5초 동안 막혀 있어 창 자체에 있다가 끝나면 주 버튼으로 옮긴다. 돌아온 창에서 누른 자리를 되살렸거나(listReturn) 문항을 정해 연 이용 안내처럼 이미 창 안의 자리에 포커스가 있으면 건드리지 않는다.
 // 창이 열린 시각(dealAt)도 적는다. 열린 직후 0.8초 동안은 키보드로 누른 결제·차감을 받지 않는다(창을 연 Enter를 한 번 더 눌러 포인트가 나가지 않게). 마우스·터치는 바로 받는다.
 const unlockRef=useRef<HTMLButtonElement>(null);const canOpen=state.balance>=10;
 const dialogRef=useRef<HTMLDivElement>(null);const dealAt=useRef(0);
 useEffect(()=>{dealAt.current=performance.now()},[modal]);
 const hasty=(e:React.MouseEvent)=>e.detail===0&&performance.now()-dealAt.current<800;
 useEffect(()=>{if(!modal)return;const timer=setTimeout(()=>{if(modal==='unlock'||modal==='pack'){unlockRef.current?.focus();return}const box=dialogRef.current;const at=document.activeElement;if(box&&(!box.contains(at)||at?.classList.contains('dialog-close')))box.focus({preventScroll:true})},80);return()=>clearTimeout(timer)},[modal,canOpen]);
 const onPeekTimeout=useEffectEvent(()=>finishPeek());
 useEffect(()=>{if(modal!=='peek'||window.matchMedia('(prefers-reduced-motion: reduce)').matches)return;const done=setTimeout(()=>onPeekTimeout(),3000);return()=>clearTimeout(done)},[modal,peekRound]);
 // 작품 소개 창으로 돌아오면 보던 위치와 누른 자리(회차 칸, 공유 버튼)를 되살린다.
 useEffect(()=>{if(modal!=='detail'&&modal!=='episodes')return;const back=listReturn.current;if(!back)return;const frame=requestAnimationFrame(()=>{const sheet=document.querySelector<HTMLElement>('.detail-dialog');if(!sheet)return;sheet.scrollTop=back.scroll;sheet.querySelector<HTMLElement>(back.focus)?.focus();listReturn.current=null});return()=>cancelAnimationFrame(frame)},[modal]);
 // 회차 목록을 처음 열면 '보는 중' 회차가 보이게 스크롤한다. 보는 중이 없고 표지가 있는 작품 소개에서 탭을 눌렀으면 목록 첫머리가 붙어 있는 탭 줄 바로 아래에 오게 내린다(회차가 화면 아래에 묻히지 않게). 포커스는 옮기지 않는다.
 useEffect(()=>{if(!(modal==='episodes'||(modal==='detail'&&detailTab==='회차'))||listReturn.current)return;const frame=requestAnimationFrame(()=>{const sheet=document.querySelector<HTMLElement>('.detail-dialog');if(!sheet)return;const current=sheet.querySelector('.episode.current');if(current)current.scrollIntoView({block:'center'});else if(modal==='detail')sheet.querySelector('[data-slot=tabs-content]')?.scrollIntoView({block:'start'});
  // 붙어 있는 ×가 저장·공유 버튼 줄을 덮는 자리에서는 멈추지 않는다. 버튼 줄이 창 위로 다 올라가게 더 내리고, 더 내릴 수 없으면 버튼 줄이 × 아래로 다 나오게 올린다. 창이 열리며 커지는 중이라 화면 좌표가 아니라 배치 좌표(offset)로 잰다.
  const x=sheet.querySelector<HTMLElement>('.dialog-close');const row=sheet.querySelector<HTMLElement>('.detail-actions');if(!x||!row)return;const rowBottom=row.offsetTop+row.offsetHeight;const xBottom=x.offsetTop+x.offsetHeight;if(rowBottom<=x.offsetTop||row.offsetTop>=xBottom)return;
  const before=sheet.scrollTop;sheet.scrollTop=rowBottom;if(sheet.scrollTop<rowBottom-1)sheet.scrollTop=before-(xBottom-row.offsetTop)});return()=>cancelAnimationFrame(frame)},[modal,detailTab]);
 // 주제를 정해 연 이용 안내는 그 문항으로 스크롤하고 포커스를 둔다.
 useEffect(()=>{if(modal!=='help'||!helpTopic)return;const timer=setTimeout(()=>{const heading=document.querySelector<HTMLElement>(`.help-content [data-topic="${helpTopic}"] h3`);heading?.scrollIntoView({block:'start'});heading?.focus({preventScroll:true})},80);return()=>clearTimeout(timer)},[modal,helpTopic]);
 const notify=(text:string,tone:Toast['tone']='ok',undo?:()=>void)=>{setToastHold(false);setToast(t=>({text,tone,undo,n:(t?.n??0)+1}))};
 // 저장 실패는 한 번만, 해결 방법과 함께 알린다. 같은 동작의 완료 알림에 덮이지 않게 한 박자 늦춘다.
 function update(next:Experience){if(!writeExperience(next)&&!storageWarned.current){storageWarned.current=true;setTimeout(()=>notify('이 브라우저에 저장할 수 없어 창을 닫으면 포인트·기록이 처음으로 돌아가요. 브라우저 설정에서 사이트 데이터 저장을 허용해 주세요.','warn'))}}
 // 재생 화면에서 창을 열면 누른 자리를 적어 둔다. 창이 닫히면 그 자리로 포커스를 돌려준다. 작품 소개·회차 창을 새로 열 때는 예전에 적어 둔 돌아올 자리(listReturn)를 지운다(재생 화면을 닫아 창으로 돌아올 때는 setModalState를 직접 쓴다).
 const playerFocus=useRef<HTMLElement|null>(null);
 function setModal(value:Modal){if(value&&!modal&&viewer&&document.activeElement instanceof HTMLElement)playerFocus.current=document.activeElement;if(!modal&&(value==='detail'||value==='episodes'))listReturn.current=null;if(value)setHeroNote('');setModalState(value);if(value==='pack')packClaimed.current=false}
 // 공유 링크(?drama=): 작품 소개를 열고 주소의 질의 문자열은 지운다. 없는 작품이면 알린다.
 // router.replace는 늦게 반영돼 뒤로 가기 표식 뒤에 적용된다. 그래서 창을 열기 전에 history.replaceState로 바로 지운다(vinext가 감싼 함수라 라우터 상태도 함께 맞춰진다).
 const onLink=useEffectEvent(()=>{const p=new URLSearchParams(window.location.search).get('drama');if(!p)return;window.history.replaceState(window.history.state,'',window.location.pathname);if(dramas.some(d=>d.id===p)){setDetailId(p);setModalState('detail')}else notify('링크의 작품을 찾지 못했어요. 아래에서 다른 작품을 둘러보세요.','warn')});
 useEffect(()=>{const id=requestAnimationFrame(()=>onLink());return()=>cancelAnimationFrame(id)},[]);
 // 알림은 3.2초, 주의나 되돌리기가 있으면 6초 보인다. 마우스나 포커스가 올라가 있는 동안은 닫지 않는다.
 useEffect(()=>{if(!toast||toastHold)return;const t=setTimeout(()=>setToast(null),toast.tone==='warn'||toast.undo?6000:3200);return()=>clearTimeout(t)},[toast,toastHold]);
 useEffect(()=>{if(modal!=='ad'||adSeconds>=5)return;const t=setInterval(()=>setAdSeconds(s=>Math.min(5,s+1)),1000);return()=>clearInterval(t)},[modal,adSeconds]);
 // 화면(메뉴·탭·장르)이 바뀌거나 창·재생 화면이 닫혀 포커스를 잃었을 때만 본문으로 옮긴다. 처음 열 때는 돌지 않는다(첫 Tab은 건너뛰기 링크다). 스크롤 위치는 건드리지 않는다.
 const focusKey=`${nav}|${walletTab}|${genre}|${modal}|${viewerOpen}`;const lastFocusKey=useRef(focusKey);
 useEffect(()=>{if(lastFocusKey.current===focusKey)return;lastFocusKey.current=focusKey;if(modal||viewerOpen)return;const timer=setTimeout(()=>{if(document.activeElement===document.body)mainRef.current?.focus({preventScroll:true})},150);return()=>clearTimeout(timer)},[focusKey,modal,viewerOpen]);
 // 메뉴로 홈에 가면 '오늘'부터, 뒤로 가기로 돌아오면(keepTab) 보던 탭(장르 등) 그대로다.
 function go(next:Nav,keepTab=false){if(next==='홈'&&!keepTab)setHomeTab('오늘');if(next!=='포인트')feedReturn.current=false;if(next!=='포인트'&&next!=='빼꼼')feedFrom.current=null;setToast(t=>t?.undo?null:t);setHeroNote('');setNav(next);setModal(null);if(next!=='포인트'){setPending(null);walletReturn.current=null}window.scrollTo({top:0,behavior:'instant'})}
 // 작품 소개에서 빼꼼으로 갔으면 온 자리를 남긴다. 뒤로 가기가 그 작품 소개로 돌려보낸다.
 function openRecommendations(d:Drama){const from=modal==='detail'||modal==='episodes'?{nav,id:d.id}:null;if(viewer)remember(viewer,scene);setViewer(null);previewReturn.current=null;detailReturn.current=null;listReturn.current=null;setFeedRequest(r=>({id:d.id,sequence:r.sequence+1}));go('빼꼼');feedFrom.current=from}
 function watchFromFeed(d:Drama){feedReturn.current=true;start(d)}
 // 찾기로 들어가는 길은 하나다. 장르와 정렬을 정해 들어가고 검색어는 비운다.
 function openSearch(g='전체',order:Sort='순위순'){setGenre(g);setQuery('');setSort(order);go('찾기')}
 // 포인트 화면에서 들어온 화면으로 돌아가고, 그 화면이 그려진 뒤 보던 스크롤 위치를 되살린다(잠금 창을 다시 띄우거나 재생 화면으로 돌아갈 때도 뒤 화면은 보던 자리다).
 function leaveWallet(){setNav(walletFrom.nav);const top=walletFrom.scrollY;requestAnimationFrame(()=>window.scrollTo({top,behavior:'instant'}))}
 function closeModal(){
  if(modal==='peek'){finishPeek();return}
  // 광고를 끝까지 봤으면 받기 버튼을 누르지 않고 닫아도 보상을 준다.
  if(modal==='ad'&&adSeconds>=5&&!adClaimed.current){claimAd();return}
  if(modal==='ad'&&pending){setModal('unlock');return}
  // 이용 안내와 공유 창은 연 곳(잠금 창, 작품 소개)으로 돌아간다.
  if(modal==='help'&&helpReturn.current){const back=helpReturn.current;helpReturn.current=null;setModal(back);return}
  if(modal==='share'){setShareFailed(false);const back=shareReturn.current;shareReturn.current=null;if(back){listReturn.current={focus:'[aria-label="작품 공유"]',scroll:back.scroll};setModal(back.modal);return}}
  if(modal==='unlock'){
   const back=walletReturn.current;walletReturn.current=null;
   // 포인트 화면에 들렀다 왔으면 들어온 화면으로 되돌린다.
   if(nav==='포인트'){leaveWallet();if(back){setViewer(back.viewer);setDetailId(back.viewer.id);setScene(back.scene)}}
   setPending(null);setModal(unlockReturn.current==='detail'||unlockReturn.current==='episodes'?unlockReturn.current:null);unlockReturn.current=null;return}
  setModal(null)}
 function rememberList(ep:number){if(modal!=='detail'&&modal!=='episodes')return;listReturn.current={focus:`[data-ep="${ep}"]`,scroll:document.querySelector<HTMLElement>('.detail-dialog')?.scrollTop??0};setDetailTab('회차')}
 function openPeek(d:Drama,ep:number){if(modal==='unlock'||modal==='peek')peekFrom.current=modal==='unlock'?'unlock':peekFrom.current;else{peekFrom.current='list';unlockReturn.current=modal;rememberList(ep)}setPending({id:d.id,ep});setPeekRound(r=>r+1);setPeekLine(0);setModal('peek');if(!hintSeen)dismissHint()}
 function pressStart(d:Drama,ep:number){longPressed.current=false;pressTimer.current=setTimeout(()=>{longPressed.current=true;openPeek(d,ep)},500)}
 function pressEnd(){if(pressTimer.current)clearTimeout(pressTimer.current)}
 function playerKeys(e:React.KeyboardEvent){
  if(modal)return;const target=e.target as HTMLElement;
  if(e.key==='Tab'){
   // 팝업 안에서만 포커스가 돈다. 처음과 끝에서 반대쪽으로 넘긴다. 끝 카드 묶음처럼 사이에 있는 자리에서는 그대로 앞뒤 버튼으로 간다.
   const items=[...(playerRef.current?.querySelectorAll<HTMLElement>('button:not([disabled]),input:not([disabled]),a[href]')??[])].filter(el=>el.offsetParent!==null);
   if(!items.length)return;const first=items[0];const last=items[items.length-1];const outer=target===playerRef.current;
   if(e.shiftKey&&(target===first||outer)){e.preventDefault();last.focus()}else if(!e.shiftKey&&(target===last||outer)){e.preventDefault();first.focus()}
   return;
  }
  if(e.key==='Escape'){e.preventDefault();closeViewer()}
  else if(e.ctrlKey||e.metaKey||e.altKey)return;
  // Space·→ 다음 장면(셋째 장면에서는 끝 카드), ← 이전 장면. 끝 카드에서 Space는 아무것도 넘기지 않는다. 버튼 위의 Space는 그 버튼만 누른다.
  else if(e.key===' '&&!target.closest('button,a,input')){e.preventDefault();if(!e.repeat&&scene<=3)goScene(scene+1)}
  else if(e.key==='ArrowLeft'||e.key==='ArrowRight'){e.preventDefault();if(!e.repeat)goScene(scene+(e.key==='ArrowLeft'?-1:1))}
  // 글자 키는 한글 입력 상태에서도 되게 e.code로 본다. Shift+N/P 다음·이전 화.
  else if(!e.repeat&&e.shiftKey&&(e.code==='KeyN'||e.code==='KeyP')){e.preventDefault();stepEpisode(e.code==='KeyN'?1:-1)}
 }
 function saved(id:string){return state.saved.includes(id)}
 function toggleSave(id:string){const s=getSnapshot();const exists=s.saved.includes(id);update({...s,saved:exists?s.saved.filter(x=>x!==id):[id,...s.saved]});notify(exists?'저장을 취소했어요.':'보관함에 저장했어요.')}
 // 보관함 목록에서 뺄 때만 '되돌리기'를 붙인다. 줄이 사라지면 포커스를 다음 줄(없으면 이전 줄, 목록이 비면 탭)로 옮긴다.
 function removeSaved(id:string){
  const s=getSnapshot();const index=s.saved.indexOf(id);if(index<0)return;
  update({...s,saved:s.saved.filter(x=>x!==id)});
  requestAnimationFrame(()=>{const rows=document.querySelectorAll<HTMLElement>('.remove-saved');(rows[Math.min(index,rows.length-1)]??document.querySelector<HTMLElement>('.standalone-page [data-slot=tabs-trigger][data-active]'))?.focus()});
  notify('저장을 취소했어요.','ok',()=>{
   const now=getSnapshot();if(!now.saved.includes(id)){const next=[...now.saved];next.splice(Math.min(index,next.length),0,id);update({...now,saved:next})}
   setToast(null);setToastHold(false);requestAnimationFrame(()=>document.querySelectorAll<HTMLElement>('.remove-saved')[index]?.focus())});
 }
 // 시청 기록에서 한 줄 지우기. 저장 취소와 같은 규칙이다: 되돌리기를 붙이고, 포커스는 다음 줄(없으면 이전 줄, 목록이 비면 탭)로 옮긴다. 연 회차와 포인트는 건드리지 않는다.
 function removeHistory(id:string){
  const s=getSnapshot();const index=s.history.findIndex(h=>h.id===id);if(index<0)return;const entry=s.history[index];
  update({...s,history:s.history.filter(h=>h.id!==id)});
  requestAnimationFrame(()=>{const rows=document.querySelectorAll<HTMLElement>('.remove-history');(rows[Math.min(index,rows.length-1)]??document.querySelector<HTMLElement>('.standalone-page [data-slot=tabs-trigger][data-active]'))?.focus()});
  notify('시청 기록에서 지웠어요.','ok',()=>{
   const now=getSnapshot();if(!now.history.some(h=>h.id===id)){const next=[...now.history];next.splice(Math.min(index,next.length),0,entry);update({...now,history:next})}
   setToast(null);setToastHold(false);requestAnimationFrame(()=>document.querySelectorAll<HTMLElement>('.remove-history')[index]?.focus())});
 }
 function showDetail(d:Drama){setDetailId(d.id);setDetailTab('소개');setModal('detail')}
 // 둘째 장면까지 간 회차만 이어보기 지점으로 남긴다. 첫 장면만 열어 본 다른 회차는 보던 지점을 덮어쓰지 않는다. at이 4면 끝까지 본 것이다.
 function remember(v:Viewer,at:number){if(v.preview)return;const s=getSnapshot();if(at<2&&s.history.find(h=>h.id===v.id)?.ep!==v.ep)return;update({...s,history:[at>3?{id:v.id,ep:v.ep,scene:3 as const,done:true}:{id:v.id,ep:v.ep,scene:at as 1|2|3},...s.history.filter(h=>h.id!==v.id)].slice(0,20)})}
 function launch(d:Drama,ep:number,preview=false,at=1){setViewer({id:d.id,ep,preview});setDetailId(d.id);setScene(at);setModal(null);setHeroNote('');setHideResume(false);if(!preview)remember({id:d.id,ep,preview:false},at)}
 // 장면은 누를 때만 바뀐다. 저절로 넘어가지 않는다. 미리보기에는 끝 카드가 없다.
 function goScene(n:number){if(!viewer)return;const next=Math.max(1,Math.min(viewer.preview?3:4,n));if(next===scene)return;setScene(next);remember(viewer,next)}
 function start(d:Drama,ep?:number){if(nav==='빼꼼')feedReturn.current=true;
  // 재생 화면을 여는 버튼을 적어 둔다. 창이 없으면 그 버튼, 작품 소개 창의 주 버튼이면 창이 다시 열릴 때 되살릴 자리(회차 칸은 rememberList가 먼저 적는다).
  if(!viewer){const sheet=modal==='detail'||modal==='episodes';playerOpener.current=!modal&&document.activeElement instanceof HTMLElement?document.activeElement:null;if(sheet&&!listReturn.current)listReturn.current={focus:'.detail-actions .primary',scroll:document.querySelector<HTMLElement>('.detail-dialog')?.scrollTop??0}}
  const s=getSnapshot();const r=resumePoint(d,s.history);const target=ep??r.ep;if(target>d.total||target<1)return;if(target>d.free&&!s.opened.includes(episodeKey(d.id,target))){unlockReturn.current=modal;setPending({id:d.id,ep:target});setModal('unlock');return}if(viewer?.preview)previewReturn.current={viewer,scene};if(!viewer)detailReturn.current=modal==='detail'||modal==='episodes'?modal:null;setPending(null);launch(d,target,false,target===r.ep?r.scene:1)}
 // 이전·다음 화(미리보기에서는 이전·다음 작품). 버튼과 Shift+N/P가 함께 쓴다. 첫 화·마지막 화에서 키를 누르면 더 갈 곳이 없다고 알린다.
 function stepEpisode(step:number){if(!viewer||!viewing)return;if(viewer.preview){const i=dramas.findIndex(d=>d.id===viewing.id);launch(dramas[(i+step+dramas.length)%dramas.length],1,true)}else{const ep=viewer.ep+step;if(ep<1||ep>viewing.total){notify(ep<1?'첫 화예요. 이전 화가 없어요.':'마지막 화예요. 다음 화가 없어요.','info');return}start(viewing,ep)}}
 function confirmUnlock(){if(!pending)return;const d=getDrama(pending.id);const result=unlock(getSnapshot(),d.id,pending.ep,d.free,d.total);if(!result.ok){notify('포인트가 부족해요. 먼저 충전해 주세요.','warn');return}if(viewer?.preview)previewReturn.current={viewer,scene};if(walletReturn.current?.viewer.preview)previewReturn.current=walletReturn.current;update(result.state);if(!viewer)detailReturn.current=unlockReturn.current==='detail'||unlockReturn.current==='episodes'?unlockReturn.current:null;
  // 포인트 화면에 들렀다 왔으면 들어온 화면으로 되돌린 뒤 재생한다.
  if(nav==='포인트')leaveWallet();
  launch(d,pending.ep);walletReturn.current=null;setPending(null);notify(`${pt(10)}로 ${pending.ep}화를 열었어요 · 남은 포인트 ${pt(result.state.balance)}`)}
 function closeViewer(){if(viewer)remember(viewer,scene);if(previewReturn.current&&!viewer?.preview){const back=previewReturn.current;previewReturn.current=null;setViewer(back.viewer);setDetailId(back.viewer.id);setScene(back.scene)}else{setViewer(null);previewReturn.current=null}if(feedReturn.current){setNav('빼꼼');feedReturn.current=false}const sheet=detailReturn.current;detailReturn.current=null;setModalState(sheet)}
 function openWallet(){if(nav!=='포인트')setWalletFrom({nav,player:!!viewer,scrollY:window.scrollY});if(viewer){remember(viewer,scene);walletReturn.current={viewer,scene}}setViewer(null);go('포인트')}
 // 포인트 화면에서 나가면 들어온 화면으로 돌아간다. 열려던 회차가 있으면 잠금 창을, 없으면 보던 위치를 되살린다.
 function returnWallet(){const back=walletReturn.current;walletReturn.current=null;leaveWallet();if(back){setViewer(back.viewer);setDetailId(back.viewer.id);setScene(back.scene)}setModal(pending?'unlock':null)}
 function openAd(){if((getSnapshot().adDay===today()?getSnapshot().ads:0)>=5){notify('오늘 광고 보상 5번을 모두 받았어요. 내일 다시 받을 수 있어요.','warn');return}adClaimed.current=false;setAdSeconds(0);setModal('ad')}
 function claimAd(){if(adSeconds<5||adClaimed.current)return;adClaimed.current=true;update(credit(getSnapshot(),'ad',10));setModal(pending?'unlock':null);notify('10P를 받았어요.')}
 function buyPack(){if(packClaimed.current)return;packClaimed.current=true;update(credit(getSnapshot(),'pack',pack.points));setModal(pending?'unlock':null);notify(`${pack.points}P가 충전됐어요.`)}
 // 기기의 공유 창은 터치 기기에서만 쓴다. 데스크톱 브라우저에서는 공유 창이 뜨지 않거나 창 뒤에 숨은 채 끝나지 않아 버튼이 눌리지 않은 것처럼 보였다. 그래서 늘 앱의 공유 창을 연다.
 async function share(d:Drama){shareReturn.current=modal==='detail'||modal==='episodes'?{modal,scroll:document.querySelector<HTMLElement>('.detail-dialog')?.scrollTop??0}:null;setShareFailed(false);const url=new URL(window.location.origin);url.searchParams.set('drama',d.id);setShareUrl(url.toString());if(navigator.share&&window.matchMedia('(pointer:coarse)').matches){try{await navigator.share({title:d.title+' | peeka',text:d.copy.replace('\n',' '),url:url.toString()});return}catch(e){if((e as Error).name==='AbortError')return}}setModal('share')}
 async function shareFromFeed(d:Drama){setSharing(true);try{await share(d)}finally{setSharing(false)}}
 // 복사가 안 되면 알림 대신 공유 창 안에 띠를 띄우고 링크를 선택해 둔다.
 async function copyLink(){try{await navigator.clipboard.writeText(shareUrl);setShareFailed(false);notify('작품 링크를 복사했어요.')}catch{setShareFailed(true);shareInput.current?.focus();shareInput.current?.select()}}
 // 이용 안내를 주제로 바로 연다. 잠금 창에서 열었으면 닫을 때 그 창으로, 재생 화면에서 열었으면 재생 화면으로 돌아간다.
 function openHelp(topic?:string){helpReturn.current=modal==='unlock'?modal:null;setHelpTopic(topic??null);setModal('help')}
 // 찾기: 검색어는 40자까지 받고, 화면에 되적을 때는 20자에서 줄인다(shown). 검색어만으로 거른 결과(byQuery)를 따로 둔다. 빈 결과의 원인이 검색어인지 장르인지 가려 말하기 위해서다.
 const term=query.trim();const shown=term.length>20?`${term.slice(0,20)}…`:term;const byQuery=(sort==='최신순'?[...dramas].reverse():byRank).filter(d=>norm(d.title+d.description+d.tag+d.mood).includes(norm(query)));const filtered=byQuery.filter(d=>genre==='전체'||d.tag===genre);
 // 이어볼 것이 남은 기록만 홈의 이어보기와 떠 있는 막대에 쓴다. 마지막 화까지 다 본 작품은 빠지고 시청 기록에만 남는다.
 const resumable=state.history.filter(h=>!(h.done&&h.ep>=getDrama(h.id).total));const latest=resumable[0];const adsToday=state.adDay===today()?state.ads:0;
 // 떠 있는 이어보기 막대는 홈(오늘에 이어보기가 있고, 랭킹·장르는 목록을 가리므로), 시청 기록, 빼꼼·포인트에서는 숨긴다.
 const showResume=!!latest&&!hideResume&&!viewer&&nav!=='홈'&&nav!=='빼꼼'&&nav!=='포인트'&&!(nav==='보관함'&&libraryTab==='시청 기록');
 // 창 안에서 바뀌는 상태(주의 띠)는 보이는 글과 같은 문장을 낭독 영역으로도 보낸다. 광고는 시작과 끝만 알리고, 남은 초는 창 설명에 본문색 글자로 적는다.
 const shortNote=modal==='unlock'&&pending&&!canOpen?`포인트가 ${pt(10-state.balance)} 모자라요. ${adsToday>=5?'오늘 광고 보상은 다 받았으니 충전하면 바로 열 수 있어요.':`광고 한 번이면 ${pending.ep}화가 열려요.`}`:'';
 const copyNote=modal==='share'&&shareFailed?'자동 복사가 안 돼서 링크를 선택해 두었어요. 직접 복사해서 보내 주세요.':'';
 // 끝 카드: 셋째 장면을 넘기면 재생 화면 아래에 나온다. 다음 화로 저절로 넘어가지 않고 잠금 창도 띄우지 않는다. nextLocked는 다음 화가 잠겨 있는지다.
 const ended=!!viewer&&!viewer.preview&&scene>3;const endRef=useRef<HTMLElement>(null);const nextRef=useRef<HTMLButtonElement>(null);
 // 지금 장면(끝 카드에서는 셋째 장면의 그림을 그대로 둔다)과 그 회차의 자막 세 줄.
 const at=Math.min(3,scene);const lines=!viewer||!viewing?[]:viewer.preview?[...viewing.copy.split('\n'),'이야기는 이제 시작이다.']:getEpisode(viewing,viewer.ep).lines;
 const sceneNote=viewer&&!modal&&!ended?`장면 ${at} / 3. ${lines[at-1]}`:'';
 const nextLocked=!!viewer&&!!viewing&&viewer.ep<viewing.total&&viewer.ep+1>viewing.free&&!state.opened.includes(episodeKey(viewing.id,viewer.ep+1));
 // 마지막 화의 끝 카드에만 붙는 제안 하나: 아직 시작하지 않은 작품 중 순위가 가장 높은 것. 다 봤으면 없다.
 const suggest=viewer&&viewing&&ended&&viewer.ep>=viewing.total?byRank.find(d=>d.id!==viewing.id&&!state.history.some(h=>h.id===d.id)):undefined;
 // 끝 카드의 주 버튼. 다음 화가 열려 있으면 재생하고, 잠겨 있으면 잠금 창(포인트가 모자라면 광고, 광고를 다 봤으면 충전)으로 간다. 포인트는 잠금 창의 열기 버튼에서만 쓴다.
 function endNext(){if(!viewer||!viewing)return;const ep=viewer.ep+1;if(!nextLocked||canOpen){start(viewing,ep);return}unlockReturn.current=null;setPending({id:viewing.id,ep});if(adsToday>=5)openWallet();else openAd()}
 const endNote=ended&&viewer&&viewing&&!modal?(viewer.ep<viewing.total?`${viewer.ep}화가 끝났어요. 다음은 ${viewer.ep+1}화 ${getEpisode(viewing,viewer.ep+1).title}.${nextLocked?` 잠긴 회차예요. ${pt(10)}, 내 포인트 ${pt(state.balance)}.`:''}`:`마지막 화까지 다 봤어요.${suggest?` 다음으로 볼 작품은 ${suggest.title}.`:''}`):'';
 // 끝 카드가 나오면 어떤 길로 왔든(버튼, → 키, Space, 장면 칸) 끝 카드 묶음으로 포커스를 옮긴다. 닫기 버튼에 남은 포커스로 Tab+Enter를 눌러 재생 화면이 닫히는 일이 없게 하려는 것이다.
 // 그 밖에 장면이 바뀌어 쥐고 있던 버튼이 없어져 포커스를 잃었으면 '다음 장면' 버튼으로 옮긴다. 창을 닫았을 때는 창을 연 자리가 먼저다. 다른 곳에 있던 포커스는 건드리지 않는다.
 // 끝 카드에서는 버튼이 아니라 묶음에 둔다. 같은 키를 이어 눌러도 다음 화 열기까지 넘어가지 않게 하려는 것이다.
 const wasEnded=useRef(false);
 useEffect(()=>{if(!viewerOpen){wasEnded.current=false;return}if(modal)return;const back=playerFocus.current;playerFocus.current=null;const arrived=ended&&!wasEnded.current;wasEnded.current=ended;if(arrived&&!back?.isConnected){endRef.current?.focus();return}if(document.activeElement!==document.body)return;(back?.isConnected?back:ended?endRef.current:nextRef.current??playerRef.current)?.focus()},[ended,scene,viewerOpen,modal]);
 const liveStatus=modal==='ad'?(adSeconds>=5?'광고가 끝났어요. 10P를 받아 가세요.':'광고가 시작됐어요. 5초 뒤에 10P를 받을 수 있어요.'):shortNote||copyNote||endNote||sceneNote||heroNote;
 const watchLabels=Object.fromEntries(state.history.map(h=>[h.id,resumePoint(getDrama(h.id),state.history).label]));
 // '/' 키: 찾기 입력란으로 간다. 글자를 입력하는 중이거나 창·재생 화면이 떠 있을 때는 쓰지 않는다.
 const onSlash=useEffectEvent((e:KeyboardEvent)=>{
  if(e.key!=='/'||e.ctrlKey||e.metaKey||e.altKey||modal||viewer)return;
  if(e.target instanceof HTMLElement&&e.target.closest('input,textarea,select,[contenteditable]'))return;
  e.preventDefault();if(nav!=='찾기')openSearch();
  requestAnimationFrame(()=>document.querySelector<HTMLElement>('.search-input')?.focus());
 });
 useEffect(()=>{const onKey=(e:KeyboardEvent)=>onSlash(e);window.addEventListener('keydown',onKey);return()=>window.removeEventListener('keydown',onKey)},[]);
 const themeLabel=theme==='dark'?'밝은 화면으로 바꾸기':'어두운 화면으로 바꾸기';const backName=walletFrom.player?'재생 화면':walletFrom.nav;
 // 모션 줄이기에서는 엿보기가 저절로 닫히지 않으므로 문구를 바꾼다. 창은 누른 뒤에만 그려져서 여기서 읽어도 된다.
 const stillPeek=modal==='peek'&&window.matchMedia('(prefers-reduced-motion: reduce)').matches;
 // 회차 목록: 막 제목 아래 그 막의 회차를 한 줄로 묶는다. 마지막으로 본 회차는 '보는 중'으로 표시한다.
 // 넓은 화면의 말풍선은 모든 칸에 있고 마지막 줄만 상태에 따라 다르다. 잠긴 칸은 P 키로 엿볼 수 있다.
 // 격자는 Tab 한 번에 들어온다. Tab이 멈추는 칸은 마지막으로 포커스한 칸(없으면 보는 중, 그것도 없으면 1화)이고 나머지는 화살표로 간다.
 const episodeGrid=(d:Drama)=>{const h=state.history.find(h=>h.id===d.id);const inPlayer=!!viewer&&!viewer.preview&&viewer.id===d.id;const watching=inPlayer?viewer.ep:h?.ep;const from=inPlayer?Math.min(3,scene):h&&!h.done?h.scene:1;const stop=gridAt?.id===d.id?gridAt.ep:watching??1;return <div className="episode-acts">{getActs(d).map(act=><section key={act.from} aria-label={`${act.title}, ${act.from}화부터 ${act.to}화`}><div className="act-heading"><h3>{act.title}</h3><small>{act.from}~{act.to}화</small></div><div className="episode-grid">{Array.from({length:act.to-act.from+1},(_,i)=>act.from+i).map(ep=>{const free=ep<=d.free;const opened=state.opened.includes(episodeKey(d.id,ep));const active=watching===ep;const locked=!free&&!opened;const info=getEpisode(d,ep);return <button key={ep} className={`episode ${active?'current':''} ${free||opened?'available':''}`} data-ep={ep} tabIndex={ep===stop?0:-1} onFocus={()=>setGridAt({id:d.id,ep})} onClick={()=>{if(longPressed.current){longPressed.current=false;return}rememberList(ep);start(d,ep)}} onPointerDown={locked?()=>pressStart(d,ep):undefined} onPointerUp={locked?pressEnd:undefined} onPointerLeave={locked?pressEnd:undefined} onContextMenu={locked?e=>e.preventDefault():undefined} onKeyDown={e=>{if(e.ctrlKey||e.metaKey||e.altKey)return;if(locked&&e.code==='KeyP'&&!e.repeat){e.preventDefault();openPeek(d,ep)}else if(GRID_KEYS.includes(e.key)){e.preventDefault();e.currentTarget.closest('.episode-acts')?.querySelector<HTMLElement>(`[data-ep="${gridTarget(d,ep,e.key)}"]`)?.focus()}}} aria-keyshortcuts={locked?'P':undefined} aria-label={`${ep}화 ${info.title}, ${active?'보는 중, ':''}${free?'무료':opened?'열림':'잠김, 10포인트로 열기. 길게 누르거나 P 키로 3초 엿보기'}`}><span>{ep}</span>{active?<small>보는 중</small>:free?<small>무료</small>:opened?<small>열림</small>:<small className="lock-mark"><LockKeyhole size={11}/>10P</small>}<span className="episode-tip" aria-hidden><strong>{ep}화 · {info.title}</strong><span>{info.lines[0]}</span><small>{locked?'누르면 열기 · 길게 누르거나 P 키로 3초 엿보기':active?`보는 중 · 장면 ${from}부터`:'누르면 보기'}</small></span></button>})}</div></section>)}</div>};
 const renderRank=()=> <div className="row-list rank-list">{byRank.map(d=><Row key={d.id} drama={d} rank={d.rank} onOpen={()=>showDetail(d)}/>)}</div>;
 // 뒤로 가기: 열린 층(창, 재생 화면, 홈이 아닌 탭)이 있으면 기록에 표식을 하나 걸어 두고, 뒤로 가기가 오면 맨 위 한 겹만 닫는다.
 const layered=!!modal||viewerOpen||nav!=='홈';const marked=useRef(false);const ignorePop=useRef(false);
 const closeTop=useEffectEvent(()=>{
  if(modal)closeModal();else if(viewer)closeViewer();else if(nav==='포인트')returnWallet();
  else if(nav==='빼꼼'&&feedFrom.current){const back=feedFrom.current;feedFrom.current=null;setNav(back.nav);setDetailId(back.id);setDetailTab('소개');setModalState('detail')}
  else if(nav!=='홈')go('홈',true);
 });
 useEffect(()=>{
  if(layered&&!marked.current){marked.current=true;window.history.pushState({peeka:1},'')}
  // X·Esc로 마지막 층까지 닫혔으면 남은 표식을 지운다. 이때 오는 popstate는 무시한다.
  else if(!layered&&marked.current){marked.current=false;ignorePop.current=true;window.history.back()}
 },[layered,modal,viewerOpen,nav]);
 useEffect(()=>{
  const onPop=(e:PopStateEvent)=>{
   if(ignorePop.current){ignorePop.current=false;return}
   // 표식이 있는 기록에 도착했으면 앞으로 가기다. 아무것도 열거나 닫지 않는다.
   if((e.state as {peeka?:number}|null)?.peeka){marked.current=true;return}
   marked.current=false;closeTop();
  };
  window.addEventListener('popstate',onPop);return()=>window.removeEventListener('popstate',onPop);
 },[]);
 // 스크롤 위치는 앱이 정한다(화면을 옮기면 맨 위, 포인트 화면에서 돌아오면 보던 자리). 브라우저의 스크롤 복원을 켜 두면 표식을 지우는 history.back() 뒤에 예전 위치로 다시 옮겨 버린다.
 useEffect(()=>{window.history.scrollRestoration='manual'},[]);
 // 창을 연 채 새로 고치면 표식이 걸린 기록 위에서 다시 시작한다. 그 표식을 이어 쓴다(또 걸면 다음 뒤로 가기가 한 번 헛돈다).
 useEffect(()=>{if((window.history.state as {peeka?:number}|null)?.peeka)marked.current=true},[]);
 return <div className={`app-shell ${nav==='빼꼼'?'recommend-mode':''} ${showResume?'has-resume':''}`}>
 <a className="skip-link" href="#main" inert={viewerOpen||!!modal} onClick={e=>{e.preventDefault();mainRef.current?.focus()}}>본문으로 건너뛰기</a>
 {/* 알림과 창 안 상태를 읽어 주는 영역. 창이 떠도 가려지지 않게 늘 app-shell 바로 아래에 두고 aria-live를 직접 적는다(role=status만 쓰면 창이 뜰 때 숨겨진다). */}
 <p className="sr-only" aria-live="polite" aria-atomic="true">{toast?.text}{toast?.undo?' 되돌리기 버튼으로 되돌릴 수 있어요.':''}</p>
 <p className="sr-only" aria-live="polite" aria-atomic="true">{liveStatus}</p>
 <header className="topbar" hidden={nav==='빼꼼'} inert={viewerOpen||!!modal}><button className="wordmark" onClick={()=>go('홈')} aria-label="peeka 홈으로"><Peeka slot="logo" size={32} className="logo-mark"/>peeka</button><Trial/><div className="header-actions"><button className="icon-button" onClick={()=>setTheme(theme==='dark'?'light':'dark')} aria-label={themeLabel} title={themeLabel}>{theme==='dark'?<Sun size={20}/>:<Moon size={20}/>}</button><button className="points-pill" onClick={openWallet} aria-label={`보유 ${state.balance}포인트, 충전하기`}>{state.balance.toLocaleString()}<PointSymbol/></button></div></header>
 <nav className="bottom-nav" aria-label="주 메뉴" inert={viewerOpen||!!modal}>{navItems.map(({label,icon:Icon})=>{const active=nav===label||(nav==='포인트'&&label==='내 정보');return <button key={label} className={active?'active':''} onClick={()=>{if(label==='찾기'&&nav!=='찾기')openSearch();else go(label)}} aria-current={active?'page':undefined} aria-keyshortcuts={label==='찾기'?'/':undefined}><Icon size={23} fill={active?'currentColor':'none'}/><span>{label}</span>{label==='찾기'&&<kbd className="nav-key" aria-hidden>/</kbd>}</button>})}</nav>
 <main id="main" ref={mainRef} tabIndex={-1} inert={viewerOpen||!!modal}>
 <RecommendationFeed key={feedRequest.sequence} initialId={feedRequest.id} visible={nav==='빼꼼'} suspended={!!viewer||!!modal||sharing} savedIds={state.saved} watchLabels={watchLabels} onSave={toggleSave} onDetails={showDetail} onEpisodes={d=>{setDetailId(d.id);setModal('episodes')}} onShare={shareFromFeed} onWatch={watchFromFeed}/>
 {nav==='홈'&&<Tabs value={homeTab} onValueChange={v=>setHomeTab(String(v))}><TabsList className="top-tabs">{['오늘','랭킹','장르'].map(t=><TabsTrigger value={t} key={t}>{t}</TabsTrigger>)}</TabsList>
 <TabsContent value="오늘"><section className="hero"><div className="hero-stage"><Art drama={hero} className="hero-image" priority/><div className="hero-shade"/><HeroCaption key={hero.id} copy={hero.copy}/></div><div className="hero-content"><div className="hero-meta"><span>{hero.tag}</span><i/><span>회당 1분</span><i/><span>{hero.total}부작</span><i/><span>{hero.free}화까지 무료</span></div><h1 className="hero-title"><button className="hero-detail" onClick={()=>showDetail(hero)} aria-label={`${hero.title} 작품 소개`}>{hero.title}<ChevronRight size={20}/></button></h1><p className="sr-only">{hero.copy}</p><p className="hero-desc">{hero.description}</p><div className="hero-buttons"><Button className="primary" onClick={()=>start(hero)}><Play size={18} fill="currentColor"/>{resumePoint(hero,state.history).label}</Button><button className={`square-button ${saved(hero.id)?'is-saved':''}`} aria-label="저장" aria-pressed={saved(hero.id)} onClick={()=>toggleSave(hero.id)}><Bookmark size={22} fill={saved(hero.id)?'currentColor':'none'}/></button></div><div className="hero-pagination">{dramas.map((d,i)=><button key={d.id} className={d.id===hero.id?'active':''} onClick={()=>{setHeroId(d.id);setHeroNote(`대표 작품 ${i+1} / ${dramas.length}, ${d.title}`)}} aria-label={`${d.title} 대표 작품으로 보기, ${dramas.length}편 중 ${i+1}번째`} title={d.title} aria-pressed={d.id===hero.id}/>)}<span className="hero-page" aria-hidden>{dramas.findIndex(d=>d.id===hero.id)+1} / {dramas.length}</span></div></div></section>
 <div className="page-content">{!welcomeSeen&&state.ledger.length===1&&state.ledger[0].id==='welcome'&&<div className="status-strip welcome-strip"><Gift size={18}/><p>처음이라 4P를 드렸어요 · 회차 하나는 10P예요</p><button className="icon-button" aria-label="안내 닫기" onClick={()=>{dismissHint('welcome');mainRef.current?.focus({preventScroll:true})}}><X size={18}/></button></div>}<div className="home-grid">{resumable.length>0&&<section className="collection"><Heading title="이어보기" action="전체보기" onAction={()=>{setLibraryTab('시청 기록');go('보관함')}}/><div className="rail">{resumable.map(h=>{const d=getDrama(h.id);const r=resumePoint(d,state.history);return <button className="resume-card" key={h.id} onClick={()=>start(d)} aria-label={`${d.title} ${r.label}`}><span className="thumb wide"><Art drama={d}/><span className="thumb-play"><Play size={16} fill="currentColor"/></span></span><strong>{d.title}</strong><small>{r.note}</small><span className="progress-track"><i style={{width:`${r.progress*100}%`}}/></span></button>})}</div></section>}
 <section className={`collection ${resumable.length>0?'group-start':''}`}><Heading title="지금 눈여겨볼 TOP 3" action="전체보기" onAction={()=>{setHomeTab('랭킹');window.scrollTo({top:0,behavior:'smooth'})}}/><section className="rail rank-rail" aria-label="지금 눈여겨볼 TOP 3, 옆으로 넘겨 볼 수 있어요">{top3.map(d=><button key={d.id} className="rank-item" onClick={()=>showDetail(d)} aria-label={`${d.rank}위 ${d.title} 작품 소개`}><span className="rank-number">{d.rank}</span><span className="rank-card"><span className="thumb"><Art drama={d}/></span><strong>{d.title}</strong></span></button>)}</section></section>
 <button className="peek-strip" onClick={()=>openRecommendations(dramas[0])}><span><strong>빼꼼에서 넘겨보기</strong><small>미리보기로 다음 작품을 골라보세요.</small></span><Peeka slot="strip" size={104}/></button>
 {resumable.length===0&&<section className="collection group-start"><Heading title="새로 올라온 이야기" action="전체보기" onAction={()=>openSearch('전체','최신순')}/><div className="rail">{newest.map((d,i)=><PosterCard key={d.id} drama={d} badge={i===0?'NEW':undefined} onOpen={()=>showDetail(d)}/>)}</div></section>}</div>
 <div className="home-grid">{resumable.length>0&&<section className="collection group-start"><Heading title="새로 올라온 이야기" action="전체보기" onAction={()=>openSearch('전체','최신순')}/><div className="rail">{newest.map((d,i)=><PosterCard key={d.id} drama={d} badge={i===0?'NEW':undefined} onOpen={()=>showDetail(d)}/>)}</div></section>}
 <section className="collection"><Heading title="무료로 시작하기 좋은 이야기" action="전체보기" onAction={()=>openSearch()}/><div className="row-list free-list">{dramas.slice(0,4).map(d=><div className="drama-row" key={d.id}><button className="drama-row-main" onClick={()=>showDetail(d)} aria-label={`${d.title} 작품 소개, ${d.free}화까지 무료`}><Art drama={d}/><span className="row-copy"><strong>{d.title}</strong><span><b>{d.free}화까지 무료</b> · {d.tag} · {d.total}부작</span></span></button></div>)}</div></section>
 {resumable.length===0&&<button className="editorial-banner" onClick={()=>openSearch('로맨스')}><Art drama={romance}/><div className="editorial-shade"/><div><h2>오늘은,<br/>설레도 괜찮아.</h2><p>퇴근길을 채울 로맨스 한 편</p><span className="banner-link">로맨스 만나기 <ChevronRight size={16}/></span></div></button>}</div>
 {resumable.length>0&&<button className="editorial-banner" onClick={()=>openSearch('로맨스')}><Art drama={romance}/><div className="editorial-shade"/><div><h2>오늘은,<br/>설레도 괜찮아.</h2><p>퇴근길을 채울 로맨스 한 편</p><span className="banner-link">로맨스 만나기 <ChevronRight size={16}/></span></div></button>}</div></TabsContent>
 <TabsContent value="랭킹"><div className="page-content tab-page"><h1 className="sr-only">랭킹</h1>{renderRank()}</div></TabsContent>
 <TabsContent value="장르"><div className="page-content tab-page"><h1 className="sr-only">장르</h1><div className="genre-tiles">{genreLeads.map(d=><button key={d.id} onClick={()=>openSearch(d.tag)}><Art drama={d}/><div/><span>{d.tag}<ChevronRight size={22}/></span></button>)}</div></div></TabsContent>
 </Tabs>}
 {nav==='찾기'&&<div className="page-content standalone-page"><Heading title="찾기" page/><div className="search-field"><Search size={21}/><Input className="search-input" placeholder="작품명, 장르로 찾아보세요" value={query} maxLength={40} onChange={e=>setQuery(e.target.value)} aria-label="작품 검색" aria-keyshortcuts="/"/>{query&&<button className="icon-button" onClick={()=>{setQuery('');document.querySelector<HTMLElement>('.search-input')?.focus()}} aria-label="검색어 지우기"><X size={18}/></button>}</div><section className="filter-chips" aria-label="장르">{['전체',...genres].map(g=><button className={genre===g?'active':''} onClick={()=>setGenre(g)} aria-pressed={genre===g} key={g}>{g}</button>)}</section><div className="results-label"><span aria-live="polite" aria-atomic="true">{term?(genre==='전체'?`‘${shown}’ 검색 결과`:`‘${shown}’ · ${genre}`):genre==='전체'?'모든 작품':genre} · {filtered.length}편</span><section className="sort-toggle" aria-label="정렬">{(['순위순','최신순'] as const).map((s,i)=><span key={s}>{i>0&&<i aria-hidden>·</i>}<button className={sort===s?'active':''} aria-pressed={sort===s} onClick={()=>setSort(s)}>{s}</button></span>)}</section></div>{filtered.length?<div className="row-list">{filtered.map(d=><Row key={d.id} drama={d} onOpen={()=>showDetail(d)}/>)}</div>:byQuery.length?<Empty title={`${genre} 장르에는 ‘${shown}’ 검색 결과가 없어요`} copy={`전체 장르에는 ${byQuery.length}편 있어요.`} action="전체 장르에서 보기" onAction={()=>setGenre('전체')}/>:<Empty title={`‘${shown}’에 맞는 작품이 없어요`} copy="작품명이나 장르로 찾을 수 있어요." action="검색어 지우기" onAction={()=>{setQuery('');document.querySelector<HTMLElement>('.search-input')?.focus()}}/>}</div>}
 {nav==='보관함'&&<div className="page-content standalone-page"><Heading title="보관함" page/><Tabs value={libraryTab} onValueChange={v=>setLibraryTab(String(v))}><TabsList className="detail-tabs" variant="line">{['저장한 작품','시청 기록'].map(t=><TabsTrigger key={t} value={t}>{t}<span>{t==='저장한 작품'?state.saved.length:state.history.length}</span></TabsTrigger>)}</TabsList><TabsContent value="저장한 작품">{state.saved.length?<div className="row-list">{state.saved.map(id=><Row key={id} drama={getDrama(id)} onOpen={()=>showDetail(getDrama(id))} trailing={<button className="icon-button remove-saved" aria-label={getDrama(id).title+' 저장 취소'} title="저장 취소" onClick={()=>removeSaved(id)}><Bookmark size={19} fill="currentColor"/></button>}/>)}</div>:<Empty title="다음에 볼 작품을 담아보세요" copy="작품의 저장 버튼을 누르면 여기에 모아드려요." action="작품 둘러보기" onAction={()=>go('홈')}/>}</TabsContent><TabsContent value="시청 기록">{state.history.length?<div className="history-list">{state.history.map(h=>{const d=getDrama(h.id);const r=resumePoint(d,state.history);return <div className="history-item" key={h.id}><button className="history-row" onClick={()=>start(d)} aria-label={`${d.title} ${r.label}`}><Art drama={d}/><div><h2>{d.title}</h2><p>{r.note}</p><div className="progress-track"><i style={{width:`${r.progress*100}%`}}/></div></div><Play size={20} fill="currentColor"/></button><button className="icon-button remove-history" aria-label={`${d.title} 시청 기록 지우기`} title="시청 기록 지우기" onClick={()=>removeHistory(h.id)}><X size={19}/></button></div>})}</div>:<Empty title="첫 작품을 시작해 볼까요?" copy="보다 멈춘 회차도 여기서 이어볼 수 있어요." action="작품 둘러보기" onAction={()=>go('홈')}/>}</TabsContent></Tabs></div>}
 {nav==='내 정보'&&<div className="page-content standalone-page account-page"><Heading title="내 정보" page/><div className="profile-block"><div className="avatar"><UserRound size={29}/></div><div><h2>게스트</h2><p>기록은 이 브라우저에만 저장돼요</p></div></div><button className="wallet-card" onClick={openWallet}><div><span>내 포인트</span><strong>{state.balance.toLocaleString()}<small>P</small></strong></div><span className="wallet-link">충전하기 <ArrowRight size={18}/></span></button><div className="account-menu"><button onClick={()=>{setWalletTab('이용 내역');openWallet()}}><Wallet size={21}/><span>포인트 이용 내역</span><ChevronRight size={17}/></button><button onClick={()=>{setLibraryTab('시청 기록');go('보관함')}}><Clock3 size={21}/><span>시청 기록</span><ChevronRight size={17}/></button><button onClick={()=>openHelp()}><HelpCircle size={21}/><span>이용 안내</span><ChevronRight size={17}/></button><button onClick={()=>setModal('about')}><Film size={21}/><span>앱 정보</span><ChevronRight size={17}/></button></div></div>}
 {nav==='포인트'&&<div className="page-content standalone-page wallet-page"><button className="back-link" onClick={returnWallet} aria-label={`${backName}${walletFrom.player?'':' 화면'}으로 돌아가기`}><ChevronLeft size={19}/>{backName}</button><Heading title="포인트" page/><div className="balance-panel"><span>사용 가능한 포인트</span><strong>{state.balance.toLocaleString()}<small>P</small></strong></div>{pending&&<button className="pending-row" onClick={()=>setModal('unlock')}><LockKeyhole size={18}/><span>{getDrama(pending.id).title} {pending.ep}화 열기</span><ChevronRight size={17}/></button>}<Tabs value={walletTab} onValueChange={v=>setWalletTab(String(v))}><TabsList className="detail-tabs" variant="line"><TabsTrigger value="충전하기">충전하기</TabsTrigger><TabsTrigger value="이용 내역">이용 내역</TabsTrigger></TabsList><TabsContent value="충전하기"><button className="reward-card" onClick={openAd} aria-disabled={adsToday>=5||undefined}><span className="reward-icon"><Gift size={25}/></span><span><strong>광고 보고 10P 받기</strong><small>{adsToday>=5?'오늘 5번 모두 받았어요 · 내일 다시 받을 수 있어요':`오늘 ${5-adsToday}번 남음`}</small></span>{adsToday<5&&<span className="reward-amount"><ChevronRight size={16}/></span>}</button><div className="pack-list">{PACKS.map(p=><button key={p.points} onClick={()=>{setPack(p);setModal('pack')}}><span className="pack-left"><strong>{p.points.toLocaleString()}<small>P</small></strong></span><span className="pack-price">{p.price}</span></button>)}</div><div className="wallet-explainer"><CheckCircle2 size={17}/><p>한 번 연 회차는 다시 볼 때 무료예요.</p></div><button className="text-action help-link" onClick={()=>openHelp('points')}>포인트 받는 방법</button></TabsContent><TabsContent value="이용 내역">{state.ledger.length?<div className="ledger">{state.ledger.map(e=><div className="ledger-row" key={e.id}><span className={`ledger-icon ${e.amount>0?'positive':''}`}>{e.amount>0?<ArrowDownLeft size={19}/>:<Out size={19}/>}</span><div><strong>{e.label.replace(idPattern,id=>getDrama(id).title).replace(/ 체험$/,'')}</strong><small>{new Date(e.at).toLocaleDateString('ko-KR',{month:'long',day:'numeric'})} · {new Date(e.at).toLocaleTimeString('ko-KR',{hour:'numeric',minute:'2-digit'})}</small></div><b className={e.amount>0?'positive':''}>{e.amount>0?'+':''}{pt(e.amount)}</b></div>)}</div>:<Empty title="아직 이용 내역이 없어요" copy="받거나 사용한 포인트를 여기서 확인할 수 있어요."/>}</TabsContent></Tabs></div>}
 </main>
 {showResume&&latest&&<div className="resume-bar" inert={viewerOpen||!!modal}><button className="resume-main" onClick={()=>start(getDrama(latest.id))}><Art drama={getDrama(latest.id)}/><div><strong>{getDrama(latest.id).title}</strong><span>{resumePoint(getDrama(latest.id),state.history).label}</span></div><Play size={18} fill="currentColor"/></button><button className="icon-button" aria-label="이어보기 닫기" onClick={()=>{setHideResume(true);mainRef.current?.focus({preventScroll:true})}}><X size={16}/></button><div className="resume-progress" style={{width:`${resumePoint(getDrama(latest.id),state.history).progress*100}%`}}/></div>}
 

 {viewer&&viewing&&<dialog open className="player-overlay" aria-modal="true" aria-label={`${viewing.title} ${viewer.preview?'미리보기':`${viewer.ep}화`} 재생`} ref={playerRef} tabIndex={-1} onKeyDown={playerKeys}><div className="player-stage"><Art key={`art${at}`} drama={viewing} scene={viewer.preview?undefined:storyScene(viewing,viewer.ep,at)} className="player-poster" priority/><div className="player-vignette"/><div className="player-top"><button className="icon-button" aria-label="재생 화면 닫기" aria-keyshortcuts="Escape" onClick={closeViewer}><ChevronLeft size={27}/></button>{viewer.preview?<span className="peek-chip">미리보기</span>:<span className="main-label">{viewer.ep}화 <small>/ {viewing.total}화</small></span>}<Trial/><div className="player-top-right"><button className="icon-button" aria-label="조작 안내" title="조작 안내" onClick={()=>openHelp('touch')}><HelpCircle size={24}/></button></div></div><div className="player-side"><button onClick={()=>toggleSave(viewing.id)} aria-pressed={saved(viewing.id)}><Bookmark size={27} fill={saved(viewing.id)?'currentColor':'none'} className={saved(viewing.id)?'positive':''}/><span>저장</span></button><button onClick={()=>{setDetailId(viewing.id);setModal('episodes')}}><Layers size={29}/><span>회차</span></button><button onClick={()=>share(viewing)}><Share2 size={26}/><span>공유</span></button></div>{!ended&&<p className="sample-subtitle" key={at}>{lines[at-1]}</p>}<div className="player-bottom">{ended?<section className="end-card" ref={endRef} tabIndex={-1} aria-label={`${viewer.ep}화 끝`}><small>{viewer.ep}화 끝</small>{viewer.ep<viewing.total?<><strong>다음 · {viewer.ep+1}화 {getEpisode(viewing,viewer.ep+1).title}</strong><p>{quoted(getEpisode(viewing,viewer.ep+1).lines[0])}</p>{nextLocked&&<small className="end-cost">{viewer.ep+1}화 · {pt(10)} · 내 포인트 {pt(state.balance)}</small>}<Button className="primary player-cta" onClick={endNext}>{!nextLocked?<><Play size={17} fill="currentColor"/>{viewer.ep+1}화 보기</>:canOpen?<>10P로 {viewer.ep+1}화 열기<ArrowRight size={17}/></>:adsToday>=5?<>포인트 충전하기<ArrowRight size={17}/></>:<><Gift size={18}/>광고 보고 10P 받기</>}</Button>{nextLocked&&<button className="end-action" onClick={()=>openPeek(viewing,viewer.ep+1)}><Eye size={17}/>3초 엿보기</button>}</>:<><strong>마지막 화까지 다 봤어요</strong>{suggest&&<><small className="end-cost">다음으로 볼 작품</small><button className="end-action" onClick={()=>showDetail(suggest)} aria-label={`다음으로 볼 작품, ${suggest.title} 작품 소개`}>{suggest.title}<ChevronRight size={17}/></button></>}<button className="end-action" onClick={()=>goScene(1)}><RotateCcw size={17}/>처음부터 다시 보기</button></>}</section>:<><button className="player-title" onClick={()=>showDetail(viewing)}>{viewer.preview?viewing.title:getEpisode(viewing,viewer.ep).title}<ChevronRight size={22}/></button><p>{viewer.preview?`${viewing.tag} · 미리보기`:`${viewing.title} · ${viewing.tag}`}</p>{viewer.preview?<><Button className="primary player-cta" onClick={()=>start(viewing)}><Play size={17} fill="currentColor"/>{resumePoint(viewing,state.history).label}</Button><div className="preview-controls"><button onClick={()=>stepEpisode(-1)}><ChevronLeft size={16}/>이전 작품</button><button onClick={()=>stepEpisode(1)}>다음 작품<ChevronRight size={16}/></button></div></>:<><div className="scene-controls">{scene>1&&<button className="scene-prev" aria-keyshortcuts="ArrowLeft" onClick={()=>goScene(scene-1)}><ChevronLeft size={16}/>이전 장면</button>}<Button className="primary player-cta" ref={nextRef} aria-keyshortcuts="ArrowRight Space" onClick={()=>goScene(scene+1)}>다음 장면<ChevronRight size={17}/></Button></div><div className="episode-controls"><button disabled={viewer.ep===1} aria-keyshortcuts="Shift+P" onClick={()=>stepEpisode(-1)}><ChevronLeft size={16}/>이전 화</button><button disabled={viewer.ep===viewing.total} aria-keyshortcuts="Shift+N" onClick={()=>stepEpisode(1)}>다음 화<ChevronRight size={16}/></button></div></>}</>}<SceneSteps at={scene} onGo={goScene}/></div></div><aside className="player-desktop-info"><h2>{viewing.title}</h2><p>{viewing.description}</p><div className="inline-meta"><span>{viewing.tag}</span><span>{viewing.free}화까지 무료</span><span>회당 1분</span></div><Button className="secondary" onClick={()=>{setDetailId(viewing.id);setModal('episodes')}}><Layers size={18}/>전체 회차 보기</Button><p className="player-keys">→·Space 다음 장면 · ← 이전 장면 · Shift+N/P 다음·이전 화 · Esc 닫기</p></aside></dialog>}

 <Dialog open={!!modal} onOpenChange={o=>{if(!o)closeModal()}} disablePointerDismissal={modal==='ad'&&adSeconds<5}><DialogContent ref={dialogRef} initialFocus={modal==='unlock'||modal==='pack'?unlockRef:dialogRef} className={`app-dialog ${modal==='detail'||modal==='episodes'?'detail-dialog':''} ${modal==='unlock'||modal==='ad'||modal==='pack'?'deal-dialog':''} ${modal==='peek'?'peek-dialog':''}`} showCloseButton={false}><button className="dialog-close icon-button" onClick={closeModal} aria-label="닫기"><X size={20}/></button>
 {(modal==='detail'||modal==='episodes')&&<>{modal==='detail'&&<div className="detail-hero"><Art drama={detail}/><div/></div>}<div className="detail-heading"><DialogTitle>{detail.title}</DialogTitle><DialogDescription>{detail.tag} · {detail.total}부작 · 회당 1분</DialogDescription><div className="detail-free"><CheckCircle2 size={15}/>{detail.free}화까지 무료 · 이후 회차당 10P · 연 회차는 다시 무료</div></div><div className="detail-actions"><Button className="primary" onClick={()=>start(detail)}><Play size={17} fill="currentColor"/>{resumePoint(detail,state.history).label}</Button><button className={`square-button ${saved(detail.id)?'is-saved':''}`} onClick={()=>toggleSave(detail.id)} aria-label="저장" aria-pressed={saved(detail.id)}><Bookmark size={21} fill={saved(detail.id)?'currentColor':'none'}/></button><button className="square-button" onClick={()=>share(detail)} aria-label="작품 공유"><Share2 size={18}/></button></div><Tabs value={modal==='episodes'?'회차':detailTab} onValueChange={v=>{setDetailTab(String(v));if(modal==='episodes')setModal('detail')}}><TabsList className="detail-tabs" variant="line"><TabsTrigger value="소개">작품 소개</TabsTrigger><TabsTrigger value="회차">전체 회차 <span>{detail.total}</span></TabsTrigger></TabsList><TabsContent value="소개"><p className="synopsis">{detail.description}</p><button className="preview-text-link" onClick={()=>openRecommendations(detail)}><Clapperboard size={18}/>빼꼼에서 미리보기<ChevronRight size={16}/></button><div className="production"><span>제작</span><strong>{detail.studio}</strong><span>콘텐츠</span><strong>AI 제작 드라마 · 예시 작품</strong></div></TabsContent><TabsContent value="회차" tabIndex={-1}>{hintSeen?<p className="episode-explainer">잠긴 회차는 길게 눌러 3초 엿보기<span className="wide-only"> · 칸에서 P 키로도 볼 수 있어요</span><span className="wide-only episode-keys">←/→/↑/↓ 칸 이동 · Home/End 처음·끝 화</span></p>:<div className="status-strip peek-hint"><Eye size={18}/><p>잠긴 회차는 누르면 열기, 길게 누르면 3초 엿보기예요.<span className="wide-only"> 마우스를 올리면 회차 제목이 보이고, P 키로도 엿볼 수 있어요. 화살표 키로 칸을 옮겨요.</span></p><button onClick={()=>dismissHint()}>알겠어요</button></div>}{episodeGrid(detail)}</TabsContent></Tabs></>}
 {modal==='unlock'&&pending&&<><Peeka slot={canOpen?'loading':'locked'} size={88} className="modal-peeka"/><DialogTitle>{pending.ep}화 열기</DialogTitle><DialogDescription>{getDrama(pending.id).title} · {getEpisode(getDrama(pending.id),pending.ep).title}</DialogDescription><div className="unlock-summary"><div><span>이번 회차</span><strong>{pt(10)}</strong></div><div><span>내 포인트</span><strong>{pt(state.balance)}</strong></div>{canOpen&&<div className="summary-total"><span>사용 후 잔액</span><strong>{pt(state.balance-10)}</strong></div>}</div>{!canOpen&&<div className="status-strip warn"><CircleAlert size={18}/><span>{shortNote}</span></div>}{canOpen?<><Button className="primary full" ref={unlockRef} onKeyDown={e=>{if(e.repeat)e.preventDefault()}} onClick={e=>{if(!hasty(e))confirmUnlock()}}>10P로 {pending.ep}화 열기<ArrowRight size={17}/></Button><Button className="secondary full" onClick={()=>openPeek(getDrama(pending.id),pending.ep)}><Eye size={17}/>3초 엿보기</Button></>:adsToday>=5?<><Button className="primary full" ref={unlockRef} onClick={openWallet}>포인트 충전하기<ArrowRight size={17}/></Button><Button className="secondary full" onClick={()=>openPeek(getDrama(pending.id),pending.ep)}><Eye size={17}/>먼저 3초 엿보기</Button></>:<><Button className="primary full" ref={unlockRef} onClick={openAd}><Gift size={18}/>광고 보고 10P 받기</Button><Button className="secondary full" onClick={()=>openPeek(getDrama(pending.id),pending.ep)}><Eye size={17}/>먼저 3초 엿보기</Button></>}<div className="unlock-links">{!canOpen&&adsToday<5&&<><button className="text-action help-link" onClick={openWallet}>포인트 충전하기</button><i aria-hidden>·</i></>}<button className="text-action help-link" onClick={()=>openHelp('points')}>포인트 받는 방법</button></div><p className="modal-fineprint">{canOpen&&<>열기 버튼을 누를 때만 포인트를 사용해요.<br/></>}한 번 연 회차는 다시 볼 때 무료예요.</p></>}
 {modal==='peek'&&pending&&<><div className="peek-window" key={peekRound}><Art drama={getDrama(pending.id)} scene={peekScene(getDrama(pending.id),pending.ep)}/><div className="peek-lines"><p>{getEpisode(getDrama(pending.id),pending.ep).lines[peekLine%3]}</p><p>{getEpisode(getDrama(pending.id),pending.ep).lines[(peekLine+1)%3]}</p></div><i/></div><DialogTitle>{pending.ep}화 엿보기 · {getEpisode(getDrama(pending.id),pending.ep).title}</DialogTitle><DialogDescription>{getDrama(pending.id).title} · {stillPeek?'다 보면 ‘그만 보기’를 눌러 주세요.':'3초만 살짝 엿봐요.'} 포인트는 쓰지 않아요.</DialogDescription><div className="peek-actions"><Button className="secondary" onClick={()=>{setPeekRound(r=>r+1);setPeekLine(n=>n+2)}}>{stillPeek?'다음 장면 보기':'3초 더 보기'}</Button><Button className="ghost" onClick={finishPeek}>그만 보기</Button></div></>}
 {modal==='ad'&&<><Trial/><Hatching done={adSeconds>=5}/><DialogTitle>광고 보고 10P 받기</DialogTitle><DialogDescription>{adSeconds>=5?'광고가 끝났어요. 10P를 받아 가세요.':pending?`광고를 5초 보면 10P를 받고 ‘${getDrama(pending.id).title}’ ${pending.ep}화 열기로 돌아가요.`:'광고를 5초 보면 10P를 받을 수 있어요.'}{adSeconds<5&&<> <b>{5-adSeconds}초 남음</b></>}</DialogDescription><progress className="sr-only" aria-label="광고 진행" value={adSeconds} max={5}/><div className="ad-progress" aria-hidden><i style={{width:`${adSeconds/5*100}%`}}/></div><Button className="primary full" ref={claimRef} disabled={adSeconds<5} onClick={claimAd}>{adSeconds<5?<><LoaderCircle className="spinner" size={16}/>{5-adSeconds}초 후 10P 받기</>:<><Gift size={17}/>10P 받기</>}</Button><p className="modal-fineprint">{adSeconds<5?'5초가 지나기 전에 닫으면 포인트가 지급되지 않아요.':'지금 닫아도 10P를 받아요.'}</p></>}
 {modal==='pack'&&<><Trial/><div className="modal-symbol"><Wallet size={40}/></div><DialogTitle>{pack.points}P를 충전할까요?</DialogTitle><DialogDescription>{pending?`충전하면 ‘${getDrama(pending.id).title}’ ${pending.ep}화 열기로 돌아가요.`:'다음 회차를 바로 이어볼 수 있어요.'}</DialogDescription><div className="unlock-summary"><div><span>선택한 포인트</span><strong>{pt(pack.points)}</strong></div><div><span>가격</span><strong>{pack.price}</strong></div><div className="summary-total"><span>충전 후 잔액</span><strong>{pt(state.balance+pack.points)}</strong></div></div><Button className="primary full" ref={unlockRef} onKeyDown={e=>{if(e.repeat)e.preventDefault()}} onClick={e=>{if(!hasty(e))buyPack()}}>{pack.points}P 충전하기</Button></>}
 {modal==='help'&&<><DialogTitle>이용 안내</DialogTitle><div className="help-content">{HELP.map(g=><section key={g.group} aria-label={g.group}><p className="help-group">{g.group}</p>{g.items.map(item=><div key={item.topic} data-topic={item.topic} data-active={helpTopic===item.topic||undefined}><h3 tabIndex={-1}>{item.q}</h3><p>{item.a}</p></div>)}</section>)}</div></>}
 {modal==='about'&&<><div className="wordmark static-wordmark"><Peeka slot="logo" size={40} className="logo-mark"/>peeka</div><DialogTitle>앱 정보</DialogTitle><DialogDescription>모바일 앱 디자인 체험 · 1.0</DialogDescription><p className="synopsis">작품을 고르고, 다음 회차를 열고, 취향을 보관하는 AI 드라마 앱입니다. 표지는 AI로 새로 제작한 콘셉트 이미지이며, 실제 영상·결제·광고는 아직 연결되지 않았어요.</p><div className="production"><span>글꼴</span><strong>Pretendard Variable</strong><span>기록 저장</span><strong>현재 브라우저</strong></div><a className="text-action" href="/fonts/LICENSE.txt" target="_blank" rel="noreferrer">글꼴 이용 안내<ArrowUpRight size={14}/></a></>}
 {modal==='share'&&<><DialogTitle>작품 공유</DialogTitle><DialogDescription>링크를 보내면 같은 작품 소개를 볼 수 있어요.</DialogDescription><Input className="share-input" ref={shareInput} value={shareUrl} readOnly onFocus={e=>e.target.select()} aria-label="공유 링크"/>{shareFailed&&<div className="status-strip warn"><CircleAlert size={18}/><span>{copyNote}</span></div>}<Button className="primary full" onClick={copyLink}>링크 복사하기</Button></>}
 </DialogContent></Dialog>
 {toast&&<div className={`app-toast ${toast.tone==='warn'?'warn':''} ${modal?'over-dialog':''}`} aria-hidden={toast.undo?undefined:true} onPointerEnter={()=>setToastHold(true)} onPointerLeave={()=>setToastHold(false)} onFocus={()=>setToastHold(true)} onBlur={()=>setToastHold(false)}>{toast.tone==='warn'?<CircleAlert size={18}/>:toast.tone==='info'?<Info size={18}/>:<CheckCircle2 size={18}/>}<span>{toast.text}</span>{toast.undo&&<button onClick={toast.undo}>되돌리기</button>}</div>}
 </div>
}





