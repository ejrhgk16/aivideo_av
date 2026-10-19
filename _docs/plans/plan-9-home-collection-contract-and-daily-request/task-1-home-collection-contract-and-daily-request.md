# task-1-home-collection-contract-and-daily-request

## 읽어야 할 파일

- `AGENTS.md`
- `front/AGENTS.md`
- `_docs/ARCHITECTURE.md`
- `_docs/api/03-programming/collections.md`
- `back/src/programming/public-collection.service.ts`
- `back/src/common/database/seed/initialData.ts`
- `front/src/features/home/homeContent.ts`
- `front/src/screens/HomeScreen.tsx`
- `front/tests/unit/homeContent.test.ts`
- `front/scripts/test-experience.cjs`
- `front/package.json`
- Expo SDK 57 공식 문서: https://docs.expo.dev/versions/v57.0.0/ (프론트 코드를 작성하기 전에 읽는다.)

## 작업

현재 백엔드 응답을 기준으로 프론트 타입을 수정하고, 홈에서 데일리 추천 컬렉션을 기존 코드별 방식으로 추가 요청한다. 추가 요청의 성공 응답 객체 전체와 오류를 기존 프론트 콘솔 처리로 확인할 수 있게 한다.

변경 파일은 아래 네 파일로 한정한다.

- `front/src/features/home/homeContent.ts`
- `front/src/screens/HomeScreen.tsx`
- `front/tests/unit/homeContent.test.ts`
- `_docs/api/03-programming/collections.md`

구현 지시:

1. `HomeCollectionDrama.images`의 기존 `POSTER`, `HERO`, `THUMBNAIL` 선언을 제거하고 다음 백엔드 필드와 타입으로 맞춘다. `previewVideos`도 백엔드와 같은 필수 배열 필드로 추가한다. 그 외 필드는 백엔드 계약과 일치하는지 확인하고, 이미 일치하는 부분은 유지한다.

   ```ts
   images: {
     poster: string | null;
     homeHero: string | null;
     detailCover: string | null;
     campaigns: string[];
   };
   previewVideos: Array<{
     storageKey: string;
     durationMs: number;
   }>;
   ```

2. `HomeScreen`의 마운트 effect 안에 있는 기존 `collectionCodes` 배열에 `RECOMMENDATION_DAILY`를 추가한다. 기존 두 코드와 함께 `getHomeCollection(code)`를 사용해 병렬 요청하도록 기존 구조를 따른다. 별도 endpoint나 코드별 호출 함수, 중복 로그 처리를 만들지 않는다.
3. 기존 성공·오류 로그의 공통 처리를 활용하여 추가 요청에도 아래와 같이 코드와 응답 객체 전체 또는 오류가 전달되게 한다. 일부 필드만 출력하거나 문자열로 요약하지 않는다. 한 요청 실패가 다른 요청의 성공 로그를 막지 않도록 기존 요청별 `try/catch`를 유지한다.

   ```ts
   console.log(`[HomeScreen] ${code} collection`, collection);
   console.error(`[HomeScreen] ${code} collection request failed`, error);
   ```

4. 기존 `front/tests/unit/homeContent.test.ts`를 갱신한다. 빈 `dramas`만으로 계약을 확인하지 말고, `HomeCollection` 타입 또는 `satisfies HomeCollection`으로 검사되는 작품 포함 fixture를 사용한다. nullable 이미지 필드, 캠페인 storage key 배열, 프리뷰 영상의 `storageKey`와 `durationMs`를 포함하고 반환값이 응답 그대로 보존되는지 확인한다. `RECOMMENDATION_DAILY`를 포함한 세 코드의 URL을 기존 `GET /collections/:code` 규칙으로 검증하며, 기존 기본 URL·슬래시 처리 검증은 보존한다. 테스트가 변경하는 `fetch`와 환경 변수는 기존 방식대로 복원한다. 화면 소스 문자열을 읽는 테스트나 테스트 목적의 화면 로직 추출은 하지 않는다.
5. `_docs/api/03-programming/collections.md`의 홈 사용 코드 설명과 path parameter 예시에 `RECOMMENDATION_DAILY`를 추가한다. 기존 백엔드 endpoint와 응답 계약은 변경하지 않는다.

화면 매핑, 로컬 작품 데이터 교체, 백엔드·시드 변경, 추가 UI·캐시·재시도·의존성 도입은 범위 밖이다. 구조나 파일 책임을 바꾸지 않는다.

선행 조건: 없음 (`depends_on: []`). 단일 task이므로 병렬 task는 없다.

검증 명령:

```text
npm --prefix front run typecheck
npm --prefix front run test
npm --prefix front run export
```

완료 조건:

- 프론트 응답 타입이 백엔드의 이미지·프리뷰 영상 계약과 일치한다.
- 홈 effect의 요청 목록에 세 코드가 모두 포함되고 추가 코드도 기존 공통 처리로 병렬 요청된다.
- 코드 검토에서 `[HomeScreen] RECOMMENDATION_DAILY collection` 성공 로그에 응답 객체 전체가 전달되고, 실패 시 코드와 오류가 전달되는 것을 확인할 수 있다.
- 기존 단위 테스트가 백엔드 형태의 응답 보존과 데일리 코드 요청 경로를 검증하고, 세 검증 명령이 모두 통과한다.
- API 사용 코드 문서가 세 코드와 일치하고, 변경 사항이 지정한 네 파일 및 승인 범위 안에 있다.
