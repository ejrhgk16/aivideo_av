# task-9-saved-video-response-types

## 읽어야 할 파일

- `AGENTS.md`
- `_docs/ARCHITECTURE.md`
- `back/test/api/README.md`
- `_docs/api/00-overview/response-compatibility.md`
- `_docs/plans/plan-46-api-response-contracts/task-2-backend-response-types.md`
- `back/src/playback/savedVideoService.ts`
- `back/src/playback/savedVideoController.ts`
- `back/test/unit/playback/savedVideoService.spec.ts`

## 작업

- 새 `savedVideoResponses.ts`에 SavedContentType, SavedVideoItemResponse, SavedVideoPageResponse와 필요한 공개 하위 type을 정의한다.
- 기존 `SavedContentType = 'EPISODE' | 'PREVIEW'` 및 SavedVideoBase의 공개 필드를 그대로 유지한다. PREVIEW는 episodeUuid/episodeNumber/episodeTitle이 모두 null이다. EPISODE는 episodeUuid:string, episodeNumber:number, episodeTitle:string|null이다.
- `SavedVideoPageResponse = { items:SavedVideoItemResponse[];page:number;hasNext:boolean }`를 정의한다. SavedVideoService.list와 SavedVideoController.list에 `Promise<SavedVideoPageResponse>`를 명시한다.
- service의 기존 `const base: SavedVideoBase` 등 타입 사용도 import 또는 적절한 지역 alias로 연결한다. 새로운 필드를 만들거나 nullable을 optional로 바꾸지 않는다.
- save/remove의 Promise<void> 및 HTTP 204, SQL/SavedRow, page·hasNext 계산·정렬·공개 조건·영상 타입 분기·예외·UseFilters는 그대로 유지한다.

### 변경 성격과 경계

새 런타임 로직은 없다. 현재 응답의 type 선언 위치·이름·type import와 메서드 반환 annotation만 정리한다. 성공 JSON의 키·값·배열 순서·nullable/optional·HTTP 상태를 바꾸지 않고 data wrapper를 추가하지 않는다.

동시에 다른 worker가 별도 도메인을 수정한다. 다른 worker의 변경을 되돌리지 않으며, 새로 생성 중인 다른 도메인의 Responses 파일을 import하지 않는다. Entity와 기존 공통 mediaUrl 등 변경하지 않는 파일은 읽을 수 있다. 도메인별 응답은 각 파일에서 독립 정의하고 신규 범용 응답 추상화를 만들지 않는다.

공통 `_docs/ARCHITECTURE.md`, API 문서·컬렉션은 수정하지 않는다. Architecture 갱신과 HTTP 보존 검증은 모든 도메인 작업 이후 task-2가 담당하고, 오류 API 문서·컬렉션 변경은 task-3이 담당한다. 이 task는 정확히 선언된 기존 단위 테스트를 `--no-cache`로 실행한다. 병렬 worker가 아직 파일을 편집하는 동안 back build/전체 tsc/실제 HTTP suite를 임의 실행하지 않는다. 컴파일과 HTTP 확인은 task-2의 의존성으로 보장하며, 이 task의 단위 테스트만으로 API 응답 보존을 통과했다고 보고하지 않는다.

### 수정 허용 파일

- `back/src/playback/savedVideoResponses.ts`
- `back/src/playback/savedVideoService.ts`
- `back/src/playback/savedVideoController.ts`

### 검증과 영향 범위

~~~text
npm --prefix back run test:unit -- --no-cache test/unit/playback/savedVideoService.spec.ts
~~~

선택 테스트는 이 task가 편집하는 컨트롤러·서비스 또는 공개/환경/응답 내부 경계의 기존 소비 테스트다. 테스트 파일은 읽기·실행만 하므로 files에 넣지 않는다. Vitest의 결과 캐시를 끄고 coverage/report/snapshot을 생성하지 않는다. 다른 worker와 테스트 파일·제품 편집 파일이 겹치지 않으며 DB fixture도 사용하지 않는다.

최종 HTTP 소비 검사: task-2의 `saved-videos` suite. 모든 도메인 선언이 완성된 뒤 기존 3000 서버가 변경 코드를 반영한 것을 확인하고 task-1의 strict assertion을 그대로 실행한다.

### 의존성과 완료 조건

- depends_on: `["task-1"]`. task-1이 기존 API에서 strict baseline을 통과시키기 전 실행하지 않는다.
- task-5/6/7/8/9는 편집 파일이 겹치지 않아 병렬 후보이며 Harness는 최대 3개 worker씩 실행한다. 이 task에서 worker를 직접 생성하지 않는다.
- 현재 응답 구조를 바꾸지 않고 선언을 정리했으며 명시한 단위 테스트가 통과한다.
- 공통 빌드·HTTP 검증은 task-2에 남아 있음을 완료 요약에 명시한다. 컴파일을 통과시키려고 any/강제 캐스팅/필드 optional 처리로 숨기지 않는다.
