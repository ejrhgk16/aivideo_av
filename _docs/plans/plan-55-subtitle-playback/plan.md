# 다국어 자막 재생 구현

## 목표
본편의 VTT/SRT 자막을 API로 전달하고 한국어·영어 등 등록 언어를 선택해 표시한다. 자막 ON/OFF와 선호 언어는 기존 단일 UserProvider의 메모리 상태로 공유한다.

## 승인과 범위
사용자는 본편 자막·계정 ON/OFF 범위를 승인한 뒤 한국어·영어 다국어 제공을 지적했고, subtitles 배열·본편 언어 선택·선호 유지 계약으로 변경 승인했다. 2026-11-16 최종 승인 후 작성한다.
비목표: 프리뷰/추천 자막, 자막 생성·업로드·편집, 글자 크기/스타일 설정, 서버/디스크 환경설정 저장, DB 스키마 변경, 운영 미디어 배포 확대. 제품 코드는 이 계획 작성 중 수정하지 않는다. web-prototype/ 제외. 실행은 dev에서만 하고 branch/worktree를 만들지 않는다.

## 공통 계약
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

### C2: 자막 파서와 시간 선택
task-6 소유 `front/src/features/playback/subtitles.ts` named exports. 소비 task-5/8/10.
```ts
export type SubtitleCue = { startMs: number; endMs: number; text: string };
export function parseSubtitles(source: string, format: 'VTT' | 'SRT'): SubtitleCue[];
export function getSubtitleText(cues: readonly SubtitleCue[], positionMs: number): string;
```
UTF-8 BOM·CRLF, VTT WEBVTT 헤더/선택 cue 식별자/시간 뒤 설정, SRT 번호/쉼표 밀리초를 처리한다. VTT 시간은 mm:ss.mmm와 hh:mm:ss.mmm, SRT는 hh:mm:ss,mmm를 지원한다. 시간 구성요소 범위 밖, 비유한 시간, end<=start, 빈 문장은 제외한다. VTT NOTE/STYLE/REGION 블록은 무시한다. 여러 줄을 보존하고 스타일 태그를 제거해 일반 텍스트로 출력한다. VTT 기본 엔티티 &amp; &lt; &gt; &nbsp; &lrm; &rlm;은 대응 문자로 해석한다. VTT 위치/색/폰트·내부 타임스탬프 애니메이션은 구현하지 않는다.
cue 순서는 원본 파일 순서다. startMs<=positionMs<endMs인 모든 cue.text를 줄바꿈으로 연결한다. 공백 구간, 음수/NaN/Infinity는 ''. 유효 cue가 없는 파일은 []이다.
검증 task-5/6: BOM/CRLF/양 형식/멀티라인/태그·엔티티/블록/잘못된 cue/겹침/시작·종료 경계/뒤로 탐색.

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

### C5: API fixture·수명과 Postman 환경
task-1 소유 `back/test/api/subtitleFixtures.mjs` named export. task-1 run.mjs가 호출하고 task-2 collection이 반환 환경을 소비한다.
```ts
// .mjs named export의 계약 표기. DB/fixtureContext는 기존 runner 객체다.
createSubtitleFixtures({ db, runId }): {
  prepare({ fixtureContext, entitled, unentitled }): Promise<Record<string, string>>;
  cleanup(): Promise<void>;
}
```
prepare는 아래 string 값의 평면 환경 객체를 반환한다:
subtitleFreeEpisodeUuid, subtitlePaidEpisodeUuid, subtitleEmptyEpisodeUuid,
subtitleEnglishOnlyEpisodeUuid, subtitleHiddenEpisodeUuid, subtitleFutureEpisodeUuid,
subtitleHiddenDramaEpisodeUuid, subtitleFutureDramaEpisodeUuid.
무료/유료 회차 모두 en(SRT)와 ko(VTT)를 갖고 응답 순서는 en,ko. EnglishOnly는 en만, Empty는 자막 행 없음. hidden/future 네 경우에도 자막·FULL을 만들어 실제 공개 검증에 도달하게 한다. 무료/유료 모두 EPISODE/FULL과 정상 공개 부모를 갖는다. 유료 회차는 entitled만 권한을 갖는다.
기존 fixtureContext.createUser/grantEpisode와 기존 entitled/unentitled 사용자·로그인 환경 키를 재사용한다. 기존 공개 작품의 제작사 ID만 읽어 실행 UUID의 부모 작품/회차/영상/자막을 만든다. 신규 자막/영상 객체는 다운로드하지 않으므로 실제 S3 업로드가 필요 없다. UUID를 쓰기 전에 기록한다. cleanup은 부분 준비 실패에도 소유 행만 제거하고 멱등·잔여 행 검증을 제공한다. 권한/사용자 종속 정리 후 자막/영상/회차/작품을 정리하도록 runner finally 순서를 맞춘다. 기존 fixture 정리는 보존한다.
새 suite id='subtitles', collection='subtitles.postman_collection.json', contentMode='exclusive'; 기존 suite 순서 뒤에 추가한다. run.mjs의 사용자 생성 후 전용 분기를 넣어 기존 복잡한 saved-video 준비로 진입하지 않게 한다. 실패·cleanup·lock·timeout은 기존 실패 정책을 유지한다. 외부 환경 모드는 DB 준비를 하지 않고 위 키와 기존 로그인 키를 사용한다.
독립 fixture 검사는 Vitest 4.1.11에서 fake DB 경계로 준비/소유 기록/부분 실패 정리/타인 행 보존을 확인한다. HTTP는 task-4 구현 후에만 실행한다.

