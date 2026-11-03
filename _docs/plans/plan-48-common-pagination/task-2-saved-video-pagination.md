# task-2-saved-video-pagination

## 읽어야 할 파일

- `AGENTS.md`
- `_docs/ARCHITECTURE.md`
- `_docs/plans/README.md`
- `.agents/skills/api-and-interface-design/SKILL.md`
- `.agents/skills/nestjs-best-practices/SKILL.md`
- `back/src/common/pagination/pagination.ts`
- `back/src/common/pagination/paginationResponses.ts`
- `back/src/playback/savedVideoController.ts`
- `back/src/playback/savedVideoService.ts`
- `back/src/playback/savedVideoResponses.ts`
- `back/test/unit/playback/savedVideoService.spec.ts`
- `back/test/api/README.md`
- `back/test/api/saved-videos.postman_collection.json`
- `_docs/api/04-playback/saved-videos.md`
- `_docs/api/00-overview/conventions.md`

조사 시 적용 대상 경로에 하위 `AGENTS.md`는 없었다. 실행 시 새 지침이 있다면 확인한다.

## 작업

task-1의 공통 함수·응답 타입을 저장 영상 목록에 적용한다. 현재 API의 외부 동작은 바꾸지 않는다.

### 수정 허용 파일

- `back/src/playback/savedVideoController.ts`
- `back/src/playback/savedVideoService.ts`
- `back/src/playback/savedVideoResponses.ts`
- `back/test/api/saved-videos.postman_collection.json`
- `_docs/api/04-playback/saved-videos.md`

`depends_on`: `task-1`. 다른 작업자와 코드베이스를 공유하므로 타인의 변경을 되돌리지 말고 현재 변경 상태에 맞춰 작업한다. 파일 수정은 `apply_patch`만 사용한다. 기존 단위 테스트와 공통 모듈은 읽고 실행하는 대상으로, 이 task에서 수정하지 않는다.

### 구현 지시

1. `savedVideoService.ts`에 기능 전용 `export const SAVED_VIDEO_PAGE_SIZE = 30`을 두고 Controller에서도 이 상수를 import한다. 상수·타입·유틸을 위한 추가 파일은 생성하지 않는다.
2. Controller의 직접 page 파싱·검증을 `parsePage(rawPage, SAVED_VIDEO_PAGE_SIZE)` 호출로 교체한다. PUT·DELETE에서 사용하는 `BadRequestException` import와 기존 입력 검증은 유지한다.
3. 서비스 `list(userUuid, page)`의 인자·반환 타입은 유지한다. 조회 범위만 `getPageWindow`로 계산한다. 공개 필터와 JWT 사용자·종류 조건, 조인, 이미지 선택, 정렬을 유지하고 필터 뒤 DB offset·limit을 적용한다.
4. `createPageResponse`로 최대 30개의 조회 행을 선택한 후 기존 응답 항목 변환을 수행한다. 31번째 lookahead 행을 응답에 포함하거나 먼저 버려 `hasNext`를 잃지 않는다. 추가 행의 직렬화·이미지 처리가 필요하지 않도록 자른 후 변환한다.
5. `SavedVideoPageResponse`를 `PageResponse<SavedVideoItemResponse>` 별칭으로 변경한다. 기존 도메인 export 이름과 PREVIEW·EPISODE 판별 union, null 규칙은 유지한다. 프론트와 백엔드 간 소스 타입 공유는 추가하지 않는다.
6. Postman의 기존 잘못된 page 반복문에 `01`, 앞뒤 공백, `+1`, `1e0`를 추가하고 모두 기존 400 공통 오류 형식으로 거부되는지 검증한다. query 값은 기존 `encodeURIComponent(page)`로 전달한다. 기존 빈 목록, 30/31개 경계, page 2·3, limit 무시, 중복 저장, 동률 정렬, 비공개·타 사용자 제외, 삭제·공개 조회 플래그 검증을 완화하지 않는다. 기존 관리형 fixture와 소유 키 정리 흐름을 유지한다.
7. API 문서의 page 설명을 현재 실제 규칙으로 구체화한다. 생략 시 1, `[1-9][0-9]*` 형태의 단일 query 문자열, page와 `(page - 1) * 30 + 31`의 안전 정수 조건, 잘못된 값·중복 값의 400 응답을 명시한다. 빈 문자열, 0·음수·소수·선행 0·부호·공백·지수 표기는 거부된다. 외부 API에 pageSize·limit 설정 또는 total 필드를 추가하지 않는다.
8. 저장·삭제 코드, 타 endpoint, 인증·에러 공통 코드, SQL 인덱스·시드·환경 설정은 수정하지 않는다.

### 주요 로직 코드 또는 변경 예시

Controller의 기존 GET 메서드 호출 지점:

