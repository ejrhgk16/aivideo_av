'use client';

import {useEffect,useRef,useState,useSyncExternalStore} from 'react';
import Image from 'next/image';
import {ArrowDown,ArrowUp,Bookmark,ChevronRight,Clapperboard,Layers,Pause,Play,Share2,Volume2,VolumeX} from 'lucide-react';
import {Button} from '@/components/ui/button';
import {Slider} from '@/components/ui/slider';
import {dramas,previewSources,type Drama} from '@/lib/dramas';

type Props={
 visible:boolean;
 suspended:boolean;
 initialId:string;
 savedIds:string[];
 watchedIds:string[];
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

function PreviewCard({drama,active,saved,watched,muted,onMute,onSave,onDetails,onEpisodes,onShare,onWatch}:Pick<Props,'onSave'|'onDetails'|'onEpisodes'|'onShare'|'onWatch'>&{
 drama:Drama;active:boolean;saved:boolean;watched:boolean;muted:boolean;onMute:()=>void;
}){
 const videoRef=useRef<HTMLVideoElement>(null);
 const [paused,setPaused]=useState(false);
 const [elapsed,setElapsed]=useState(0);
 const [duration,setDuration]=useState(60);
 const [failed,setFailed]=useState(false);
 const source=previewSources[drama.id];
 const hasVideo=!!source&&!failed;
 const running=active&&!paused;

 useEffect(()=>{
  const video=videoRef.current;if(!video||!hasVideo)return;
  if(running){let current=true;video.play().catch(()=>{if(current)setPaused(true)});return()=>{current=false;video.pause()}}
  video.pause();
 },[running,hasVideo]);
 useEffect(()=>{
  if(!running||hasVideo)return;
  const timer=setInterval(()=>setElapsed(t=>t>=59.75?0:t+.25),250);
  return()=>clearInterval(timer);
 },[running,hasVideo]);
 function seek(value:number|readonly number[]){const next=typeof value==='number'?value:value[0];setElapsed(next);if(videoRef.current&&hasVideo)videoRef.current.currentTime=next}
 const togglePlayback=()=>setPaused(p=>!p);

 return <article className={`recommend-card ${running?'running':''}`} aria-label={`${drama.title}, 1화 미리보기`} inert={!active}>
  <div className="recommend-media">
   {hasVideo?<video ref={videoRef} src={source?.src} poster={`/art/${drama.id}.jpg`} playsInline muted={muted} loop preload={active?'metadata':'none'} onError={()=>setFailed(true)} onLoadedMetadata={e=>{const length=e.currentTarget.duration;if(Number.isFinite(length)&&length>0)setDuration(length)}} onTimeUpdate={e=>setElapsed(e.currentTarget.currentTime)} aria-label={drama.title+' 1화 미리보기 영상'}><track kind="captions" src={source?.captions} srcLang="ko" label="한국어" default/></video>:<Image src={`/art/${drama.id}.jpg`} alt={drama.title+' 콘셉트 표지'} width={1024} height={1536} unoptimized priority={active} className="recommend-poster"/>}
   <div className="recommend-shade"/>
   <button className="recommend-hit-area" onClick={togglePlayback} aria-label={running?'미리보기 일시 정지':'미리보기 재생'}><span className={`recommend-play ${paused?'paused':''}`}>{running?<Pause size={30} fill="currentColor"/>:<Play size={30} fill="currentColor"/>}</span></button>
   <div className="recommend-top"><div><h1>추천</h1><span>예고 · 1화</span></div><button className="recommend-sound" aria-label={hasVideo?(muted?'소리 켜기':'소리 끄기'):'샘플 화면에는 소리가 없어요'} aria-pressed={!muted} disabled={!hasVideo} onClick={onMute}>{muted||!hasVideo?<VolumeX size={20}/>:<Volume2 size={20}/>}</button></div>
   {!hasVideo&&<span className="recommend-sample">{failed?'영상을 불러오지 못했어요 · 표지 미리보기':'샘플 화면 · 영상 연결 전'}</span>}
   <div className="recommend-actions"><button onClick={()=>onSave(drama.id)} aria-pressed={saved} className={saved?'saved':''}><Bookmark size={28} strokeWidth={1.8} fill={saved?'currentColor':'none'}/><span>{saved?'저장됨':'저장'}</span></button><button onClick={()=>onEpisodes(drama)}><Layers size={29} strokeWidth={1.8}/><span>회차</span></button><button onClick={()=>onShare(drama)}><Share2 size={27} strokeWidth={1.8}/><span>공유</span></button></div>
   {!hasVideo&&<p className="recommend-subtitle">{elapsed<20?drama.copy.split('\n')[0]:elapsed<40?drama.copy.split('\n')[1]:'이야기는 이제 시작이다.'}</p>}
   <div className="recommend-bottom"><div className="recommend-meta"><span className="recommend-episode">1화 미리보기</span><span>{drama.tag}</span><span>{drama.total}부작</span></div><button className="recommend-title" onClick={()=>onDetails(drama)}>{drama.title}<ChevronRight size={22}/></button><button className="recommend-description" onClick={()=>onDetails(drama)}>{drama.description}<span> 더보기</span></button><Button className="primary recommend-watch" onClick={()=>onWatch(drama)}><Play size={17} fill="currentColor"/>{watched?'본편 이어보기':'1화부터 본편 보기'}<span>{drama.free}화 무료</span></Button><div className="recommend-seek"><Slider value={[elapsed]} max={duration} min={0} step={1} onValueChange={seek} aria-label={`${drama.title} 미리보기 재생 위치`}/></div><div className="recommend-time"><span>{timeLabel(elapsed)} <i>/ {timeLabel(duration)}</i></span><span>{hasVideo?'미리보기는 무료예요':'화면 체험 · 음성 없음'}</span></div></div>
  </div>
 </article>;
}

export default function RecommendationFeed(props:Props){
 const {visible,suspended,initialId,savedIds,watchedIds,...actions}=props;
 const first=Math.max(0,dramas.findIndex(d=>d.id===initialId));
 const [index,setIndex]=useState(first);
 const indexRef=useRef(first);
 const scroller=useRef<HTMLDivElement>(null);
 const [muted,setMuted]=useState(true);
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

 return <section className="recommendation-feed" hidden={!visible} aria-label="추천 미리보기 피드">
  <div className="recommend-ambient" style={{backgroundImage:`url(/art/${dramas[index].id}.jpg)`}}/>
  <div className="recommend-desktop-label"><Clapperboard size={23}/><span>작은 화면,<br/>커다란 이야기.</span><p>마음에 드는 드라마를<br/>한 편씩 만나보세요.</p></div>
  <div className="recommend-scroll" ref={scroller} onScroll={onScroll}>
   {dramas.map((drama,i)=><PreviewCard key={drama.id} drama={drama} active={visible&&!suspended&&pageVisible&&i===index} saved={savedIds.includes(drama.id)} watched={watchedIds.includes(drama.id)} muted={muted} onMute={()=>setMuted(m=>!m)} {...actions}/>)}
  </div>
  <div className="recommend-paging"><span className="recommend-page-number">{String(index+1).padStart(2,'0')} <small>/ {String(dramas.length).padStart(2,'0')}</small></span><button onClick={()=>move(index-1)} disabled={index===0} aria-label="이전 추천 작품"><ArrowUp size={22}/></button><button onClick={()=>move(index+1)} disabled={index===dramas.length-1} aria-label="다음 추천 작품"><ArrowDown size={22}/></button><p>스크롤해서<br/>다음 이야기</p></div>
  <output className="sr-only" aria-live="polite">{visible?`${index+1}번째 추천, ${dramas[index].title}`:''}</output>
 </section>;
}
