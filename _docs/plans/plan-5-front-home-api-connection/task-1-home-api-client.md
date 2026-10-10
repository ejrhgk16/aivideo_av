# task-1-home-api-client

## 읽어야 할 파일

- `AGENTS.md`
- `front/AGENTS.md`
- `_docs/ARCHITECTURE.md`
- `_docs/api/03-programming/collections.md`
- `front/src/services/media.ts`
- `front/tests/unit/media.test.ts`
- `front/scripts/test-experience.cjs`
- Expo SDK 57 공식 문서

## 작업

`front/.env`에 `EXPO_PUBLIC_API_BASE_URL=http://localhost:3000`을 설정한다. 이 값은 웹 개발 환경의 백엔드 기본 포트 기준이며, Android 에뮬레이터 또는 실기기에서는 실행 환경에 맞는 서버 주소로 사용자가 변경한다.

`front/src/services/homeContent.ts`에 `GET /collections/:code`의 응답 타입과 호출 함수를 추가한다. 함수는 `EXPO_PUBLIC_API_BASE_URL`을 사용하고, 후행 슬래시와 선행 슬래시가 겹치지 않는 요청 URL을 생성한다. `HOME_FEATURED`, `EDITORIAL_TOP_3`은 화면에서 호출할 코드이므로 서비스가 임의의 다른 endpoint나 상태를 만들지 않는다.

`front/tests/unit/homeContent.test.ts`에서 API URL 조합과 성공 응답 반환을 검증한다. 테스트가 실행되도록 `front/scripts/test-experience.cjs`의 테스트 파일 목록에 이 파일만 추가한다.

변경 파일은 다음으로 한정한다.

- `front/.env`
- `front/src/services/homeContent.ts`
- `front/tests/unit/homeContent.test.ts`
- `front/scripts/test-experience.cjs`

검증 명령:

```text
npm --prefix front run typecheck
npm --prefix front run test
```

완료 조건: 환경 변수를 사용한 `/collections/:code` 요청의 URL과 JSON 응답이 단위 테스트로 확인되고 두 검증 명령이 통과한다.
