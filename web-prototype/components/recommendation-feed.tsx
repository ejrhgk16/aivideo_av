'use client';

import {useEffect,useRef,useState,useSyncExternalStore} from 'react';
import Image from 'next/image';
import {ArrowDown,ArrowUp,Bookmark,ChevronRight,Layers,Pause,Play,Share2,Volume2,VolumeX} from 'lucide-react';
import {Button} from '@/components/ui/button';
import {Slider} from '@/components/ui/slider';
import {dramas,previewSources,type Drama} from '@/lib/dramas';

type Props={
 visible:boolean;
 suspended:boolean;
 initialId:string;
 savedIds:string[];
 // 보던 작품의 버튼 문구(예: '8화 이어보기'). 부모가 만들어 준다.
 watchLabels:Record<string,string>;
 onSave:(id:string)=>void;
 onDetails:(drama:Drama)=>void;
 onEpisodes:(drama:Drama)=>void;
 onShare:(drama:Drama)=>void;
 onWatch:(drama:Drama)=>void;
};

function subscribeVisibility(callback:()=>void){
 document.addEventListener('visibilitychange',callback);
 return()=>document.removeEventListener('visibilitychange',callback);
}
const getVisibility=()=>document.visibilityState==='visible';
const serverVisibility=()=>false;
const timeLabel=(seconds:number)=>`${String(Math.floor(seconds/60)).padStart(2,'0')}:${String(Math.floor(seconds%60)).padStart(2,'0')}`;
const motionQuery='(prefers-reduced-motion: reduce)';
// 모션 줄이기 설정. 홈 대표 영역의 자막도 함께 쓴다.
export function subscribeMotion(callback:()=>void){
 const query=window.matchMedia(motionQuery);query.addEventListener('change',callback);
 return()=>query.removeEventListener('change',callback);
}
export const getMotion=()=>window.matchMedia(motionQuery).matches;

// 장면 표시: 세 칸 막대와 "장면 1 / 3". 칸은 그 장면으로 가는 버튼이다. at이 3보다 크면 세 장면을 다 본 상태다. 재생 화면과 빼꼼이 함께 쓴다.
export function SceneSteps({at,onGo}:{at:number;onGo:(scene:number)=>void}){
 return <div className="scene-steps"><nav aria-label="장면 이동">{[1,2,3].map(n=><button key={n} className={n<=at?'on':''} aria-current={n===at?'step':undefined} aria-label={`장면 ${n}`} onClick={()=>onGo(n)}><i/></button>)}</nav><span>{at>3?'다 봄':`장면 ${at} / 3`}</span></div>;
}

