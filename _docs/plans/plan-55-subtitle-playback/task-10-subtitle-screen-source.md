# task-10-subtitle-screen-source

## 기본 입력
- 이 task 문서와 index.json의 task-10 항목.
- 컨텍스트로 전달된 적용 지침과 필요한 선행 task 완료 요약: task-4, task-8, task-9.
- 다른 작업자가 같은 저장소에서 작업한다. 다른 작업자의 변경을 되돌리지 말고 담당 파일 안에서 선행 변경에 맞춰 작업한다.

## 읽어야 할 파일
- front/src/screens/playbackScreen_episode.tsx: PlaybackVideo 시간/탐색/focus/영상오류/설정/overlay
- front/src/screens/AccountScreen.tsx: 재생 설정과 SettingItem
- front/src/features/user/UserProvider.tsx: 타입·state·memo
- front/src/features/playback/useEpisodeSubtitles.ts: C3
- front/README.md: 전역 상태 섹션
- front/node_modules/expo-video/build/VideoPlayer.types.d.ts: timeUpdateEventInterval/currentTime 관련 타입

## 필요 시 참고할 문서
- 적용 지침이 누락/변경된 경우에만 루트 AGENTS.md.
- 구조/파일 책임 판단이 필요한 경우에만 _docs/ARCHITECTURE.md의 Frontend 및 Boundaries 섹션.
- 계약 누락/충돌이 발견되면 plan.md의 C1, C3, C4 및 C6만 참조하고 affected task를 보류해 메인에게 보고한다. 승인 계약을 추측/변경하지 않는다.
- 테스트 코드 작성 시 프론트는 해당 RNTL/Jest 스킬의 필요한 버전/경계 문서, 백엔드는 back/README.md 검증의 fixture·lock·실패 판정 부분을 따른다.

## 실패 시 참고할 파일
- front/tests/unit/playbackScreenEpisode.test.tsx, accountSubtitles.test.tsx와 실패한 관련 mock 검사. 훅 경합 실패 시 useEpisodeSubtitles.test.tsx 해당 시나리오.

## 작업

### 역할과 완료 조건
소스 구현·검증. C4 Provider 필드와 본편 언어 선택·C3 hook·overlay·계정 switch를 연결한다. 글로벌 선호값을 fallback으로 덮어쓰지 않는다. README 전역 상태 소유권 갱신. 기존 저장·진행률·잠금 해제·세션 동작을 보존한다. 선택 검사 후 최종 export를 실행한다. 실제 S3 GET/CORS와 web/기기 텍스트 배치는 자동검사 범위 밖이며 실제 자막 파일을 가진 회차로 수동 확인 결과/미실행 이유를 보고한다. 서버 자동 실행/포트 우회/파일 업로드/버킷 변경은 하지 않는다.

정확한 수정 허용 파일:
- `front/src/screens/playbackScreen_episode.tsx`
- `front/src/screens/AccountScreen.tsx`
- `front/src/features/user/UserProvider.tsx`
- `front/README.md`

checks (저장소 루트):
- `npm --prefix front run typecheck`
- `npm --prefix front run test -- tests/unit/subtitles.test.ts tests/unit/useEpisodeSubtitles.test.tsx tests/unit/playbackScreenEpisode.test.tsx tests/unit/accountSubtitles.test.tsx tests/unit/dramaDetailScreen.test.tsx tests/unit/episodeUnlockDialog.test.tsx tests/unit/homeScreen.test.tsx tests/unit/libraryScreen.test.tsx tests/unit/pointsScreen.test.tsx tests/unit/recommendationPreviewBuffer.test.tsx tests/unit/savedVideoScreens.test.tsx tests/unit/searchScreen.test.tsx tests/unit/sessionExpiredDialog.test.tsx`
- `npm --prefix front run export`

isFocused/isSeeking은 실제 focus·slider 이벤트에서 갱신하는 로컬 상태로 둔다. 자막 시간은 UI slider preview position과 분리해 실제 player timeUpdate로 갱신하며 seeker 완료 즉시 반영한다. 상태·리스트를 화면 렌더 편의를 위해 새로운 글로벌 추상화로 만들지 않는다.

