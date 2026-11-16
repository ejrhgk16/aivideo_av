# task-7-subtitle-loader-tests

## 기본 입력
- 이 task 문서와 index.json의 task-7 항목.
- 컨텍스트로 전달된 적용 지침과 필요한 선행 task 완료 요약: 없음.
- 다른 작업자가 같은 저장소에서 작업한다. 다른 작업자의 변경을 되돌리지 말고 담당 파일 안에서 선행 변경에 맞춰 작업한다.

## 읽어야 할 파일
- front/tests/setup.ts: cleanup·fetch 복원·타이머 설정
- front/tests/unit/previewPlayback.test.ts: fetch 경계 스타일
- .agents/skills/react-native-testing/SKILL.md 및 references/api-reference-v13.md
- .agents/skills/javascript-typescript-jest/SKILL.md

## 필요 시 참고할 문서
- 적용 지침이 누락/변경된 경우에만 루트 AGENTS.md.
- 구조/파일 책임 판단이 필요한 경우에만 _docs/ARCHITECTURE.md의 Frontend 및 Boundaries 섹션.
- 계약 누락/충돌이 발견되면 plan.md의 C1, C2, C3 및 C6만 참조하고 affected task를 보류해 메인에게 보고한다. 승인 계약을 추측/변경하지 않는다.
- 테스트 코드 작성 시 프론트는 해당 RNTL/Jest 스킬의 필요한 버전/경계 문서, 백엔드는 back/README.md 검증의 fixture·lock·실패 판정 부분을 따른다.

## 실패 시 참고할 파일
- 테스트/인프라 작성 task: 담당 테스트·직접 의존 경계에서 먼저 원인을 확인한다. 관련 없는 소스 전체를 읽지 않는다.

## 작업

### 역할과 완료 조건
미구현 훅 테스트 작성. RNTL renderHook으로 실제 훅·파서를 사용하고 global fetch만 대체한다. 반환 Response의 ok/text, deferred 완료 순서와 AbortSignal을 명시한다. undefined, 성공 양 형식, HTTP/본문 실패, 빈 cue, ON/OFF/position 재렌더, ko→en 경합·unmount를 검사한다. 미래 훅/타입/파서 import가 필요한 Jest/typecheck는 task-8로 유예한다. 독립 helper를 export하거나 작성하지 않아 즉시 checks는 없다.

정확한 수정 허용 파일:
- `front/tests/unit/useEpisodeSubtitles.test.tsx`

checks (저장소 루트):
- `checks: []`: 미래 제품 모듈을 import하는 검사만 있으므로 소스 task로 유예.

koTrack은 C1의 실제 타입으로 선언한다. 지연 helper는 해당 파일 안에서만 정의한다. 비동기 완료를 모두 await하고 전역 fetch를 원래 값으로 복원한다.

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

### 반복 작업 위임
불가. 메인 외 최대 worker 3명, 자식 예약 0명. 독립적인 fixture/계약/상태 로직으로 단순 반복 위임 대상이 아니다.

### 주요 로직 코드 또는 변경 예시
아래는 승인된 경계와 핵심 흐름을 나타내는 예시다. 담당 구현은 모든 완료 조건을 충족하도록 완성한다.
```tsx
const { result, rerender } = renderHook(
  ({ subtitle, enabled, positionMs }) => useEpisodeSubtitles(subtitle, enabled, positionMs),
  { initialProps: { subtitle: koTrack, enabled: true, positionMs: 1500 } },
);
await act(async () => koResponse.resolve({
  ok: true, text: async () => 'WEBVTT\n\n00:01.000 --> 00:02.000\n안녕',
}));
await waitFor(() => expect(result.current.text).toBe('안녕'));
rerender({ subtitle: koTrack, enabled: false, positionMs: 1500 });
expect(result.current.text).toBe('');
```

