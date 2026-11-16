# task-9-subtitle-screen-tests

## 기본 입력
- 이 task 문서와 index.json의 task-9 항목.
- 컨텍스트로 전달된 적용 지침과 필요한 선행 task 완료 요약: task-8.
- 다른 작업자가 같은 저장소에서 작업한다. 다른 작업자의 변경을 되돌리지 말고 담당 파일 안에서 선행 변경에 맞춰 작업한다.

## 읽어야 할 파일
- front/tests/unit/playbackScreenEpisode.test.tsx: 기존 route/deferred/player helper와 기존 회귀 시나리오
- front/tests/support/video.ts: emit/시간/cleanup
- front/src/features/user/UserProvider.tsx: 실제 Provider의 기존 계약
- front/src/screens/AccountScreen.tsx: 설정 다이얼로그 진입점
- front/tests/unit/episodeUnlockDialog.test.tsx: 실제 Provider/Router 경계의 재사용 가능한 부분
- 다른 담당 9개 파일: useUser mock의 타입·초기값 부분만
- .agents/skills/react-native-testing/SKILL.md 및 references/expo.md, references/api-reference-v13.md

## 필요 시 참고할 문서
- 적용 지침이 누락/변경된 경우에만 루트 AGENTS.md.
- 구조/파일 책임 판단이 필요한 경우에만 _docs/ARCHITECTURE.md의 Frontend 및 Boundaries 섹션.
- 계약 누락/충돌이 발견되면 plan.md의 C1, C3, C4 및 C6만 참조하고 affected task를 보류해 메인에게 보고한다. 승인 계약을 추측/변경하지 않는다.
- 테스트 코드 작성 시 프론트는 해당 RNTL/Jest 스킬의 필요한 버전/경계 문서, 백엔드는 back/README.md 검증의 fixture·lock·실패 판정 부분을 따른다.

## 실패 시 참고할 파일
- 테스트/인프라 작성 task: 담당 테스트·직접 의존 경계에서 먼저 원인을 확인한다. 관련 없는 소스 전체를 읽지 않는다.

## 작업

### 역할과 완료 조건
미구현 UI 테스트 작성과 동일 패턴 mock 적응.기존 9개 파일의 session mock에 preferredSubtitleLanguage:'ko'/setPreferredSubtitleLanguage:jest.fn()만 추가한다. 이 9개 기존 검사 자체는 현재 제품 코드로 실행 가능하므로 즉시 실행한다. playbackScreenEpisode의 기존 회귀와 신규 자막 검사는 한 파일이라 전체 실행은 task-10으로 유예하되 기존 시나리오를 보존한다. 새 accountSubtitles에는 실제 UserProvider를 사용하는 두 소비자 간 ON/OFF·선호 상태 공유/유지를 검사하고 실제 AccountScreen switch를 조작한다. 테스트 전용 제품 props/export를 추가하지 않는다. 신규 필드 타입·동작이 필요한 전체 typecheck와 신규 두 화면 검사는 task-10의 Provider·화면 구현 후 실행한다.

정확한 수정 허용 파일:
- `front/tests/unit/playbackScreenEpisode.test.tsx`
- `front/tests/unit/accountSubtitles.test.tsx`
- `front/tests/unit/dramaDetailScreen.test.tsx`
- `front/tests/unit/episodeUnlockDialog.test.tsx`
- `front/tests/unit/homeScreen.test.tsx`
- `front/tests/unit/libraryScreen.test.tsx`
- `front/tests/unit/pointsScreen.test.tsx`
- `front/tests/unit/recommendationPreviewBuffer.test.tsx`
- `front/tests/unit/savedVideoScreens.test.tsx`
- `front/tests/unit/searchScreen.test.tsx`
- `front/tests/unit/sessionExpiredDialog.test.tsx`

checks (저장소 루트):
- `npm --prefix front run test -- tests/unit/dramaDetailScreen.test.tsx tests/unit/episodeUnlockDialog.test.tsx tests/unit/homeScreen.test.tsx tests/unit/libraryScreen.test.tsx tests/unit/pointsScreen.test.tsx tests/unit/recommendationPreviewBuffer.test.tsx tests/unit/savedVideoScreens.test.tsx tests/unit/searchScreen.test.tsx tests/unit/sessionExpiredDialog.test.tsx`

새 화면 시나리오: 최초 ko, 영어만 fallback, 등록 순서와 독립된 기본 선택, 사용자 en 선호→ko만 있는 회차 fallback→en 있는 회차 복귀, OFF 상태 언어 선택 유지, 늦은 ko 응답 무시, 불러오기 실패와 언어 재선택, pause/탐색/blur/error/회차·세션 교체. API/실제 영상은 경계 mock, 앱 화면·공용 UI·Provider·Router는 실제 사용. 기존9 mock 적응은 동일 패턴이며 하위 위임하지 않는다.

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
불가. 메인 외 최대 worker 3명, 자식 예약 0명. 확정 패턴 반복 파일도 이 worker가 직접 처리하고 통합 검증한다.

### 주요 로직 코드 또는 변경 예시
아래는 승인된 경계와 핵심 흐름을 나타내는 예시다. 담당 구현은 모든 완료 조건을 충족하도록 완성한다.
```tsx
const user = userEvent.setup();
await user.press(screen.getByRole('button', { name: '재생 설정' }));
await user.press(screen.getByRole('button', { name: 'English' }));
expect(screen.getByRole('button', { name: 'English' })).toBeSelected();
await act(async () => englishResponse.resolve({ ok: true, text: async () =>
  '1\n00:00:01,000 --> 00:00:02,000\nHello' }));
act(() => player.emit('timeUpdate', { currentTime: 1.5 }));
expect(await screen.findByText('Hello')).toBeOnTheScreen();
```