완료 전 imports/실제 export·fixture·mock 전제조건·비동기 이벤트 순서·assertion을 적용 계약 및 설치 도구와 대조한다. 테스트 작성 task는 계약 ID별 검증 파일/테스트 이름과 즉시 실행 결과·유예 대상 소스 task를 보고한다. 소스 task는 선언 checks 전체 통과와 계약별 동작/기존 소비 회귀 결과를 보고한다. 검증만을 위해 테스트 파일 전체를 미리 읽을 필요는 없다. 범위 밖 테스트 결함은 메인에게 근거와 함께 보고하며 assertion을 약화하지 않는다. 실패·미실행은 통과가 아니다. 제품 코드 변경 task가 아니면 제품 코드를 수정하지 않는다.

### 적용 계약
### C1: 다국어 본편 재생 응답
정의 담당 task-4: `back/src/content/contentResponses.ts` named export. 프론트 대응 정의 담당 task-8: `front/src/features/playback/playbackResponses.ts` named export. 소비: PublicCatalogService.getEpisodePlaybackUrl, PlaybackScreenEpisode, task-2/3/7/9 테스트.
```ts
export type PlaybackSubtitle = {
  languageCode: string;
  format: 'VTT' | 'SRT';
  url: string;
};
// back EpisodePlaybackResponse의 기존 필드는 유지:
subtitles: PlaybackSubtitle[];
// front EpisodePlayback의 기존 필드는 유지:
subtitles?: PlaybackSubtitle[];
```
GET /episodes/:episodeId/playback은 회차에 등록된 모든 언어 자막을 languageCode ASC로 반환한다. 자막 없음은 []; 프론트는 이전 서버의 필드 누락도 []로 처리한다. languageCode는 DB BCP-47 값을 그대로 사용한다. 각 항목의 키는 languageCode/format/url만 허용한다. UUID·내부 숫자 ID·storageKey는 노출하지 않는다. 프리뷰 응답은 변경하지 않는다.
기존 getEpisodeVideo의 공개 작품·회차·영상 및 무료/유료 권한 검사를 먼저 완료한다. 이후 EpisodeSubtitle과 Episode의 숫자 관계를 TypeORM QueryBuilder로 조회한다. 기존 episodeRepository의 QueryBuilder에서 EpisodeSubtitle을 조인해 추가 repository 주입 없이 구현할 수 있다. 자막 서명은 기존 S3VideoUrlService.createSignedGetUrl(storageKey)를 그대로 사용한다. 개발 환경 한정·3600초 만료를 유지한다. 권한 거부에는 자막 URL도 없다. S3 객체 존재 확인/다운로드는 API에서 추가하지 않는다.
검증: task-2의 언어/형식/없음/인증/공개 조건과 task-3 기존 exact-key 소비 검사, task-4 선택 및 전체 HTTP 실행.

### C3: 선택한 자막 파일 로딩
task-8 소유 `front/src/features/playback/useEpisodeSubtitles.ts` named export. 소비 task-7/9/10. PlaybackSubtitle은 C1 프론트 타입을 import한다.
```ts
export function useEpisodeSubtitles(
  subtitle: PlaybackSubtitle | null | undefined,
  enabled: boolean,
  positionMs: number,
): { status: 'unavailable' | 'loading' | 'ready' | 'error'; text: string };
```
선택 언어 결정은 화면(C4)이, 로드 상태와 cue는 훅이 소유한다. subtitle 없음→unavailable/''. URL·format·languageCode 변경→기존 문장 즉시 제거, loading, 일반 fetch로 GET. 앱 Authorization/cookie 헤더를 직접 추가하지 않는다. ON/OFF·position 변화만으로 재요청하지 않는다. OFF여도 선택 파일 로드는 진행하고 text만 즉시 ''로 만든다.
응답 ok와 text() 완료 뒤 C2 parseSubtitles를 호출한다. 유효 cue 1개 이상이면 ready, HTTP/본문/파싱 실패 또는 cue 없음이면 error/''. 자동 재시도·캐시는 추가하지 않는다. 다른 선택/언마운트는 AbortController와 유효성 가드로 이전 요청을 취소·무시한다. 취소된 이전 요청의 실패는 현재 상태에 반영하지 않는다. 이전 선택의 ready 결과가 새 선택 렌더에 잠시 보이지 않도록 결과의 소유 URL/format/languageCode를 확인한다.
대표 검증: ko 요청 지연→en 선택→en 완료→ko 늦게 완료/실패에도 영어 유지; unmount 후 완료 무시; position 및 enabled만 변경하면 재다운로드 없음. task-7 작성, task-8 실행.

