# task-4-frontend-contracts-and-errors

## 읽어야 할 파일

- `AGENTS.md`
- `_docs/ARCHITECTURE.md`
- `front/AGENTS.md`
- `front/src/common/http/api.ts`
- `front/src/common/http/errorMessages.ts`
- `front/src/features/user/session.ts`
- `front/src/features/user/sessionClient.ts`
- `front/src/features/user/login.ts`
- `front/src/features/drama/dramaContent.ts`
- `front/src/features/home/homeContent.ts`
- `front/src/features/economy/episodePurchase.ts`
- `front/src/features/playback/episodePlayback.ts`
- `front/src/features/playback/previewPlayback.ts`
- `front/src/features/playback/savedVideos.ts`
- `front/src/features/playback/watchProgress.ts`
- `_docs/api/00-overview/response-compatibility.md`
- `back/src/content/contentResponses.ts`
- `back/src/programming/programmingResponses.ts`
- `back/src/identity/identityResponses.ts`
- `back/src/economy/pointResponses.ts`
- `back/src/playback/savedVideoResponses.ts`

## 작업

프론트의 API 응답 타입을 type으로 정리하고 공통 오류 파싱/안내를 통일한다. 성공 응답과 feature 함수의 외부 동작은 그대로 유지한다. 작업 전에 front/AGENTS.md에 따라 https://docs.expo.dev/versions/v57.0.0/ 정확한 버전 문서를 읽는다. Expo/React Native UI 구현은 변경하지 않는다.

1. 응답 선언만 기능별 파일로 옮긴다.
   - userResponses.ts: 현재 LoginResponse 필드·nullable·refreshToken optional 계약을 type으로 옮긴다. native에서 refreshToken 필수 검사, web에서 필드 없음은 기존 store/HTTP 검증으로 유지한다. 실제 LoginInput과 RefreshTransport 정의는 현재 파일에 둘 수 있으며 요청 타입 전체를 변환하지 않는다.
   - dramaResponses.ts: 현재 DramaContent/DramaSummary를 type으로 옮기고 공통 하위 구조를 필요한 범위에서만 공유한다.
   - homeResponses.ts: HomeCollection/HomeCollectionDrama를 type으로 옮긴다. productionCompany 객체와 publishedEpisodeCount를 catalog 응답과 임의 통합하지 않는다.
   - economyResponses.ts: EpisodePurchaseResponse를 type으로 옮긴다.
   - playbackResponses.ts: EpisodePlayback/PreviewPlayback/SavedContentType/SavedVideoItem/SavedVideoPage를 type으로 옮긴다. 저장 item의 판별 유니언과 null 규칙은 유지한다.
   - 기존 feature 모듈에서 사용하던 타입 export 이름을 type 재수출로 보존한다. 화면·상태 모듈의 import를 바꾸기 위해 files 범위를 넓히지 않는다. backend 소스를 import하거나 front/back 공유 패키지를 만들지 않는다.
