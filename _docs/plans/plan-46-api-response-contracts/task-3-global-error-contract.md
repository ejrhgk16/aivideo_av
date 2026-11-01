# task-3-global-error-contract

## 읽어야 할 파일

- `AGENTS.md`
- `_docs/ARCHITECTURE.md`
- `back/test/api/README.md`
- `_docs/api/00-overview/response-compatibility.md`
- `back/src/common/error/error.baseException.ts`
- `back/src/common/error/error.customExceptions.ts`
- `back/src/common/error/error.filter.ts`
- `back/src/common/error/error.enum.ts`
- `back/src/common/error/error.vo.ts`
- `back/src/common/http/webCors.ts`
- `back/src/identity/refreshCookie.ts`
- `back/src/app.module.ts`
- `back/test/unit/loginController.spec.ts`
- `back/test/unit/economy/pointController.spec.ts`

## 작업

task-2의 성공 응답과 task-1의 strict assertion을 유지하면서 일반 오류의 형식만 공통화한다. 새 success Interceptor나 data wrapper는 만들지 않는다.

1. 기존 AllExceptionFilter를 `@Catch()`의 전역 필터로 확장하고 AppModule에 `APP_FILTER` provider로 한 번 등록한다. content/programming/identity/economy/saved-video/watch-progress 컨트롤러의 UseFilters 선언·import만 제거한다. guard·HTTP 상태·캐시/쿠키 설정·메서드 본문은 유지한다.
2. error.vo.ts의 IBaseException은 같은 필드의 type으로 바꾸고 `ErrorResponse = IBaseException & {timestamp:string;path:string}`을 정의한다. error.enum.ts에 아래 공통 코드를 정의하고 필터의 실제 매핑과 일치시킨다. 기존 업무 enum 값은 변경하지 않는다.
3. BaseException은 기존 errorCode/errorName/statusCode를 그대로 사용한다. timestamp는 ISO UTC, path는 지금의 `request.originalUrl || request.url`을 그대로 사용한다. query가 있었던 경로에서 임의로 query를 제거하지 않는다.
4. 일반 HttpException은 getStatus()를 사용한다. BAD_REQUEST(400), UNAUTHORIZED(401), FORBIDDEN(403), NOT_FOUND(404), CONFLICT(409), PAYLOAD_TOO_LARGE(413), UNSUPPORTED_MEDIA_TYPE(415) 등은 errorCode `HTTP_<HttpStatus enum 이름>`, errorName은 그 enum 이름으로 보낸다. HttpStatus에 없는 HTTP 오류 상태에는 `HTTP_STATUS_<숫자>` / `STATUS_<숫자>`를 사용한다. 500은 INTERNAL_SERVER_ERROR / InternalServerError로 고정한다. 503 등 다른 명시적 HttpException의 HTTP 상태는 500으로 바꾸지 않는다.
5. Express/Nest의 body parser 오류처럼 HttpException 인스턴스가 아니지만 유효한 statusCode와 message가 있는 HTTP 오류는 기존 400/413 등을 보존한다. 알 수 없는 일반 Error는 500으로 정규화하며 원래 message/stack/SQL을 응답에 넣지 않는다. 에러 응답은 정확히 다섯 필드이며 message/details/success/data 등을 추가하지 않는다.
6. 전역 필터로 바꾸어도 예상하지 못한 5xx의 서버 오류 기록이 없어지지 않게 한다. 요청 body·Authorization·쿠키 원문을 로그에 추가하지 않는다. 새 로깅 프레임워크·requestId 체계는 만들지 않는다.
7. API 문서의 기본 Nest 오류 예시와 "일부 controller만 적용" 설명을 전역 다섯 필드 계약으로 고친다. 각 endpoint의 경로·요청·성공 예시·인증·노출 정책은 그대로 유지한다. 네이티브·웹 403과 malformed JSON/미등록 경로도 공통 형식임을 적는다. Architecture의 common/error 책임을 전역 처리로 갱신한다.
8. 기존 8개 컬렉션의 성공 strict assertion·기존 업무 오류 검사는 변경하지 않는다. 일반 오류의 기존 message/error 기대값만 새 다섯 필드/상태/코드/이름으로 전환한다. http suite에 존재하지 않는 경로 404 및 실제 잘못된 JSON POST /auth/login 400을 추가해 router/body-parser 경계를 검증한다. identity의 금지 Origin/전송 모드 403에도 코드/다섯 키/쿠키 및 no-store 규칙을 검사한다. 각 실제 HTTP 메서드를 유지한다.
9. 기존 단위 테스트가 특정 controller의 __exceptionFilters__ metadata를 요구하면 전역 등록으로 변경된 계약에 맞춰 그 assertion만 수정한다. 실제 HTTP 처리는 Postman으로 검증한다. 새 errorFilter.spec.ts는 기존 DB/환경을 훼손하지 않고 HTTP로 재현할 수 없는 Error/명시적 500·503/비정형 parser 오류 객체/기존 BaseException 보존 경계를 최소한으로 검사한다. 테스트용 제품 endpoint나 서버를 만들지 않는다.
10. response-compatibility.md에 old 일반 오류 → new 공통 오류의 허용된 차이 목록을 정확히 적고 task-1의 성공·업무 오류 기준 및 task-2의 타입 정리 통과 사실을 지우지 않는다.

### 주요 로직 코드 또는 변경 예시

다음은 기존 필터를 확장할 핵심 흐름이다. 필요한 Nest/Express 타입과 HttpStatus/BaseException을 import하고 새 ErrorResponse를 반환 계약에 사용한다. 이름은 기존 AllExceptionFilter를 유지한다.

