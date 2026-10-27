# task-1-purchase-request

## 읽어야 할 파일

- `AGENTS.md`
- `front/AGENTS.md`
- `_docs/ARCHITECTURE.md`
- `_docs/api/05-economy/points.md`
- `front/src/features/user/login.ts`
- `front/tests/unit/login.test.ts`
- `front/scripts/test-front.cjs`
- Expo 57 문서: https://docs.expo.dev/versions/v57.0.0/

## 작업

변경 파일 소유 범위는 아래 세 파일로 제한한다. 다른 worker의 변경을 되돌리지 말고 현재 코드와 함께 동작하도록 맞춘다.

- `front/src/features/economy/episodePurchase.ts` 신규 작성
- `front/tests/unit/episodePurchase.test.ts` 신규 작성
- `front/scripts/test-front.cjs` 테스트 파일 목록에 위 테스트 추가

기존 구매 API를 호출하는 `purchaseEpisode(userUuid, episodeUuid)`와 응답 타입을 만든다. React/Context/라우팅은 이 HTTP 함수에 넣지 않는다. API URL은 EXPO_PUBLIC_API_BASE_URL을 사용하고 trailing slash를 정리하며 UUID 경로 값을 encodeURIComponent로 인코딩한다. body 없는 POST를 전송한다. 잔액 부족 오류를 팝업에서 구분할 수 있도록 errorCode를 보존하고, 그 외 실패도 reject한다. 비 JSON 오류 응답은 파싱 실패로 덮지 말고 HTTP 상태를 포함한 구매 오류로 전달한다. 요청 도중 네트워크 예외는 호출자에게 전파한다.

### 주요 로직 코드 또는 변경 예시

```ts
export interface EpisodePurchaseResponse {
  episodeUuid: string;
  entitlementUuid: string | null;
  chargedPoints: number;
  availablePoints: number;
}

export class EpisodePurchaseError extends Error {
  constructor(public readonly status: number, public readonly errorCode?: string) {
    super(`Failed to purchase episode: ${status}`);
  }
}

export async function purchaseEpisode(
  userUuid: string,
  episodeUuid: string,
): Promise<EpisodePurchaseResponse> {
  const baseUrl = process.env.EXPO_PUBLIC_API_BASE_URL;
  if (!baseUrl) throw new Error('EXPO_PUBLIC_API_BASE_URL must be set to purchase an episode.');
  const response = await fetch(
    `${baseUrl.replace(/\/+$/, '')}/users/${encodeURIComponent(userUuid)}/episodes/${encodeURIComponent(episodeUuid)}/purchaseSingle`,
    { method: 'POST' },
  );
  if (!response.ok) {
    const body: unknown = await response.json().catch(() => null);
    const errorCode = body !== null && typeof body === 'object'
      && 'errorCode' in body && typeof body.errorCode === 'string'
      ? body.errorCode : undefined;
    throw new EpisodePurchaseError(response.status, errorCode);
  }
  return await response.json() as EpisodePurchaseResponse;
}
```

기존 login.test.ts의 Node test runner와 fetch 복원 방식을 따른다. 정확한 URL/인코딩/POST/body 없음, 성공 응답의 availablePoints 0과 chargedPoints 0 및 entitlementUuid null 보존, API base URL 누락 시 무요청 실패, 409 POINT_INSUFFICIENT_BALANCE, 404, 비 JSON HTTP 실패, 네트워크 예외 전파를 검증한다. 백엔드나 개발 DB를 수정하지 않는다.

검증 명령:

```text
npm --prefix front run typecheck
npm --prefix front run test
npm --prefix front run export
```

완료 조건: 신규 테스트가 기본 test 명령에서 실행되고 세 checks가 통과하며, 후속 task가 구매 응답과 업무 오류 코드를 사용할 수 있다. 일시적인 코드나 미사용 훅을 추가하지 않는다.
