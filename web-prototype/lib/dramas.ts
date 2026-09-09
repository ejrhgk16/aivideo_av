export const dramas = [
 {id:'signal',title:'마지막 신호',english:'THE LAST SIGNAL',tag:'미스터리',mood:'스릴러',free:7,total:36,studio:'AI DRAMA ORIGINAL',rank:1,copy:'죽은 사람에게서\n메시지가 도착했다.',description:'3년 전 실종된 동생의 번호로 도착한 메시지. “언니, 그 문 열지 마.” 멈춰 있던 그날 밤의 시간이 다시 움직이기 시작한다.',color:'#93C9D2',episode:'문밖의 목소리',badge:'오늘 공개'},
 {id:'season',title:'낯선 계절',english:'A SEASON WITH YOU',tag:'로맨스',mood:'재회',free:10,total:40,studio:'STUDIO ON',rank:2,copy:'다시 만난 우리,\n이번엔 달라질까.',description:'헤어진 지 7년. 같은 열차, 같은 좌석에서 마주친 두 사람. 끝났다고 믿었던 이야기가 낯선 도시에서 다시 시작된다.',color:'#E9C99D',episode:'다시, 너',badge:'10화 무료'},
 {id:'moon',title:'달의 도시',english:'CITY OF THE MOON',tag:'SF',mood:'판타지',free:7,total:24,studio:'AI DRAMA ORIGINAL',rank:3,copy:'달이 가까워진 밤,\n도시는 기억을 잃었다.',description:'달이 지구에 가장 가까워진 밤, 서울의 모든 사람이 어제를 잊는다. 오직 한 사람, 기억을 되찾을 수 있는 60초가 그녀에게 주어진다.',color:'#C5B9EF',episode:'사라진 어제',badge:'새로운 세계'},
] as const;
export type Drama=(typeof dramas)[number];
export const getDrama=(id:string)=>dramas.find(d=>d.id===id)??dramas[0];
// Add licensed trailer / first-episode URLs here when the real media is ready.
// Empty entries deliberately show a labelled concept preview, never a fake video.
export const previewSources:Partial<Record<Drama['id'],{src:string;captions:string}>>={};
