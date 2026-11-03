# task-1-common-pagination

## 읽어야 할 파일

- `AGENTS.md`
- `_docs/ARCHITECTURE.md`
- `_docs/plans/README.md`
- `.agents/skills/api-and-interface-design/SKILL.md`
- `.agents/skills/nestjs-best-practices/SKILL.md`
- `back/src/playback/savedVideoController.ts`
- `back/src/playback/savedVideoService.ts`
- `back/src/playback/savedVideoResponses.ts`
- `_docs/api/04-playback/saved-videos.md`
- `back/tsconfig.build.json`

조사 시 적용 대상 경로에 하위 `AGENTS.md`는 없었다. 실행 시 새 지침이 있다면 확인한다.

## 작업

페이지 입력 검증·조회 범위·응답 생성을 공통 함수로 추출할 준비를 한다. 기존 소비 기능은 task-2에서 전환한다.

### 수정 허용 파일

- `back/src/common/pagination/pagination.ts` — 신규
- `back/src/common/pagination/paginationResponses.ts` — 신규
- `_docs/ARCHITECTURE.md`

`depends_on`: 없음. 다른 작업자와 코드베이스를 공유하므로 타인의 변경을 되돌리지 말고 현재 변경 상태에 맞춰 작업한다. 파일 수정은 `apply_patch`만 사용한다.

### 구현 지시

1. `PageResponse<T>`는 `items: T[]`, `page: number`, `hasNext: boolean`만 포함한다. 런타임 DTO·Nest module·provider는 만들지 않는다.
2. 페이지 크기는 호출자가 전달하는 내부 숫자다. 이를 HTTP query에서 읽거나 이 공통 코드에 저장 영상 전용 상수 30을 두지 않는다. 내부 함수에 이미 검증한 page나 코드 상수 pageSize를 재검증하는 방어 코드를 추가하지 않는다.
3. `parsePage(rawPage, pageSize)`는 현재 Controller의 엄격한 문자열 정규식, 기본 page 1, 안전 정수 및 `offset + limit` 안전성 검사를 유지한다. 잘못된 입력은 기존처럼 `BadRequestException('Invalid page')`를 던진다. 전역 에러 필터는 변경하지 않는다.
4. `getPageWindow(page, pageSize)`는 offset과 한 개 더 조회하는 limit을 반환한다. QueryBuilder·Repository·도메인 타입에 의존하지 않는다.
5. `createPageResponse`는 추가 조회 행이 포함된 배열에서 페이지 크기만 잘라 `items`를 만들고 원래 배열 길이로 `hasNext`를 판정한다. 항목 변환 callback은 받지 않는다. 변환은 소비 서비스가 수행한다.
6. `_docs/ARCHITECTURE.md`의 Backend 책임 표에 `src/common/pagination/`을 추가한다. 책임은 'Shared strict page parsing, offset/lookahead calculation, and generic items/page/hasNext response helpers; domain services own page sizes, queries, ordering, and item mapping.'으로 명시한다. 인접 문서를 정리하거나 다른 API가 이 모듈을 이미 사용한다고 쓰지 않는다.

### 주요 로직 코드 또는 변경 예시

`paginationResponses.ts`:

```ts
export type PageResponse<T> = {
  items: T[];
  page: number;
  hasNext: boolean;
};
```

`pagination.ts`:

```ts
import { BadRequestException } from '@nestjs/common';
import type { PageResponse } from './paginationResponses.js';

export function getPageWindow(page: number, pageSize: number) {
  return { offset: (page - 1) * pageSize, limit: pageSize + 1 };
}

export function parsePage(rawPage: unknown, pageSize: number): number {
  const page = rawPage === undefined
    ? 1
    : typeof rawPage === 'string' && /^[1-9][0-9]*$/.test(rawPage) ? Number(rawPage) : NaN;
  const { offset, limit } = getPageWindow(page, pageSize);
  if (!Number.isSafeInteger(page) || page < 1 || !Number.isSafeInteger(offset + limit)) {
    throw new BadRequestException('Invalid page');
  }
  return page;
}

export function createPageResponse<T>(rows: T[], page: number, pageSize: number): PageResponse<T> {
  return {
    items: rows.slice(0, pageSize),
    page,
    hasNext: rows.length > pageSize,
  };
}
```

### 검증 명령

```text
npm --prefix back run build
```

신규 공통 함수·제네릭 응답 타입을 기존 백엔드 TypeScript 설정으로 컴파일한다. 아키텍처 표의 경로·책임이 실제 export와 일치하는지 직접 확인한다. 아직 사용하지 않는 함수의 런타임 동작은 task-2에서 실제 HTTP 소비 기능으로 검증한다. 이 task에서 임의 단위 테스트나 API suite를 추가하지 않는다.

### 완료 조건

- 허용된 신규 두 파일과 아키텍처 표만 변경했다.
- 공통 코드는 저장 영상 엔티티·서비스, DB, 인증 및 항목 변환에 의존하지 않는다.
- 기존 page 검증과 lookahead 의미가 보존되고 build가 통과했다.
- task-2가 위 export 이름과 인자 순서로 사용할 수 있다. 아직 제품 API가 전환됐다고 보고하지 않는다.
