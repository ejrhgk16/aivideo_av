// 라이트(크림)·다크(밤 라벤더) 모드. 고른 값은 이 브라우저에만 저장하고, 고르지 않았으면 기기 설정을 따른다.
export type Theme='light'|'dark';
const KEY='peeka-theme';
const EVENT='peeka-theme-change';
const QUERY='(prefers-color-scheme: dark)';
let chosen:Theme|null=null; // 저장소를 쓸 수 없을 때도 이번 화면에서는 유지한다.
export const getServerTheme=():Theme=>'light';
export function getTheme():Theme{
 if(chosen)return chosen;
 try{const saved=localStorage.getItem(KEY);if(saved==='light'||saved==='dark')return saved}catch{/* 저장소 사용 불가: 기기 설정을 따른다 */}
 return window.matchMedia(QUERY).matches?'dark':'light';
}
export function subscribeTheme(callback:()=>void){
 const media=window.matchMedia(QUERY);
 media.addEventListener('change',callback);window.addEventListener(EVENT,callback);window.addEventListener('storage',callback);
 return()=>{media.removeEventListener('change',callback);window.removeEventListener(EVENT,callback);window.removeEventListener('storage',callback)};
}
export function setTheme(theme:Theme){
 chosen=theme;
 try{localStorage.setItem(KEY,theme)}catch{/* 저장 실패: 이번 화면에서만 유지 */}
 window.dispatchEvent(new Event(EVENT));
}
