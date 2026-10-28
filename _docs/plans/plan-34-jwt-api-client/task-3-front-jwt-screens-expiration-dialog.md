# task-3-front-jwt-screens-expiration-dialog

## 읽어야 할 파일

- AGENTS.md
- front/AGENTS.md
- _docs/ARCHITECTURE.md
- _docs/plans/plan-34-jwt-api-client/plan.md
- 이 계획의 task-1, task-2 문서 및 완료 summary
- front/src/common/http/api.ts, errorMessages.ts
- front/src/features/user/sessionClient.ts, UserProvider.tsx
- 수정 대상 feature·화면·루트·로그인과 기존 테스트
- _docs/api/00-overview/authentication.md 및 변경된 상세·재생·포인트 API 문서
- 프론트 코드 작성 전 https://docs.expo.dev/versions/v57.0.0/ 공식 문서

## 작업

task-1, task-2가 모두 완료된 뒤 확정된 JWT API와 공통 client를 화면에 연결한다. 두 선행 task와 병렬 실행하지 않는다. 공유된 테스트 목록·인증 문서는 선행 변경을 보존한다. 다른 worker의 변경을 되돌리지 않고 승인된 자신의 파일만 수정한다.

### 정확한 수정 파일

```text
front/src/features/home/homeContent.ts
front/src/features/drama/dramaContent.ts
front/src/features/playback/episodePlayback.ts
front/src/features/playback/previewPlayback.ts
front/src/features/economy/episodePurchase.ts
front/src/screens/DramaDetailScreen.tsx
front/src/screens/playbackScreen_episode.tsx
front/src/components/EpisodeUnlockDialog.tsx
front/src/components/SessionExpiredDialog.tsx
front/src/app/_layout.tsx
front/src/app/login.tsx
front/tests/unit/homeContent.test.ts
front/tests/unit/dramaContent.test.ts
front/tests/unit/dramaDetailScreen.test.ts
front/tests/unit/episodePlayback.test.ts
front/tests/unit/previewPlayback.test.ts
front/tests/unit/episodePurchase.test.ts
front/tests/unit/episodeUnlockDialog.test.ts
front/tests/unit/playbackScreenEpisode.test.ts
front/tests/unit/sessionExpiredDialog.test.ts
front/scripts/test-front.cjs
_docs/ARCHITECTURE.md
_docs/api/00-overview/authentication.md
```

### 구현 지시

