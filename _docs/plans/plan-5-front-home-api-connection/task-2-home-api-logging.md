# task-2-home-api-logging

## 읽어야 할 파일

- `AGENTS.md`
- `front/AGENTS.md`
- `_docs/ARCHITECTURE.md`
- `_docs/api/03-programming/collections.md`
- `front/src/services/homeContent.ts`
- `front/src/screens/HomeScreen.tsx`
- Expo SDK 57 공식 문서

## 작업

홈 화면이 마운트될 때 `HOME_FEATURED`와 `EDITORIAL_TOP_3` 컬렉션을 병렬로 요청한다. 각 성공 응답은 컬렉션 코드를 식별할 수 있게 개발 콘솔에 출력한다. 네트워크 또는 HTTP 오류도 콘솔로 확인할 수 있게 처리하되, 화면 UI와 기존 로컬 `dramas` 데이터는 변경하지 않는다.

변경 파일은 `front/src/screens/HomeScreen.tsx`로 한정한다.

선행 조건: `task-1`이 완료되어 `front/src/services/homeContent.ts`의 API 호출 함수를 사용할 수 있어야 한다.

검증 명령:

```text
npm --prefix front run typecheck
npm --prefix front run test
npm --prefix front run export
```

완료 조건: 홈 화면이 두 `/collections/:code` 요청을 수행하고, 기존 UI를 바꾸지 않은 채 응답 또는 오류를 콘솔에서 확인할 수 있으며 모든 검증 명령이 통과한다.
