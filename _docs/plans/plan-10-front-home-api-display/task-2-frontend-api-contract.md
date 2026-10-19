# task-2-frontend-api-contract

## 읽어야 할 파일

- `AGENTS.md`
- `front/AGENTS.md`
- `_docs/ARCHITECTURE.md`
- `_docs/api/02-content/dramas.md`
- `_docs/api/03-programming/collections.md`
- `front/src/common/media.ts`
- `front/src/features/home/homeContent.ts`
- `front/tests/unit/media.test.ts`
- `front/tests/unit/homeContent.test.ts`
- `front/scripts/test-experience.cjs`
- Expo 57 공식 문서: `https://docs.expo.dev/versions/v57.0.0/sdk/image/`

## 작업

정확한 변경 파일 범위:

- `front/src/common/media.ts`
- `front/src/features/home/homeContent.ts`
- `front/src/features/drama/dramaContent.ts` (신규)
- `front/tests/unit/media.test.ts`
- `front/tests/unit/homeContent.test.ts`
- `front/tests/unit/dramaContent.test.ts` (신규)
- `front/scripts/test-experience.cjs`
- `front/README.md`

백엔드가 추가한 `imageUrls`를 홈 응답 타입에 반영한다. 공개 작품 상세 API의 응답 타입과 `GET /dramas/:dramaId` 조회 함수를 추가한다. API 이미지 URL이 개발용 상대 경로이면 `EXPO_PUBLIC_API_BASE_URL` 기준으로 해석하고, 운영용 절대 signed URL이면 그대로 사용한다. 기존 정적 시안 이미지에 쓰는 `resolveImageUrl` 동작은 유지한다. null 이미지에 대한 호출 규칙을 명확히 한다.

홈 세 컬렉션 조회와 상세 조회의 URL·응답 타입을 단위 테스트로 검증하고 새 테스트 파일을 기존 테스트 실행 목록에 등록한다. README에는 개발 백엔드의 이미지 제공, 로컬 미디어 경로, 실기기의 API 호스트 설정을 설명한다. 비밀값 파일은 수정하지 않는다.

완료 조건: 새 응답 필드와 상세 조회 함수가 API 문서에 맞고, 상대·절대 이미지 URL이 모두 올바르게 처리되며 기존 정적 미디어 테스트도 통과한다.

검증 명령:

- `npm --prefix front run typecheck`
- `npm --prefix front run test`
- `npm --prefix front run export`