1. home collection·drama list·preview는 apiRequest public, drama detail·episode playback는 optional, purchase는 required로 이관한다. 사용자 UUID argument/query/path를 제거하고 구매는 POST /me/episodes/:episodeUuid/purchaseSingle를 사용한다. 이미지와 영상 URL에는 Bearer를 붙이지 않는다. 재생 응답의 상대/절대 URL 처리는 기존 동작을 유지한다.
2. 기존 각 feature의 중복 fetch/URL/오류 파싱을 공통 처리로 대체한다. 이번 수정으로 불필요해진 EpisodePurchaseError는 호출부와 테스트를 함께 이관한 뒤 제거한다. 코드 문자열이나 Error.message 정규식으로 HTTP 상태를 판정하지 않는다.
3. 상세/회차 화면은 sessionVersion과 isRestoring을 사용해 복원 완료 뒤 사용자별 요청을 시작하고, 세션 교체 시 이전 조회·권한·팝업 상태를 비운다. 같은 사용자 재로그인도 새 세대로 처리한다. 일반 Access 갱신은 화면 재조회를 불필요하게 반복하지 않는다. cleanup과 isCurrentSession으로 이전 계정의 지연 결과/오류를 무시한다. 회차 player 내부의 getDramaContent 호출도 이 원칙에 맞춰 이관한다.
4. 초기 조회 실패는 해당 화면에 공통 getErrorMessage와 '다시 시도' 버튼을 표시한다. 404는 기존 리소스 없음 화면, 미로그인 유료 회차는 로그인 안내, EPISODE_ACCESS_DENIED는 작품의 회차/구매 안내로 처리한다. 미구매를 네트워크 오류나 세션 만료로 표시하지 않는다. 세션 만료 신호로 이미 루트 팝업을 표시하는 오류에 화면/구매 팝업을 중복으로 띄우지 않는다.
5. 구매 요청에서 사용자 UUID를 넘기지 않는다. 시작 세대를 기록하고 구매 성공 뒤 현재 세대가 아니면 포인트·회차 unlocked·재생 이동을 적용하지 않는다. 로그인 사용자의 포인트 부족·기타 구매 오류는 기존 구매 팝업 안에 getErrorMessage로 표시한다. 익명 사용자는 충전 대신 명시적 로그인 안내를 제공한다. 로그인 버튼 선택 시에만 /login에 진입한다. 기존 dismiss 애니메이션·구매 중 중복 방지·구매 성공 후 이동 순서를 보존한다.
6. SessionExpiredDialog.tsx에 앱 공통 세션 만료 Modal을 만든다. visible, onDismiss, onLogin props만 필요한 정도로 받는다. 문구는 제목 '로그인이 만료됐어요', 본문 '다시 로그인해 주세요.', 버튼 '닫기'와 '로그인'이다. 닫기/플랫폼 back은 dismiss, 로그인은 dismiss 후 명시적 onLogin 동작이다. 범용 팝업 큐·이벤트 버스·모든 오류의 전역 팝업화는 만들지 않는다.
7. _layout.tsx의 UserProvider 내부 루트 UI에 팝업을 한 개만 둔다. Context의 sessionExpired를 visible로 읽고 dismissSessionExpired를 연결한다. Router login 이동은 사용자가 로그인 버튼을 누를 때만 실행한다. navigation tree를 인증 갱신마다 remount하지 않는다. 자동 갱신 성공·조회 실패·구매 실패·네트워크 장애에는 만료 팝업을 띄우지 않는다.
8. /login의 로그인 실패·복원 실패 문구는 공통 오류 안내와 정합성을 맞춘다. 개발용 명시적 URL 진입의 기존 admin 기본값은 유지하되 세션 만료를 이유로 해당 경로에 자동 진입하지 않는다. 새 로그인 폼은 만들지 않는다.
9. _docs/ARCHITECTURE.md의 전역 상태·HTTP/세션 책임·API JWT 적용 상태와 authentication.md의 미구현 설명을 실제 구현으로 갱신한다. 웹 메모리/네이티브 SecureStore 및 Refresh 통신 실패 정책을 정확히 남긴다. 실기기 미검증 여부를 기록한다.

### 주요 로직 코드 또는 변경 예시

task-2의 실제 export에 맞춰 import한다. feature는 인증 처리 자체를 중복 구현하지 않는다.

```tsx
export function SessionExpiredDialog({ visible, onDismiss, onLogin }: {
  visible: boolean;
  onDismiss: () => void;
  onLogin: () => void;
}) {
  return <Modal transparent visible={visible} animationType="fade" onRequestClose={onDismiss}>
    <View style={styles.backdrop}>
      <View style={styles.dialog} accessibilityRole="alert">
        <AppText weight="bold">로그인이 만료됐어요</AppText>
        <AppText>다시 로그인해 주세요.</AppText>
        <Button label="닫기" onPress={onDismiss} />
        <Button label="로그인" onPress={onLogin} />
      </View>
    </View>
  </Modal>;
}
```

styles는 기존 테마의 배경/카드/간격으로 정의한다. 로그인 버튼의 dismiss와 이동 순서는 아래 루트 callback에서 처리한다.