### C6: 테스트 도구·공통 검증 경계
실제 설치 확인: Jest 29.7.0, RNTL 13.3.3, expo-video 57.0.5, Vitest 4.1.11. package.json과 lockfile/설치 export를 재확인하고 Jest API를 Postman/Vitest로 옮기지 않는다. 프론트 setup은 front/tests/setup.ts, 영상 이벤트는 front/tests/support/video.ts의 mockVideoPlayers/createMockVideoPlayer를 재사용한다. 훅은 RNTL renderHook/act/waitFor, 화면은 실제 앱·공용 UI·Router와 RNTL screen/userEvent를 사용한다. mock 대상은 fetch, 외부 API feature 함수, 설치된 expo-video 경계이며 실제 parser/hook를 mock하지 않는다. 테스트 전용 제품 props/export를 추가하지 않는다.
T9의 기존 useUser mock에는 C4의 두 필드만 추가한다. typed mock이 C4 구현 전 타입 오류를 내는 경우 전체 typecheck는 T10으로 유예한다. 기존9 화면 검사는 지금 가능한 동작이므로 T9에서 실행한다. 제품의 새 상태 없이 가능한 검사를 모두 유예하지 않는다.
자동 HTTP 검사는 URL metadata만 검사하고 실제 미디어를 다운로드하지 않는다. 프론트는 inline VTT/SRT fetch 응답으로 네트워크를 격리한다. 실제 자막 객체/CORS/배치 확인은 수동 결과 또는 미실행 이유를 기록한다.
참조: [Expo SDK57 공식 영상 문서](https://docs.expo.dev/versions/v57.0.0/sdk/video/)의 timeUpdate/currentTime/timeUpdateEventInterval; 프로젝트 RNTL/Jest 스킬과 back README 검증 규칙.
서버는 기존 localhost:3000/8081만 사용한다. API 변경 반영 확인 후 검사한다. 없으면 실패로 보고하고 안내: `npm --prefix back run start:dev`, `npm --prefix front run start -- --port 8081`. 서버 자동 시작/다른 포트 우회는 없다. credentials/서명 URL을 로그·계획·결과 파일에 남기지 않는다.

## Task
| 번호 | 이름 | 정확한 수정 파일 | depends_on |
| --- | --- | --- | --- |
| 1 | 자막 API 전용 fixture와 실행기 준비 | `back/test/api/subtitleFixtures.mjs`<br>`back/test/api/run.mjs`<br>`back/test/api/suites.mjs`<br>`back/test/unit/api/subtitleFixtures.spec.ts` | 없음 |
| 2 | 다국어 자막 HTTP 시나리오 작성 | `back/test/api/subtitles.postman_collection.json`<br>`back/test/unit/api/suiteSelection.spec.ts` | task-1 |
| 3 | 기존 Postman 본편 응답 검사 적응 | `back/test/api/content.postman_collection.json`<br>`back/test/api/economy.postman_collection.json`<br>`back/test/api/http.postman_collection.json`<br>`back/test/api/identity.postman_collection.json`<br>`back/test/api/playback.postman_collection.json`<br>`back/test/api/programming.postman_collection.json`<br>`back/test/api/saved-videos.postman_collection.json`<br>`back/test/api/watch-progress.postman_collection.json` | 없음 |
| 4 | 자막 재생 API 구현과 전체 HTTP 검증 | `back/src/content/publicCatalogService.ts`<br>`back/src/content/contentResponses.ts`<br>`_docs/api/04-playback/episodes.md`<br>`back/README.md` | task-1, task-2, task-3 |
| 5 | VTT SRT 파서 경계 테스트 작성 | `front/tests/unit/subtitles.test.ts` | 없음 |
| 6 | VTT SRT 파서 구현 | `front/src/features/playback/subtitles.ts` | task-5 |
| 7 | 자막 로드 훅 비동기 테스트 작성 | `front/tests/unit/useEpisodeSubtitles.test.tsx` | 없음 |
| 8 | 프론트 응답 타입과 자막 로드 훅 구현 | `front/src/features/playback/playbackResponses.ts`<br>`front/src/features/playback/useEpisodeSubtitles.ts` | task-6, task-7 |
| 9 | 다국어 화면 테스트와 기존 세션 mock 적응 | `front/tests/unit/playbackScreenEpisode.test.tsx`<br>`front/tests/unit/accountSubtitles.test.tsx`<br>`front/tests/unit/dramaDetailScreen.test.tsx`<br>`front/tests/unit/episodeUnlockDialog.test.tsx`<br>`front/tests/unit/homeScreen.test.tsx`<br>`front/tests/unit/libraryScreen.test.tsx`<br>`front/tests/unit/pointsScreen.test.tsx`<br>`front/tests/unit/recommendationPreviewBuffer.test.tsx`<br>`front/tests/unit/savedVideoScreens.test.tsx`<br>`front/tests/unit/searchScreen.test.tsx`<br>`front/tests/unit/sessionExpiredDialog.test.tsx` | task-8 |
| 10 | 다국어 본편 재생과 계정 설정 연결 | `front/src/screens/playbackScreen_episode.tsx`<br>`front/src/screens/AccountScreen.tsx`<br>`front/src/features/user/UserProvider.tsx`<br>`front/README.md` | task-4, task-8, task-9 |

## 실행 순서 및 병렬 작업
- task-1 → task-2, task-3은 독립. task-4는 1/2/3 완료 후 구현하고 선택 API → 최종 전체 HTTP를 실행한다.
- task-5 → task-6, task-7은 독립. task-8은 6/7 완료 후 구현하고 파서/훅 및 typecheck를 실행한다.
- task-9는 8 완료 후 테스트 작성/기존 mock 적응. task-10은 4/8/9 완료 후 Provider·UI·문서 구현 및 검사를 실행한다.
- 선행 없는 1/3/5/7은 수정 파일·출력이 독립적이므로 병렬 가능하다. 2와 3, 4와 6/7/8/9도 파일·fixture/출력이 독립적이면 병렬 가능하다. CLI의 공통 환경설정/동일 빌드 출력 검사는 동시에 실행하지 않는다.
- 공유 파일 담당은 한 task로 제한한다. API run.mjs/suites.mjs는 1만, 기존 playback 화면 테스트는 9만, Provider는 10만, 응답 타입은 back=4/front=8만 수정한다.
- 메인 외 동시 worker 최대 3명. 자식 예약 0명. 모든 task는 2뎁스 반복 위임 불가: fixture/파서/훅/화면은 설계가 다르고, 3과 9의 반복 mock/검사 변경은 담당 worker가 직접 처리한다.
- 계획 작성 단계에서는 worker를 배정하지 않는다. 실행은 사용자의 명시적 $harness 호출 후에만 한다.

## 성공 기준·검증
C1 무료/구매/미권한·비공개 응답과 en/ko/empty를 HTTP로 검증하고 기존 모든 suite를 보존한다. C2 시간 경계/양 형식을 순수 테스트로, C3 언어 요청 경합/실패를 실제 훅으로, C4 언어 선택·설정 공유·탐색/화면 수명과 기존 저장/진행률을 화면 테스트로 확인한다.
T1은 독립 fixture 검사·문법 즉시 실행, T2/3은 JSON 및 collection event script 문법 즉시 실행. T2는 기존 suiteSelection의 신규 suite 기대값을 갱신하고 즉시 단위 검사를 실행한다. 신제품 응답을 요구하는 HTTP만 T4로 유예한다. T5/7은 미래 모듈 import로 실행 불가하여 해당 소스 T6/8로 유예한다. T9 기존9 검사는 즉시, 새 화면 검사와 typecheck는 T10으로 유예한다. 각 task의 checks는 해당 문서와 index.json이 일치한다.
runner와 8개 컬렉션 소비 검사 영향으로 T4는 선택 수정 검증 뒤 전체 test:api를 한 번 실행한다. 프론트는 영향받는 정확한 파일 선택 검사 후 T10 export를 실행한다. finish는 공통 규칙에 따라 front typecheck/test/export와 back lint/test/build 전체를 검증한다. 실패/미실행 check가 있는 소스 task는 완료하지 않는다.