```ts
list(@Req() request: AuthenticatedRequest, @Query('page') rawPage: unknown): Promise<SavedVideoPageResponse> {
  const page = parsePage(rawPage, SAVED_VIDEO_PAGE_SIZE);
  return this.savedVideos.list(request.user.uuid, page);
}
```

서비스 파일의 기능 상수와 `list`의 범위 계산:

```ts
export const SAVED_VIDEO_PAGE_SIZE = 30;

const { offset, limit } = getPageWindow(page, SAVED_VIDEO_PAGE_SIZE);
```

서비스의 기존 QueryBuilder 체인 마지막 `.offset((page - 1) * 30).limit(31)`만 `.offset(offset).limit(limit)`으로 교체한다. 그 뒤 `getRawMany<SavedRow>()`까지 유지한다. 조회 후 응답은 다음 흐름으로 생성한다. 공통 모듈은 행의 도메인 필드를 알지 않는다.

```ts
const result = createPageResponse(rows, page, SAVED_VIDEO_PAGE_SIZE);
return {
  ...result,
  items: result.items.map<SavedVideoItemResponse>(row => {
    const base: SavedVideoBase = {
      videoUuid: row.videoUuid,
      savedAt: row.savedAt.toISOString(),
      dramaUuid: row.dramaUuid,
      dramaTitle: row.dramaTitle,
      imageUrl: createDramaImageUrls({
        poster: row.imageKey, posterLandscape: null, homeHero: null,
        detailCover: null, campaigns: [],
      }).poster,
      durationMs: Number(row.durationMs),
    };
    return row.contentType === 'PREVIEW'
      ? { ...base, contentType: 'PREVIEW', episodeUuid: null, episodeNumber: null, episodeTitle: null }
      : { ...base, contentType: 'EPISODE', episodeUuid: row.episodeUuid!,
        episodeNumber: Number(row.episodeNumber), episodeTitle: row.episodeTitle };
  }),
};
```

추가하는 서비스 import는 공통 `getPageWindow`·`createPageResponse`와 기존 응답 파일의 `SavedVideoItemResponse`다. Controller는 공통 `parsePage`와 서비스의 `SAVED_VIDEO_PAGE_SIZE`를 import한다. 기존 ESM `.js` 경로 규칙을 따른다.

응답 파일은 공통 타입 import 후 기존 별칭 이름을 유지한다.

```ts
import type { PageResponse } from '../common/pagination/paginationResponses.js';

export type SavedVideoPageResponse = PageResponse<SavedVideoItemResponse>;
```

Postman의 기존 거부 입력 배열은 다음 값으로 보강한다. 기존 중복 query 검사와 다른 경계 검사는 유지한다.

```js
['', '0', '-1', '1.5', 'abc', '01', ' 1', '1 ', '+1', '1e0',
  '9007199254740991', '999999999999999999999']
```

### 검증 명령

```text
npm --prefix back run test:unit -- test/unit/playback/savedVideoService.spec.ts
npm --prefix back run test:api -- --suite saved-videos
```

기존 단위 테스트는 수정하지 않고 실행한다. 단위 테스트로 UTC 직렬화·항목 변환과 DB 오류 전파를 확인하고, Postman으로 실제 공통 함수 사용과 API 계약을 검증한다.

API 검증 전에 `http://localhost:3000/`에 HTTP 요청하여 기존 서버에 연결되는지 확인하고 변경 코드가 해당 서버에 반영됐는지도 확인한다. 반영 여부를 확인할 수 없으면 사용자에게 확인한다. 별도 서버나 다른 포트는 사용하지 않는다. 서버가 없으면 검증 실패로 처리하고 `npm --prefix back run start:dev` 실행을 안내한다.

`back/test/api/README.md`의 공개 콘텐츠·DB·서명 설정이 필요하다. suite는 실행별 fixture를 독점 content lock 안에서 생성·정리하며 기존 개발 데이터를 reset·seed·수정하지 않는다. API 연결·필수 데이터·검증·정리 실패를 성공 처리하지 않는다. 비밀 값을 출력하지 않는다.

공통 모듈의 유일한 소비자가 저장 영상이며 다른 endpoint는 바꾸지 않으므로 이 suite로 영향 범위를 한정한다. 전체 빌드·다른 API suite 반복은 최종 `$finish-plan`의 전체 검증에 맡긴다.

### 완료 조건

- page 파싱, offset/lookahead 계산, 잘라내기·hasNext 판정이 공통 함수에만 있고 저장 영상의 상수 30은 기능 코드 한 곳에서 정의된다.
- 저장 영상 쿼리·정렬·공개 조건·사용자 격리와 응답 필드·타입·UTC 값이 보존된다.
- 문서와 거부 입력 검증이 현재 계약과 일치하며 두 검증 명령이 통과했다.
- 신규 페이지 유틸·응답 타입이 실제 Controller·Service·응답 별칭에서 사용된다.
- API 계약과 무관한 수정, 새 페이지 기능, 새 단위 테스트 또는 타인의 변경 되돌리기가 없다.
