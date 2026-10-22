# task-6-front-uuid-consumers

## 읽어야 할 파일
- `AGENTS.md`
- `front/AGENTS.md`
- `_docs/ARCHITECTURE.md`
- `_docs/plans/plan-17-uuid-public-int-internal-keys/task-3-public-uuid-services.md`
- `_docs/api/02-content/dramas.md`
- `_docs/api/03-programming/collections.md`
- Expo 57 공식 문서 `https://docs.expo.dev/versions/v57.0.0/` (프런트 코드 수정 전)

## 작업

정확한 수정 파일:

```text
front/src/features/drama/dramaContent.ts
front/src/features/home/homeContent.ts
front/src/screens/HomeScreen.tsx
front/src/screens/RecommendationScreen.tsx
front/src/screens/SearchScreen.tsx
front/src/screens/DramaDetailScreen.tsx
front/tests/unit/dramaContent.test.ts
front/tests/unit/homeContent.test.ts
```

1. 작품 목록·상세·컬렉션의 드라마, 회차, 제작사, 프리뷰 영상 타입에서 공개 UUID 식별자 필드명을 `id`에서 `uuid`로 바꾼다. 원래 숫자 식별자인 장르 `id`는 유지한다. 프리뷰 영상 타입에는 백엔드가 제공하는 `uuid`를 반영한다.
2. 홈·검색·추천·상세 화면이 `drama.uuid`와 `episode.uuid`를 카드 키, 비교, 작품·회차 라우팅에 사용하도록 바꾼다. 기존 `/drama/[id]`, `/episode/[id]` 경로와 route parameter 이름은 유지하되, 전달하는 **값**이 UUID임을 분명히 한다. S3 URL 및 이미지·영상 표시 동작은 변경하지 않는다.
3. 프런트 API fixture와 계약 테스트를 `uuid` 필드에 맞추고, 작품 상세 요청이 응답의 `uuid`를 경로에 넣는지 검증한다. 회차 UUID를 상세 응답에서 라우팅에 사용하는 코드가 타입 검사로 검증되게 한다.

검증 명령: `npm --prefix front run typecheck`, `npm --prefix front run test`, `npm --prefix front run export`.

완료 조건: 세 명령이 통과하고 프런트 코드의 공개 UUID 필드 접근이 `uuid`로 일관되며, 장르 숫자 `id`와 URL 경로 형태는 유지된다.
