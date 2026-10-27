# task-3-point-errors

## 목표와 범위

사용자가 추가한 `back/src/common/error/` 예시를 현재 프로젝트에서 사용할 수 있도록 정리하고, 포인트 지급·단건 구매의 업무 오류를 이 폴더의 커스텀 예외로 처리한다. 이 문서는 추가 태스크 정의이며 제품 구현은 `$harness` 호출 후 진행한다.

미사용 코드 삭제 범위는 예시 폴더에서 실제 사용되지 않는 JWT·access/refresh token·role·IP 관련 enum, 예외, import, 주석 및 로깅 분기다. 실행 전 전체 참조를 다시 검색하고 사용 중인 항목은 삭제하지 않는다. 프로젝트 전체의 무관한 코드 삭제로 확대하지 않는다.

## 읽어야 할 파일

- `AGENTS.md`, `_docs/ARCHITECTURE.md`, `back/test/api/README.md`
- 이 플랜의 `plan.md`, `index.json`
- `back/src/common/error/`의 다섯 파일 전부
- `back/src/economy/pointController.ts`, `back/src/economy/pointService.ts`
- 기존 포인트 단위 테스트와 Postman 컬렉션
- `_docs/api/00-overview/conventions.md`, `_docs/api/05-economy/points.md`
- 적용되는 하위 AGENTS.md

## 소유 파일

정확한 파일 목록은 plan-local `index.json`의 task-3.files와 동일하다. 다른 작업자의 변경을 되돌리지 않는다. apply_patch로만 수정하며 Git 상태나 plan 상태 파일을 직접 변경하지 않는다.

## 구현

1. 예시의 BaseException, ErrorCodeEnum, 커스텀 예외, 응답 인터페이스와 필터 구조를 유지하되 현재 TypeScript/ESM 설정에 맞게 타입과 `.js` import를 수정한다. `date-fns` 의존성을 추가하지 말고 timestamp는 `new Date().toISOString()`으로 만든다. 응답 전용 timestamp/path는 필터에서 구성해 예외 인스턴스를 변경하지 않는다. 한 번 사용하는 계층이나 불필요한 설정은 추가하지 않는다.
2. 사용되지 않는 인증·권한·IP 예외와 관련 enum 및 필터의 예외별 로그 분기를 제거한다. 현재 사용하지 않는 범용 UnCatchedException도 제거한다. 실제 DB/프로그래밍 오류를 업무 오류로 변환하지 않는다.
3. 다음 코드·이름·HTTP 상태를 enum과 구체적인 커스텀 예외 클래스로 정의한다. errorName은 아래 클래스 이름의 Exception 접미사를 제외한 이름을 사용한다.

| 클래스 | errorCode | HTTP |
| --- | --- | --- |
| PointUserNotFoundException | POINT_USER_NOT_FOUND | 404 |
| PointWalletNotFoundException | POINT_WALLET_NOT_FOUND | 404 |
| PointEpisodeNotFoundException | POINT_EPISODE_NOT_FOUND | 404 |
| InvalidPointIncreaseException | POINT_INVALID_INCREASE | 400 |
| PointBalanceOverflowException | POINT_BALANCE_OVERFLOW | 400 |
| PointIdempotencyConflictException | POINT_IDEMPOTENCY_CONFLICT | 409 |
| InsufficientPointsException | POINT_INSUFFICIENT_BALANCE | 409 |

4. controller의 잘못된 지급 body, service의 사용자·지갑·공개 회차 없음, 잔액 범위 초과, 키 충돌, 잔액 부족을 위 예외로 교체한다. 기존 HTTP 상태와 트랜잭션·잠금·재구매 동작을 유지한다. UUID 형식 검사는 다시 추가하지 않는다. 개발 환경 외 접근의 기본 NotFoundException은 유지한다.
5. 필터는 `@Catch(BaseException)`으로 해당 예외만 처리하고 `@UseFilters(AllExceptionFilter)`로 PointController에만 연결한다. 전역 필터로 등록하지 않는다. 응답은 `{ errorCode, errorName, statusCode, timestamp, path }`이며 내부 SQL/stack/숫자 ID는 노출하지 않는다. 기존 다른 API와 기본 NestJS 예외는 기존 응답을 유지한다.

```ts
throw new InsufficientPointsException();
// HTTP 409
// { errorCode: 'POINT_INSUFFICIENT_BALANCE', errorName: 'InsufficientPoints',
//   statusCode: 409, timestamp: '<ISO UTC>', path: '<request URL>' }
```

## 검증과 문서

- 기존 단위 테스트의 예외 기대값을 구체적인 커스텀 클래스로 변경한다. DB 오류 전파와 트랜잭션 rollback 검증은 유지한다.
- Postman에 실제 POST로 지급 및 단건 구매 오류 응답을 검증한다. 404 사용자·회차, 400 지급 body, 409 잔액 부족·키 충돌의 errorCode/errorName/statusCode/timestamp/path를 확인한다. 비공개 회차는 존재 여부를 노출하지 않고 같은 회차 없음 코드로 처리한다.
- 필요한 개발용 테스트 데이터 생성·시드·변경은 허용된다. 기존 admin 잔액을 테스트 편의로 초기화하지 말고 테스트용 사용자·지갑·회차를 사용한다. 준비 방법과 필요 데이터를 README에 기록한다. API가 없는 준비 데이터는 기존 환경 설정을 사용하는 명시적 DB 준비로 처리하고 비밀 값을 출력하지 않는다.
- HTTP 테스트의 공통 NestJS 오류 형식 assertion이 포인트 커스텀 오류와 충돌하지 않도록 범위를 맞춘다. 다른 API의 기존 오류 형식도 계속 검증한다.
- 포인트 정의서에 코드표와 응답 예시를 반영하고 공통 규칙에 포인트 커스텀 오류의 적용 범위와 기본 오류 응답의 공존을 명시한다. 아키텍처에 common/error의 책임을 추가한다.
- 현재 실행 중인 `http://localhost:3000`에서 최신 코드 반영을 확인하고 테스트한다. 서버가 없으면 오류와 `npm --prefix back run start:dev` 안내를 출력하고 실패로 보고한다. 서버를 자동 실행하거나 별도 포트로 우회하지 않는다.
- checks: `npm --prefix back run lint`, `npm --prefix back run test`, `npm --prefix back run build`.

완료 조건: 미사용 예시 코드가 제거되고, 실제 HTTP 포인트 오류가 지정한 커스텀 응답을 반환하며, 다른 API의 오류 계약과 구매의 원자성·중복 방지 동작이 유지되고, 모든 checks가 통과한다.