```ts
export function getDramaContent(dramaId: string): Promise<DramaContent> {
  return apiRequest<DramaContent>(`/dramas/${encodeURIComponent(dramaId)}`, { auth: 'optional' });
}

export function purchaseEpisode(episodeUuid: string): Promise<EpisodePurchaseResponse> {
  return apiRequest<EpisodePurchaseResponse>(
    `/me/episodes/${encodeURIComponent(episodeUuid)}/purchaseSingle`,
    { auth: 'required', method: 'POST' },
  );
}

// _layout.tsx: UserProvider 내부의 AppNavigation에 렌더링한다.
const { sessionExpired, dismissSessionExpired } = useUser();
const router = useRouter();
const expirationDialog = <SessionExpiredDialog
  visible={sessionExpired}
  onDismiss={dismissSessionExpired}
  onLogin={() => {
    dismissSessionExpired();
    router.push('/login');
  }}
/>;

// 상세/재생 effect의 핵심: 실제 화면의 상태·타입에 맞춰 적용한다.
useEffect(() => {
  if (isRestoring) return;
  let active = true;
  const version = sessionVersion;
  setDrama(null);
  setLoadState('loading');
  getDramaContent(id).then((content) => {
    if (!active || !isCurrentSession(version)) return;
    setDrama(content);
    setLoadState('loaded');
  }).catch((error: unknown) => {
    if (!active || !isCurrentSession(version) || error instanceof SessionChangedError) return;
    setErrorMessage(getErrorMessage(error));
    setLoadState(error instanceof ApiError && error.status === 404 ? 'not-found' : 'error');
  });
  return () => { active = false; };
}, [id, isRestoring, sessionVersion, retryCount, isCurrentSession]);

// 구매는 서버 응답을 받았어도 세션이 바뀌었으면 UI에 적용하지 않는다.
const purchaseVersion = sessionVersion;
const result = await purchaseEpisode(selectedEpisode.uuid);
if (!mounted.current || !isCurrentSession(purchaseVersion)) return;
setPoints(result.availablePoints);
beginClose({ kind: 'purchase', episode: selectedEpisode });
```

effect의 finally나 구매의 조기 return에서도 현재 화면의 inFlight/purchasing이 영구 고정되지 않도록 기존 cleanup을 유지한다. 세대가 바뀐 뒤 이전 요청의 finally가 새 구매 상태를 덮지 않게 요청 식별을 확인한다. 만료 시 같은 오류를 각 화면이 개별 Modal로 추가 표시하지 않는다.

### 테스트와 완료 조건

- feature 테스트에서 UUID 쿼리/경로 부재, API 경로, auth 모드/Bearer, body 없는 구매 POST, 공개 API의 인증 헤더 부재, 상대/절대 재생 URL을 확인한다.
- 상세/재생 테스트에서 복원 대기, 세션 변경 후 재조회, 이전 결과·오류 무시, 401/403/404/통신 실패별 UI, 조회 재시도를 확인한다.
- 구매 팝업 테스트에서 문자열 errorCode별 메시지, 익명 로그인 안내, 세션 전환 후 지연 구매 응답 무시, 포인트 갱신·닫힘·이동 기존 동작을 검증한다.
- sessionExpiredDialog.test.ts는 실제 component와 루트 연결을 기존 프론트 테스트 방식으로 실행해 한 개의 Modal, 중복 만료 시 1회 표시, 닫기/플랫폼 back, 닫은 뒤 같은 세션 지연 오류에 재표시 없음, 로그인 버튼 전 라우팅 없음과 누른 뒤 /login 이동을 검증한다. signal 중복 방지는 task-2의 실제 session client 테스트와 연결한다. 단순 소스 문자열 포함 검사만으로 완료하지 않는다.
- test-front.cjs에 playbackScreenEpisode.test.ts와 sessionExpiredDialog.test.ts를 추가하고 기존 누락된 episodePlayback.test.ts·previewPlayback.test.ts도 실행 목록에 등록한다. task-2가 등록한 공통 테스트를 유지한다.
- 기존 테스트가 전제하던 UUID 입력과 일반 Error.message 정규식을 새 ApiError/인증 계약에 맞춰 변경한다. 범위 밖 화면·디자인은 수정하지 않는다.

### 검증 명령

```text
npm --prefix front run typecheck
npm --prefix front run test
npm --prefix front run export
```

세 checks가 통과하고 모든 기존 API 호출이 공통 요청으로 연결되어야 한다. UI 서버가 필요한 검증은 실행 중인 localhost:8081을 사용한다. 서버가 없으면 실패와 npm --prefix front run start -- --port 8081 안내를 출력하며 직접 실행하거나 다른 포트로 우회하지 않는다. 네이티브 Modal·SecureStore의 실기기 검증이 없으면 해당 한계를 완료 summary에 남긴다.
