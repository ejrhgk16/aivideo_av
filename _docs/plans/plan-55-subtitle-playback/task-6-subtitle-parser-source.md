# task-6-subtitle-parser-source

## 기본 입력
- 이 task 문서와 index.json의 task-6 항목.
- 컨텍스트로 전달된 적용 지침과 필요한 선행 task 완료 요약: task-5.
- 다른 작업자가 같은 저장소에서 작업한다. 다른 작업자의 변경을 되돌리지 말고 담당 파일 안에서 선행 변경에 맞춰 작업한다.

## 읽어야 할 파일
- front/src/features/playback/watchProgress.ts: 순수 함수 파일 스타일
- front/tsconfig.json: strict·alias

## 필요 시 참고할 문서
- 적용 지침이 누락/변경된 경우에만 루트 AGENTS.md.
- 구조/파일 책임 판단이 필요한 경우에만 _docs/ARCHITECTURE.md의 Frontend 및 Boundaries 섹션.
- 계약 누락/충돌이 발견되면 plan.md의 C2 및 C6만 참조하고 affected task를 보류해 메인에게 보고한다. 승인 계약을 추측/변경하지 않는다.
- 테스트 코드 작성 시 프론트는 해당 RNTL/Jest 스킬의 필요한 버전/경계 문서, 백엔드는 back/README.md 검증의 fixture·lock·실패 판정 부분을 따른다.

## 실패 시 참고할 파일
- front/tests/unit/subtitles.test.ts의 실패한 입력/기대값.

## 작업

### 역할과 완료 조건
소스 구현·검증. C2의 텍스트 파싱과 시간 조회만 구현한다. React/player/네트워크/UI는 소유하지 않는다. 라이브러리와 설정을 추가하지 않는다. task-5 테스트를 실행하고 계약별 경계를 자체 검토한다.

정확한 수정 허용 파일:
- `front/src/features/playback/subtitles.ts`

checks (저장소 루트):
- `npm --prefix front run test -- tests/unit/subtitles.test.ts`

예제의 흐름 설명을 실제 함수 구현 대신 남기지 않는다. 토큰 파싱·본문 처리·시각 범위 검증을 완성하고 새 공개 export는 C2 두 함수와 타입으로 제한한다.

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
export function parseSubtitles(source: string, format: 'VTT' | 'SRT'): SubtitleCue[] {
  const normalize = source.replace(/^\uFEFF/, '').replace(/\r\n?/g, '\n');
  const timestamp = (value: string): number | null => {
    const pattern = format === 'SRT'
      ? /^(\d{2,}):(\d{2}):(\d{2}),(\d{3})$/
      : /^(?:(\d{2,}):)?(\d{2}):(\d{2})\.(\d{3})$/;
    const match = value.match(pattern);
    if (!match) return null;
    const h = Number(match[1] ?? 0), m = Number(match[2]);
    const s = Number(match[3]), ms = Number(match[4]);
    const result = ((h * 60 + m) * 60 + s) * 1000 + ms;
    return m < 60 && s < 60 && Number.isFinite(result) ? result : null;
  };
  const entities: Record<string, string> = {
    '&amp;': '&', '&lt;': '<', '&gt;': '>', '&nbsp;': '\u00a0',
    '&lrm;': '\u200e', '&rlm;': '\u200f',
  };
  const cues: SubtitleCue[] = [];
  for (const block of normalize.split(/\n[ \t]*\n/)) {
    const lines = block.split('\n');
    if (/^(WEBVTT(?:[ \t]|$)|NOTE(?:[ \t]|$)|STYLE$|REGION$)/.test(lines[0])) continue;
    const i = lines.findIndex(line => line.includes('-->'));
    if (i < 0) continue;
    const timing = lines[i].trim().match(/^(\S+)\s+-->\s+(\S+)(?:\s+.*)?$/);
    if (!timing) continue;
    const startMs = timestamp(timing[1]), endMs = timestamp(timing[2]);
    const text = lines.slice(i + 1).join('\n').replace(/<[^>]*>/g, '')
      .replace(/&(amp|lt|gt|nbsp|lrm|rlm);/g, entity => entities[entity]).trim();
    if (startMs !== null && endMs !== null && endMs > startMs && text) {
      cues.push({ startMs, endMs, text });
    }
  }
  return cues;
}
export function getSubtitleText(cues: readonly SubtitleCue[], positionMs: number): string {
  if (!Number.isFinite(positionMs) || positionMs < 0) return '';
  return cues.filter(cue => cue.startMs <= positionMs && positionMs < cue.endMs)
    .map(cue => cue.text).join('\n');
}
```