~~~ts
function httpErrorStatus(exception: unknown): number {
  if (exception instanceof HttpException) return exception.getStatus();
  if (
    exception !== null && typeof exception === 'object' &&
    'statusCode' in exception && typeof exception.statusCode === 'number' &&
    Number.isInteger(exception.statusCode) &&
    exception.statusCode >= 400 && exception.statusCode <= 599 &&
    'message' in exception && typeof exception.message === 'string'
  ) {
    return exception.statusCode;
  }
  return HttpStatus.INTERNAL_SERVER_ERROR;
}

@Catch()
export class AllExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(AllExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const context = host.switchToHttp();
    const request = context.getRequest<Request>();
    const response = context.getResponse<Response>();
    const status = httpErrorStatus(exception);
    const statusName = HttpStatus[status] ?? 'STATUS_' + status;
    const body: ErrorResponse = {
      errorCode: exception instanceof BaseException
        ? exception.errorCode
        : status === 500 ? ErrorCodeEnum.InternalServerError : 'HTTP_' + statusName,
      errorName: exception instanceof BaseException
        ? exception.errorName
        : status === 500 ? 'InternalServerError' : statusName,
      statusCode: status,
      timestamp: new Date().toISOString(),
      path: request.originalUrl || request.url,
    };
    if (status >= 500) {
      this.logger.error(exception instanceof Error ? exception.stack : 'Unhandled HTTP server error');
    }
    response.status(status).json(body);
  }
}
~~~

Enum 멤버 `InternalServerError`의 값은 정확히 `INTERNAL_SERVER_ERROR`다. 코드에는 외부 본문 원문을 그대로 복사하는 `...exception.getResponse()`를 넣지 않는다. AppModule의 기존 providers에 `{ provide: APP_FILTER, useClass: AllExceptionFilter }`를 추가한다.

Postman에서는 성공 assertion과 별개로 새 오류 계약을 정확히 검사한다.

~~~js
pm.test('Missing route uses the global error contract', () => {
  pm.response.to.have.status(404);
  const body = pm.response.json();
  pm.expect(Object.keys(body).sort()).to.eql([
    'errorCode', 'errorName', 'path', 'statusCode', 'timestamp'
  ]);
  pm.expect(body.errorCode).to.equal('HTTP_NOT_FOUND');
  pm.expect(body.errorName).to.equal('NOT_FOUND');
  pm.expect(body.statusCode).to.equal(404);
  pm.expect(body.path).to.equal('/__api_contract_missing__');
  pm.expect(new Date(body.timestamp).toISOString()).to.equal(body.timestamp);
});
~~~

### 완료 조건

- 컨트롤러의 로컬 필터 등록 없이 전역 필터가 BaseException, 일반 HttpException, router/body-parser 오류, 예상하지 못한 오류를 같은 다섯 필드로 반환한다.
- 기존 업무 코드·이름·HTTP 상태·경로와 모든 성공 응답 strict assertion이 그대로 통과한다.
- 일반 오류의 의도된 형식 변경만 문서·컬렉션에 반영된다. 401/403/404 status나 cookie/no-store/CORS 계약을 바꾸지 않는다.
- task-1 baseline에서 고정한 성공 키/타입/값·정렬·204 빈 본문 검사를 완화한 줄이 없다.
- 선언한 내부 경계 테스트 및 8개 API suite가 실제 기존 API에서 통과한다. 연결/필수 데이터/cleanup 실패를 통과 처리하지 않는다.
- task-4와 병렬 실행할 수 있지만 코드/이름 규칙을 임의 변경하지 않는다. front 파일은 수정하지 않는다.

### 수정 허용 파일

- `back/src/app.module.ts`
- `back/src/common/error/error.filter.ts`
- `back/src/common/error/error.enum.ts`
- `back/src/common/error/error.vo.ts`
- `back/src/content/publicCatalogController.ts`
- `back/src/programming/publicCollectionController.ts`
- `back/src/identity/loginController.ts`
- `back/src/economy/pointController.ts`
- `back/src/playback/savedVideoController.ts`
- `back/src/playback/watchProgressController.ts`
- `back/test/unit/common/errorFilter.spec.ts`
- `back/test/unit/loginController.spec.ts`
- `back/test/unit/economy/pointController.spec.ts`
- `back/test/api/http.postman_collection.json`
- `back/test/api/identity.postman_collection.json`
- `back/test/api/content.postman_collection.json`
- `back/test/api/programming.postman_collection.json`
- `back/test/api/playback.postman_collection.json`
- `back/test/api/economy.postman_collection.json`
- `back/test/api/watch-progress.postman_collection.json`
- `back/test/api/saved-videos.postman_collection.json`
- `_docs/ARCHITECTURE.md`
- `_docs/api/00-overview/conventions.md`
- `_docs/api/00-overview/authentication.md`
- `_docs/api/00-overview/response-compatibility.md`
- `_docs/api/01-identity/login.md`
- `_docs/api/01-identity/refresh.md`
- `_docs/api/01-identity/logout.md`
- `_docs/api/02-content/genres.md`
- `_docs/api/02-content/dramas.md`
- `_docs/api/03-programming/collections.md`
- `_docs/api/04-playback/episodes.md`
- `_docs/api/04-playback/watch-progress.md`
- `_docs/api/04-playback/saved-videos.md`
- `_docs/api/05-economy/points.md`

### 의존성과 검증 명령

선행 task: task-2.

~~~text
npm --prefix back run test:unit -- test/unit/common/errorFilter.spec.ts test/unit/loginController.spec.ts test/unit/economy/pointController.spec.ts test/unit/refreshCookie.spec.ts
npm --prefix back run test:api -- --suite http --suite identity --suite content --suite programming --suite playback --suite economy --suite watch-progress --suite saved-videos
~~~