function PreviewCard({drama,active,saved,watchLabel,muted,onMute,paused,onPause,onSave,onDetails,onEpisodes,onShare,onWatch}:Pick<Props,'onSave'|'onDetails'|'onEpisodes'|'onShare'|'onWatch'>&{
 drama:Drama;active:boolean;saved:boolean;watchLabel?:string;muted:boolean;onMute:()=>void;paused:boolean|null;onPause:(paused:boolean)=>void;
}){
 const videoRef=useRef<HTMLVideoElement>(null);
 // paused는 피드 전체의 멈춤 상태다(카드를 넘겨도 그대로다). null이면 아직 누르지 않은 것이다. 영상이 없을 때 모션 줄이기가 켜져 있으면 멈춘 채로 시작한다.
 const [scene,setScene]=useState(1);
 const reduced=useSyncExternalStore(subscribeMotion,getMotion,serverVisibility);
 const [elapsed,setElapsed]=useState(0);
 const [duration,setDuration]=useState(60);
 const [failed,setFailed]=useState(false);
 const source=previewSources[drama.id];
 const hasVideo=!!source&&!failed;
 const stopped=paused??(!hasVideo&&reduced);
 const running=active&&!stopped;
 const lines=[...drama.copy.split('\n'),'이야기는 이제 시작이다.'];

 useEffect(()=>{
  const video=videoRef.current;if(!video||!hasVideo)return;
  if(running){let current=true;video.play().catch(()=>{if(current)onPause(true)});return()=>{current=false;video.pause()}}
  video.pause();
 },[running,hasVideo,onPause]);
 useEffect(()=>{
  if(!running||hasVideo)return;
  // 영상이 없으면 자막 장면 세 개를 4초마다 넘긴다. 칸을 눌러 장면을 고르면 그때부터 다시 4초를 센다.
  const timer=setTimeout(()=>setScene(n=>n%3+1),4000);
  return()=>clearTimeout(timer);
 },[running,hasVideo,scene]);
 function seek(value:number|readonly number[]){const next=typeof value==='number'?value:value[0];setElapsed(next);if(videoRef.current&&hasVideo)videoRef.current.currentTime=next}
 const togglePlayback=()=>onPause(!stopped);

 return <article className={`recommend-card ${running?'running':''}`} aria-label={`${drama.title}, 1화 미리보기`} inert={!active}>
  <div className="recommend-media">
   {hasVideo?<video ref={videoRef} src={source?.src} poster={`/art/${drama.id}.jpg`} playsInline muted={muted} loop preload={active?'metadata':'none'} onError={()=>setFailed(true)} onLoadedMetadata={e=>{const length=e.currentTarget.duration;if(Number.isFinite(length)&&length>0)setDuration(length)}} onTimeUpdate={e=>setElapsed(e.currentTarget.currentTime)} aria-label={drama.title+' 1화 미리보기 영상'}><track kind="captions" src={source?.captions} srcLang="ko" label="한국어" default/></video>:<Image src={`/art/${drama.id}.jpg`} alt={drama.title+' 콘셉트 표지'} width={1024} height={1536} unoptimized priority={active} className="recommend-poster"/>}
   <div className="recommend-shade"/>{hasVideo&&<i className="peek-bar" style={{width:`${elapsed/duration*100}%`}}/>}
   <button className="recommend-hit-area" onClick={togglePlayback} aria-label={hasVideo?(running?'미리보기 일시 정지':'미리보기 재생'):running?'장면 넘김 멈추기':'장면 저절로 넘기기'}><span className={`recommend-play ${stopped?'paused':''}`}>{running?<Pause size={30} fill="currentColor"/>:<Play size={30} fill="currentColor"/>}</span></button>
   <div className="recommend-top"><div><strong>빼꼼</strong><span className="trial-tag" title="실제 영상·결제·광고는 연결되지 않은 체험판이에요">체험판</span></div>{hasVideo&&<button className="recommend-sound" aria-label={muted?'소리 켜기':'소리 끄기'} title={muted?'소리 켜기':'소리 끄기'} aria-pressed={!muted} onClick={onMute}>{muted?<VolumeX size={20}/>:<Volume2 size={20}/>}</button>}<p className="recommend-caption"><span>작품마다 1화를 무료로 미리 봐요<i> · 위로 밀면 다음 작품</i></span></p></div>
   {failed&&<span className="recommend-sample">영상을 불러오지 못했어요</span>}
   <div className="recommend-actions"><button onClick={()=>onSave(drama.id)} aria-pressed={saved} className={saved?'saved':''}><Bookmark size={28} strokeWidth={1.8} fill={saved?'currentColor':'none'}/><span>저장</span></button><button onClick={()=>onEpisodes(drama)}><Layers size={29} strokeWidth={1.8}/><span>회차</span></button><button onClick={()=>onShare(drama)}><Share2 size={27} strokeWidth={1.8}/><span>공유</span></button></div>
   {!hasVideo&&<p className="recommend-subtitle" key={scene}>{lines[scene-1]}</p>}
   <div className="recommend-bottom"><div className="recommend-meta"><span className="recommend-episode">1화 미리보기</span><span>{drama.tag}</span><span>{drama.total}부작</span><span>{drama.free}화까지 무료</span></div><h2><button className="recommend-title" onClick={()=>onDetails(drama)}>{drama.title}<ChevronRight size={22}/></button></h2><p className="recommend-description">{drama.description}</p><Button className="primary recommend-watch" onClick={()=>onWatch(drama)}><Play size={17} fill="currentColor"/>{watchLabel??'1화 무료로 보기'}</Button>{hasVideo?<><div className="recommend-seek"><Slider value={[elapsed]} max={duration} min={0} step={1} onValueChange={seek} aria-label={`${drama.title} 미리보기 재생 위치`} valueText={v=>`${Math.floor(v)}초 / ${Math.round(duration)}초`}/></div><div className="recommend-time"><span>{timeLabel(elapsed)} <i>/ {timeLabel(duration)}</i></span></div></>:<SceneSteps at={scene} onGo={setScene}/>}</div>
  </div>
 </article>;
}

