# task-1-common-layer-restructure

## 읽어야 할 파일

- `AGENTS.md`
- `front/AGENTS.md`
- `_docs/ARCHITECTURE.md`
- 기존 공용 파일과 이 task의 대상 import 소비처

## 작업

다음 공용 파일을 이동하고 해당 import를 갱신한다.

- `front/src/services/experience-storage.ts` → `front/src/common/storage/experienceStorage.ts`
- `front/src/services/media.ts` → `front/src/common/media.ts`
- `front/src/services/share-drama.ts` → `front/src/common/shareDrama.ts`
- `front/src/theme/tokens.ts` → `front/src/common/theme/tokens.ts`

`experience-storage.ts`, `share-drama.ts`는 `_docs/` 외 파일명에서 단어를 camelCase로 연결하는 규칙에 맞춰 새 파일명으로 바꾼다. 파일 내용과 공개 함수 계약은 변경하지 않는다. 대상 화면·컴포넌트·provider·테스트의 import만 새 경로로 갱신한다.

변경 가능 파일은 plan-local index의 `task-1.files`만이다. `web-prototype/`과 plan 문서는 수정하지 않는다.

완료 조건:

- 기존 공용 파일과 theme 파일은 이전 경로에 남지 않는다.
- 모든 대상 import가 새 `common/` 경로를 참조한다.
- `npm --prefix front run typecheck`, `npm --prefix front run test`, `npm --prefix front run export`가 통과한다.
