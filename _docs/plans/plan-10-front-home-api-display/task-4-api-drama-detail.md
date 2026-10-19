# task-4-api-drama-detail

## 읽어야 할 파일

- `AGENTS.md`
- `front/AGENTS.md`
- `_docs/ARCHITECTURE.md`
- `_docs/api/02-content/dramas.md`
- `front/src/screens/DramaDetailScreen.tsx`
- `front/src/features/drama/dramaContent.ts`
- `front/src/features/drama/catalog.ts`
- `front/src/common/media.ts`
- `front/src/components/ui.tsx`
- Expo 57 공식 문서: `https://docs.expo.dev/versions/v57.0.0/sdk/image/`

## 작업

정확한 변경 파일 범위:

- `front/src/screens/DramaDetailScreen.tsx`
- `front/src/screens/ApiDramaDetailScreen.tsx` (신규)

기존 정적 카탈로그 작품 ID는 기존 상세 화면을 유지한다. 카탈로그에 없는 API 작품 ID는 새 상세 컴포넌트에서 공개 작품 상세 API로 조회한다. 제목, 소개·줄거리, 제작사, 장르, 상세 커버, 공개 회차·무료 여부를 응답 그대로 표시한다. 로딩, 404/요청 실패, 이미지 없음, 공개 회차 없음의 상태를 제공한다. API 작품의 재생·구매·저장처럼 아직 동작이 연결되지 않은 버튼은 비활성화하거나 표시하지 않는다. 정적 시안의 기존 재생·저장 흐름은 변경하지 않는다.

완료 조건: 홈에서 넘긴 API UUID의 상세 내용이 표시되고, 요청 실패·미존재 ID가 빈 화면이 되지 않으며, 정적 작품 상세와 API 작품 상세가 각각 올바르게 선택된다.

검증 명령:

- `npm --prefix front run typecheck`
- `npm --prefix front run test`
- `npm --prefix front run export`