export default function RecommendationFeed(props:Props){
 const {visible,suspended,initialId,savedIds,watchLabels,...actions}=props;
 const first=Math.max(0,dramas.findIndex(d=>d.id===initialId));
 const [index,setIndex]=useState(first);
 const indexRef=useRef(first);
 const scroller=useRef<HTMLDivElement>(null);
 const [muted,setMuted]=useState(true);
 // 멈춤은 카드가 아니라 피드에 건다. 한 번 멈추면 ↑/↓로 넘겨도 다시 누를 때까지 멈춰 있다.
 const [paused,setPaused]=useState<boolean|null>(null);
 const pageVisible=useSyncExternalStore(subscribeVisibility,getVisibility,serverVisibility);

 // Restore the current card after a tab change or a phone orientation change.
 useEffect(()=>{
  if(!visible)return;
  const element=scroller.current;if(!element)return;
  const restore=()=>{if(element.clientHeight)element.scrollTo({top:indexRef.current*element.clientHeight,behavior:'instant'})};
  const frame=requestAnimationFrame(restore);
  const resize=new ResizeObserver(restore);resize.observe(element);
  return()=>{cancelAnimationFrame(frame);resize.disconnect()};
 },[visible]);
 function onScroll(){const element=scroller.current;if(!visible||!element?.clientHeight)return;const next=Math.max(0,Math.min(dramas.length-1,Math.round(element.scrollTop/element.clientHeight)));indexRef.current=next;setIndex(next)}
 function move(next:number){const element=scroller.current;if(!element)return;const clamped=Math.max(0,Math.min(dramas.length-1,next));element.scrollTo({top:clamped*element.clientHeight,behavior:window.matchMedia('(prefers-reduced-motion: reduce)').matches?'instant':'smooth'})}

 // ↑/↓ 키로 앞뒤 작품으로 넘긴다. 글자 입력 중이거나 재생 위치 막대를 조작할 때, 다른 창이 떠 있을 때는 넘기지 않는다.
 useEffect(()=>{
  if(!visible||suspended)return;
  const onKey=(e:KeyboardEvent)=>{
   if(e.key!=='ArrowUp'&&e.key!=='ArrowDown')return;
   if(e.target instanceof HTMLElement&&e.target.closest('[role=slider],input,textarea'))return;
   const element=scroller.current;if(!element)return;
   e.preventDefault();
   const next=Math.max(0,Math.min(dramas.length-1,indexRef.current+(e.key==='ArrowUp'?-1:1)));
   element.scrollTo({top:next*element.clientHeight,behavior:window.matchMedia('(prefers-reduced-motion: reduce)').matches?'instant':'smooth'});
  };
  window.addEventListener('keydown',onKey);return()=>window.removeEventListener('keydown',onKey);
 },[visible,suspended]);
 // 카드를 넘기면 이전 카드가 비활성(inert)이 되어 포커스가 사라진다. 그때는 새 카드의 재생 버튼으로 옮긴다.
 useEffect(()=>{
  const focused=document.activeElement;
  if(!visible||suspended||(focused&&focused!==document.body&&!focused.closest('[inert]')))return;
  scroller.current?.querySelector<HTMLElement>('.recommend-card:not([inert]) .recommend-hit-area')?.focus({preventScroll:true});
 },[index,visible,suspended]);
 return <section className="recommendation-feed" hidden={!visible} aria-label="빼꼼 미리보기 피드">
  {/* 화면 제목은 피드에 하나. 카드의 제목은 작품 이름(h2)이다. */}
  {visible&&<h1 className="sr-only">빼꼼</h1>}
  <div className="recommend-ambient" style={{backgroundImage:`url(/art/${dramas[index].id}.jpg)`}}/>
  <div className="recommend-scroll" ref={scroller} onScroll={onScroll}>
   {dramas.map((drama,i)=><PreviewCard key={drama.id} drama={drama} active={visible&&!suspended&&pageVisible&&i===index} saved={savedIds.includes(drama.id)} watchLabel={watchLabels[drama.id]} muted={muted} onMute={()=>setMuted(m=>!m)} paused={paused} onPause={setPaused} {...actions}/>)}
  </div>
  <div className="recommend-paging"><span className="recommend-page-number">{index+1} <small>/ {dramas.length}</small></span><button onClick={()=>move(index-1)} disabled={index===0} aria-label="이전 작품" aria-keyshortcuts="ArrowUp"><ArrowUp size={22}/></button><button onClick={()=>move(index+1)} disabled={index===dramas.length-1} aria-label="다음 작품" aria-keyshortcuts="ArrowDown"><ArrowDown size={22}/></button><p>스크롤하거나<br/>↑ ↓ 키로 넘기기</p></div>
  <output className="sr-only" aria-live="polite">{visible?`${dramas.length}편 중 ${index+1}번째, ${dramas[index].title} 미리보기`:''}</output>
 </section>;
}