2. 기존 apiRequest/publicApiRequest의 성공 JSON 원본 반환과 204→undefined 처리를 유지한다. data 추출·envelope 감지·새 JSON 변환을 추가하지 않는다. episodePlayback의 기존 URL 정규화와 모든 요청 경로/메서드/auth/credentials 옵션도 유지한다.
3. api.ts에 다섯 필드의 ApiErrorResponse type을 선언한다. 실제 오류 파서는 unknown 응답을 읽고 errorCode 문자열만 추출하며 status는 실제 Response.status를 사용한다. 본문이 없거나 JSON이 아니어도 ApiError(status,null)를 만들고 새 프로토콜 오류로 가리지 않는다.
4. api.ts와 session.ts의 중복 오류 본문 파싱을 같은 `readApiError(response): Promise<ApiError>` 함수로 통일한다. 함수는 status/errorCode만 갖는 기존 ApiError 객체를 반환한다. body timestamp/path/errorName 전체를 ApiError에 보관하는 새 기능은 넣지 않는다.
5. errorMessages.ts는 `알려진 업무 코드 → HTTP status별 안내 → 일반 안내` 순서로 처리한다. INTERNAL_SERVER_ERROR/HTTP_SERVICE_UNAVAILABLE 같은 코드가 있어도 5xx는 서버 문제 안내에 도달한다. unknown code도 HTTP 상태를 활용한다. 400/401/403/404/409 안내를 명시하고 401 HTTP_UNAUTHORIZED를 AUTH_INVALID_TOKEN의 세션 만료 문구와 구분한다. 현재 코드별 한국어 안내와 네트워크 fallback은 유지한다.
6. AUTH_INVALID_TOKEN의 정확한 코드와 401 조건, 한 번 Refresh·재시도·세션 만료·저장 토큰 정리·계정 전환/동시 요청 의미는 바꾸지 않는다. HTTP_UNAUTHORIZED, AUTH_LOGIN_FAILED, EPISODE_ACCESS_DENIED, 새 공통 403/5xx/비JSON 오류에는 자동 Refresh가 발생하지 않음을 검사한다. Refresh 오류에서 HTTP status 보존 및 네이티브 저장 삭제 조건도 유지한다.
7. 테스트는 다음을 엄격히 추가·보완한다.
   - api.test: 원본 객체/배열/nullable/기존 data라는 업무 필드를 그대로 반환함을 deepEqual로 확인, 204에서 json()을 호출하지 않음, 새 공통 오류/unknown code/잘못된 본문/JSON 없음/HTTP status와 본문 statusCode 불일치에서 HTTP status 우선.
   - session.test: Refresh가 같은 오류 파서를 쓰며 원래 status/code를 보존, 새 공통 403/5xx의 저장/세션 동작, 기존 Refresh 회전·동시 요청·계정 전환·쿠키/네이티브 경계 보존.
   - errorMessages.test: 알려진 코드/새 공통 코드/unknown code/코드 없음/네트워크를 조합해 정확한 문자열 기대값으로 검사한다. 기존 한국어 여부 정규식만으로 새 동작을 통과시키지 않는다. 특히 ApiError(500,'INTERNAL_SERVER_ERROR') 및 ApiError(503,'HTTP_SERVICE_UNAVAILABLE')가 서버 안내이고 ApiError(401,'HTTP_UNAUTHORIZED')가 만료 안내가 아님을 검사한다.
   - login/homeContent/dramaContent/episodePlayback/previewPlayback/episodePurchase/savedVideos 테스트: 각 feature 함수가 현재 기대 객체·배열·값을 deepEqual로 그대로 반환하고 기존 인증·경로·HTTP 메서드·URL 정규화가 보존됨을 검사한다. 성공 mock에 data wrapper를 넣지 않는다.
   - 기존 watchProgress/episodeUnlockDialog/dramaDetailScreen/playbackScreenEpisode/sessionExpiredDialog 테스트를 수정 없이 실행해 5xx 재시도, 구매 오류, 404 표시, 인증 만료 안내 소비를 확인한다.
8. task-3과 병렬 실행할 수 있다. 공통 오류 매핑은 plan.md에 확정된 계약을 사용하고 task-3이 편집 중인 API 문서를 추측해서 다시 정의하지 않는다. back/와 문서 파일을 수정하지 않는다.

### 주요 로직 코드 또는 변경 예시

api.ts에서 기존 ApiError를 재사용해 공통 파서를 export하고 제품 요청과 Refresh가 모두 호출한다.

~~~ts
export type ApiErrorResponse = {
  errorCode: string;
  errorName: string;
  statusCode: number;
  timestamp: string;
  path: string;
};

export async function readApiError(response: Response): Promise<ApiError> {
  let body: unknown;
  try {
    body = await response.json();
  } catch {
    body = null;
  }
  const errorCode =
    body !== null && typeof body === 'object' &&
    'errorCode' in body && typeof body.errorCode === 'string'
      ? body.errorCode
      : null;
  return new ApiError(response.status, errorCode);
}
~~~

두 기존 요청 함수의 오류 분기를 각각 `if (!response.ok) throw await readApiError(response);`로 바꾼다. 성공 분기는 그대로다. errorMessages.ts의 기존 messages 객체는 보존하고 다음 순서로 사용한다.

