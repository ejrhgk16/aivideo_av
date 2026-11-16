# task-5-subtitle-parser-tests

## 기본 입력
- 이 task 문서와 index.json의 task-5 항목.
- 컨텍스트로 전달된 적용 지침과 필요한 선행 task 완료 요약: 없음.
- 다른 작업자가 같은 저장소에서 작업한다. 다른 작업자의 변경을 되돌리지 말고 담당 파일 안에서 선행 변경에 맞춰 작업한다.

## 읽어야 할 파일
- front/tests/unit/watchProgress.test.ts: 순수 함수 테스트 스타일
- front/package.json 및 lockfile: Jest/TypeScript 버전
- .agents/skills/javascript-typescript-jest/SKILL.md

## 필요 시 참고할 문서
- 적용 지침이 누락/변경된 경우에만 루트 AGENTS.md.
- 구조/파일 책임 판단이 필요한 경우에만 _docs/ARCHITECTURE.md의 Frontend 및 Boundaries 섹션.
- 계약 누락/충돌이 발견되면 plan.md의 C2 및 C6만 참조하고 affected task를 보류해 메인에게 보고한다. 승인 계약을 추측/변경하지 않는다.
- 테스트 코드 작성 시 프론트는 해당 RNTL/Jest 스킬의 필요한 버전/경계 문서, 백엔드는 back/README.md 검증의 fixture·lock·실패 판정 부분을 따른다.

## 실패 시 참고할 파일
- 테스트/인프라 작성 task: 담당 테스트·직접 의존 경계에서 먼저 원인을 확인한다. 관련 없는 소스 전체를 읽지 않는다.

## 작업

### 역할과 완료 조건
미구현 기능 테스트 작성. C2 제품 함수를 직접 import하고 네트워크/React mock 없이 inline 문자열로 각 경계를 검증한다. 새 helper/fixture 파일은 만들지 않는다. 직접 실행 가능한 독립 검사가 없다. 미래 subtitles.ts import를 요구하는 Jest 및 typecheck는 task-6/8로 유예한다. 테스트 작성 완료는 동작 통과를 의미하지 않는다.

정확한 수정 허용 파일:
- `front/tests/unit/subtitles.test.ts`

checks (저장소 루트):
- `checks: []`: 미래 제품 모듈을 import하는 검사만 있으므로 소스 task로 유예.

C2의 VTT 최소/시간 설정/블록·엔티티, 여러 cue 겹침·순서, 빈 파일·잘못된 시간·잘못된 cue 뒤 정상 cue 보존을 각각 독립 시나리오로 작성한다.

완료 전 imports/실제 export·fixture·mock 전제조건·비동기 이벤트 순서·assertion을 적용 계약 및 설치 도구와 대조한다. 테스트 작성 task는 계약 ID별 검증 파일/테스트 이름과 즉시 실행 결과·유예 대상 소스 task를 보고한다. 소스 task는 선언 checks 전체 통과와 계약별 동작/기존 소비 회귀 결과를 보고한다. 검증만을 위해 테스트 파일 전체를 미리 읽을 필요는 없다. 범위 밖 테스트 결함은 메인에게 근거와 함께 보고하며 assertion을 약화하지 않는다. 실패·미실행은 통과가 아니다. 제품 코드 변경 task가 아니면 제품 코드를 수정하지 않는다.

### 적용 계약
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

### 반복 작업 위임
불가. 메인 외 최대 worker 3명, 자식 예약 0명. 독립적인 fixture/계약/상태 로직으로 단순 반복 위임 대상이 아니다.

### 주요 로직 코드 또는 변경 예시
아래는 승인된 경계와 핵심 흐름을 나타내는 예시다. 담당 구현은 모든 완료 조건을 충족하도록 완성한다.
```tsx
import { getSubtitleText, parseSubtitles } from '@/features/playback/subtitles';
test('종료 시각 제외와 뒤로 탐색', () => {
  const cues = parseSubtitles('1\n00:00:01,000 --> 00:00:02,000\n안녕\n', 'SRT');
  expect(getSubtitleText(cues, 1000)).toBe('안녕');
  expect(getSubtitleText(cues, 2000)).toBe('');
  expect(getSubtitleText(cues, 1500)).toBe('안녕');
});
```