### C4: 언어 선호·화면·설정
task-10 소유 `front/src/features/user/UserProvider.tsx` 기존 useUser() 반환 계약에 추가한다. export 형태와 기존 필드는 유지한다.
```ts
preferredSubtitleLanguage: string; // useState('ko')
setPreferredSubtitleLanguage: (languageCode: string) => void;
```
기존 subtitlesEnabled=true 및 setSubtitlesEnabled를 재사용한다. 선호 언어와 ON/OFF는 UserProvider 메모리 상태이며 로그인·화면 전환으로 초기화하지 않고 Provider 재생성 시 ko/true다. 서버·디스크 저장은 추가하지 않는다. front/README.md 전역 상태 섹션에 기록한다.
PlaybackScreenEpisode의 기존 props/exports는 유지한다. playback.subtitles??[]에서 preferredSubtitleLanguage와 정확히 일치하는 항목, ko, en, languageCode 문자열 오름차순 첫 항목 순으로 선택한다. 일시적 fallback은 선호 상태를 덮어쓰지 않는다. 사용자 언어 선택 시에만 setter를 호출하므로 원래 언어를 제공하는 다음 회차에서는 선호 언어로 돌아간다.
본편 재생 설정: Switch 접근성 이름 '자막 표시', ready일 때만 활성화. 선택된 자막을 로드 중이면 '자막을 불러오는 중이에요', 없음은 '제공되는 자막이 없어요', 실패는 '자막을 불러오지 못했어요'. 언어별 Pressable role=button, label ko='한국어', en='English', 그 외 languageCode, accessibilityState.selected로 현재 선택을 표현한다. 로드 중/실패에도 다른 언어를 선택할 수 있다. 언어가 없으면 언어 버튼도 없다. OFF에서도 언어를 선택할 수 있으며 ON으로 자동 변경하지 않는다.
AccountScreen은 role=switch/name='자막 표시'를 항상 활성화하고 전역 ON/OFF만 변경한다. 언어 선택은 본편에서만 한다. 다른 준비 중 설정은 유지하고 계정의 준비 중 안내가 자막까지 미구현으로 설명하지 않게 조정한다.
본편은 C3 훅에 선택 항목과 ON/OFF, 실제 재생 위치 ms를 전달한다. expo-video.timeUpdateEventInterval=0.1; 기존 진행률 추적의 저장 정책은 변경하지 않는다. 탐색 시작~완료는 문장을 숨기고 완료 시 player.currentTime과 자막 계산 위치를 즉시 맞춘다. pause는 현재 문장 유지, focus 이탈·video error·회차/세션 교체는 문장 숨김/이전 요청 해제. 자막 overlay는 nativeControls=false인 기존 VideoView의 형제 일반 텍스트이며 pointerEvents='none', 안전 영역·하단 컨트롤을 피한다. 컨트롤 숨김 상태에도 자막은 보인다.
검증 task-9/10: 실 UserProvider를 사용하는 공유 설정/선호 유지 검사, 실제 화면과 Router/player 이벤트를 통한 자막·탐색·언어 변경·오류·blur·세션 회귀.

### 반복 작업 위임
불가. 메인 외 최대 worker 3명, 자식 예약 0명. 독립적인 fixture/계약/상태 로직으로 단순 반복 위임 대상이 아니다.

### 주요 로직 코드 또는 변경 예시
아래는 승인된 경계와 핵심 흐름을 나타내는 예시다. 담당 구현은 모든 완료 조건을 충족하도록 완성한다.
```tsx
const tracks = playback.subtitles ?? [];
const selected = tracks.find(track => track.languageCode === preferredSubtitleLanguage)
  ?? tracks.find(track => track.languageCode === 'ko')
  ?? tracks.find(track => track.languageCode === 'en')
  ?? [...tracks].sort((a, b) =>
    a.languageCode < b.languageCode ? -1 : a.languageCode > b.languageCode ? 1 : 0)[0];
const subtitleState = useEpisodeSubtitles(selected, subtitlesEnabled, subtitlePositionMs);
const displayText = isFocused && !videoFailed && !isSeeking ? subtitleState.text : '';
const chooseLanguage = (languageCode: string) => setPreferredSubtitleLanguage(languageCode);
const completeSeek = (value: number) => {
  player.currentTime = value;
  setSubtitlePositionMs(Math.max(0, value * 1000));
  setIsSeeking(false);
  seeking.current = false;
  previousPlaybackTime.current = null;
  showControls();
};
// 기존 Slider onSlidingComplete에 completeSeek를 연결한다.
{displayText ? <View pointerEvents="none" style={styles.subtitleOverlay}>
  <AppText style={styles.subtitleText}>{displayText}</AppText>
</View> : null}
```