~~~ts
export function getErrorMessage(error: unknown): string {
  if (!(error instanceof ApiError)) {
    return '네트워크 연결을 확인하고 다시 시도해 주세요.';
  }
  const known = error.errorCode === null ? undefined : messages[error.errorCode];
  if (known !== undefined) return known;
  if (error.status >= 500) {
    return '서버에 문제가 발생했습니다. 잠시 후 다시 시도해 주세요.';
  }
  switch (error.status) {
    case 400: return '요청 정보를 확인해 주세요.';
    case 401: return '로그인이 필요합니다.';
    case 403: return '이 요청을 수행할 권한이 없습니다.';
    case 404: return '요청한 정보를 찾을 수 없습니다.';
    case 409: return '요청 상태가 변경됐습니다. 다시 확인해 주세요.';
    default: return '요청을 처리하지 못했습니다. 다시 시도해 주세요.';
  }
}
~~~

기존 export 유지 예시는 다음과 같다. 다른 기능도 type-only 재수출로 같은 원칙을 적용한다.

~~~ts
import type { DramaContent, DramaSummary } from './dramaResponses';
export type { DramaContent, DramaSummary } from './dramaResponses';

export function getDramaContent(dramaId: string): Promise<DramaContent> {
  return apiRequest<DramaContent>('/dramas/' + encodeURIComponent(dramaId), { auth: 'optional' });
}
~~~

실제 코드의 경로 표현·줄바꿈 등 기존 스타일은 유지한다. 위 예시를 이유로 의미 없는 포맷 변경을 하지 않는다.

### 완료 조건

- API 응답 interface와 서비스 파일에 섞인 응답 선언이 기능별 type 파일로 정리되며 기존 feature export와 UI import가 유지된다.
- 현재 성공 JSON을 그대로 소비한다. 성공 응답 포장/추출이나 불필요한 화면 변경이 없다.
- 제품 요청/Refresh가 동일 파서를 사용하고 malformed/비JSON에서도 HTTP 상태와 기존 오류 의미를 보존한다.
- 새 공통 코드가 있어도 서버 오류 안내와 상태별 fallback이 작동하고 정확한 인증 코드에서만 Refresh한다.
- typecheck와 선언된 15개 선택 테스트가 모두 통과한다. 전체 프론트 export/test는 이후 명시적 finish-plan 단계에서 실행한다.

### 수정 허용 파일

- `front/src/common/http/api.ts`
- `front/src/common/http/errorMessages.ts`
- `front/src/features/user/login.ts`
- `front/src/features/user/userResponses.ts`
- `front/src/features/user/session.ts`
- `front/src/features/drama/dramaContent.ts`
- `front/src/features/drama/dramaResponses.ts`
- `front/src/features/home/homeContent.ts`
- `front/src/features/home/homeResponses.ts`
- `front/src/features/economy/episodePurchase.ts`
- `front/src/features/economy/economyResponses.ts`
- `front/src/features/playback/episodePlayback.ts`
- `front/src/features/playback/previewPlayback.ts`
- `front/src/features/playback/savedVideos.ts`
- `front/src/features/playback/playbackResponses.ts`
- `front/tests/unit/api.test.ts`
- `front/tests/unit/errorMessages.test.ts`
- `front/tests/unit/session.test.ts`
- `front/tests/unit/login.test.ts`
- `front/tests/unit/homeContent.test.ts`
- `front/tests/unit/dramaContent.test.ts`
- `front/tests/unit/episodePlayback.test.ts`
- `front/tests/unit/previewPlayback.test.ts`
- `front/tests/unit/episodePurchase.test.ts`
- `front/tests/unit/savedVideos.test.ts`

### 의존성과 검증 명령

선행 task: task-2.

~~~text
npm --prefix front run typecheck
npm --prefix front run test -- tests/unit/api.test.ts tests/unit/errorMessages.test.ts tests/unit/session.test.ts tests/unit/login.test.ts tests/unit/homeContent.test.ts tests/unit/dramaContent.test.ts tests/unit/episodePlayback.test.ts tests/unit/previewPlayback.test.ts tests/unit/episodePurchase.test.ts tests/unit/savedVideos.test.ts tests/unit/watchProgress.test.ts tests/unit/episodeUnlockDialog.test.ts tests/unit/dramaDetailScreen.test.ts tests/unit/playbackScreenEpisode.test.ts tests/unit/sessionExpiredDialog.test.ts
~~~
