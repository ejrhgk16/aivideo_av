// 처음 한 번만 보여 주는 안내의 '봤음' 표시. 이 브라우저에만 저장한다.
// 안내마다 이름이 있다. peek: 엿보기 안내, welcome: 처음 드린 4P 안내.
type Hint='peek'|'welcome';
const EVENT='peeka-hint-change';
const dismissed=new Set<Hint>(); // 저장소를 쓸 수 없을 때도 이번 화면에서는 다시 띄우지 않는다.
export const getServerHintSeen=()=>true;
export function getHintSeen(name:Hint='peek'){
 if(dismissed.has(name))return true;
 try{return localStorage.getItem('peeka-hint-'+name)==='1'}catch{return false}
}
export function subscribeHint(callback:()=>void){
 window.addEventListener(EVENT,callback);window.addEventListener('storage',callback);
 return()=>{window.removeEventListener(EVENT,callback);window.removeEventListener('storage',callback)};
}
export function dismissHint(name:Hint='peek'){
 dismissed.add(name);
 try{localStorage.setItem('peeka-hint-'+name,'1')}catch{/* 저장 실패: 이번 화면에서만 유지 */}
 window.dispatchEvent(new Event(EVENT));
}
