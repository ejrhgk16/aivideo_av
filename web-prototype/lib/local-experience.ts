import {initialExperience,readExperience,type Experience} from './experience';
const KEY='ai-drama-experience-v1';
const EVENT='ai-drama-local-change';
const serverSnapshot=initialExperience();
let cached:Experience=serverSnapshot;
let lastRaw:string|null=null;
let storageFailed=false;
export function getServerSnapshot(){return serverSnapshot}
export function getSnapshot(){
 if(typeof window==='undefined')return serverSnapshot;
 try{if(!storageFailed){const raw=localStorage.getItem(KEY);if(raw!==lastRaw){lastRaw=raw;cached=readExperience(raw)}}}catch{storageFailed=true}
 return cached;
}
export function subscribe(callback:()=>void){
 const storage=(event:StorageEvent)=>{if(event.key===KEY||event.key===null){lastRaw=null;cached=initialExperience();getSnapshot();callback()}};
 window.addEventListener(EVENT,callback);window.addEventListener('storage',storage);
 return()=>{window.removeEventListener(EVENT,callback);window.removeEventListener('storage',storage)};
}
export function writeExperience(value:Experience){
 cached=value;const raw=JSON.stringify(value);lastRaw=raw;
 try{localStorage.setItem(KEY,raw);storageFailed=false}catch{storageFailed=true}
 window.dispatchEvent(new Event(EVENT));return !storageFailed;
}
