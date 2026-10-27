# task-2-purchase-dialog-playback

## 읽어야 할 파일

- `AGENTS.md`
- `front/AGENTS.md`
- `_docs/ARCHITECTURE.md`
- `_docs/api/05-economy/points.md`
- `_docs/api/04-playback/episodes.md`
- `front/src/features/economy/episodePurchase.ts`
- `front/src/features/user/UserProvider.tsx`
- `front/src/features/playback/episodePlayback.ts`
- `front/src/components/ui.tsx`
- `front/src/components/EpisodeUnlockDialog.tsx`
- `front/src/screens/DramaDetailScreen.tsx`
- `front/src/screens/RecommendationScreen.tsx`
- `front/src/screens/playbackScreen_preview.tsx`
- `front/src/screens/playbackScreen_episode.tsx`
- Expo 57 문서: https://docs.expo.dev/versions/v57.0.0/

## 작업

task-1 완료 후 실행한다. 변경 파일 소유 범위는 아래 다섯 파일로 제한한다. 다른 worker의 변경을 되돌리지 말고 현재 코드에 맞춘다.

- `front/src/components/EpisodeUnlockDialog.tsx`
- `front/src/screens/DramaDetailScreen.tsx`
- `front/src/screens/RecommendationScreen.tsx`
- `front/src/screens/playbackScreen_preview.tsx`
- `front/src/screens/playbackScreen_episode.tsx`

공통 팝업에 필수 `onPurchased: (episode: Episode) => void` prop을 추가한다. 로그인 사용자와 실제 episode, nullable points를 기준으로 `pricePoints <= points`이면 구매하기, 그 외는 포인트 충전하기를 표시한다. 마지막 displayedEpisode를 보존하는 닫힘 애니메이션 수정은 유지한다. 실제 구매 대상은 null이 아닌 현재 episode이며 숨겨진 마지막 회차로 요청하지 않는다. 구매 기능 준비 중 문구는 제거하고 현재 버튼 동작에 맞는 설명으로 바꾼다.

구매 API 호출·성공 시 Context의 setPoints·팝업 닫기는 공통 컴포넌트에서 실행한다. 동기 ref로 중복 요청을 막고 state로 구매 중 버튼 상태를 표시한다. 구매 중 두 닫기 버튼과 onRequestClose를 모두 막는다. 실패 시 잔액을 변경하거나 이동하지 않고 팝업에 접근 가능한 오류를 표시한다. 잔액 부족은 충전이 필요하다는 안내, 나머지는 구매 실패/재시도 안내를 표시한다. 재오픈이나 다른 회차 선택 시 이전 오류를 초기화한다.

### 주요 로직 코드 또는 변경 예시

아래는 팝업 내부의 핵심 흐름이다. 필요한 React import와 props·UI 연결을 같은 파일에서 완성한다. 구매 실패 catch는 HTTP 호출에 한정해 성공 후 이동 오류를 구매 실패로 오인하지 않는다.

```tsx
const { user, points, setPoints } = useUser();
const inFlight = useRef(false);
const [purchasing, setPurchasing] = useState(false);
const [purchaseError, setPurchaseError] = useState<string | null>(null);
const canPurchase = user !== null && points !== null
  && episode !== null && episode.pricePoints <= points;

useEffect(() => { setPurchaseError(null); }, [episode]);

const close = () => {
  if (!inFlight.current) onClose();
};

const purchase = async () => {
  if (!canPurchase || !user || !episode || inFlight.current) return;
  const selectedEpisode = episode;
  inFlight.current = true;
  setPurchasing(true);
  setPurchaseError(null);
  let result;
  try {
    result = await purchaseEpisode(user.uuid, selectedEpisode.uuid);
  } catch (error) {
    setPurchaseError(error instanceof EpisodePurchaseError
      && error.errorCode === 'POINT_INSUFFICIENT_BALANCE'
      ? '포인트가 부족해요. 포인트 충전 후 다시 시도해 주세요.'
      : '회차를 구매하지 못했어요. 다시 시도해 주세요.');
    return;
  } finally {
    inFlight.current = false;
    setPurchasing(false);
  }
  setPoints(result.availablePoints);
  onClose();
  onPurchased(selectedEpisode);
};

// Existing Button supports disabled. Connect both close controls and
// Modal.onRequestClose to close; display purchaseError with an alert role.
<Button
  label={purchasing ? '구매 중…' : canPurchase ? '구매하기' : '포인트 충전하기'}
  disabled={purchasing}
  onPress={canPurchase ? () => { void purchase(); } : onCharge}
  style={styles.chargeButton}
/>
```

각 호출 화면에는 아래 성공 콜백만 연결한다. 무료 회차 클릭 로직을 다시 호출하면 유료 회차가 다시 팝업으로 들어가므로 성공 콜백은 재생 경로로 직접 이동해야 한다. 구매 요청/잔액 갱신을 화면별로 복제하지 않는다.

```tsx
// DramaDetailScreen and RecommendationScreen: keep the source screen in history.
onPurchased={(episode) => {
  router.push({ pathname: '/episode/[id]', params: {
    id: episode.uuid, dramaId: drama.uuid,
  } });
}}

// playbackScreen_preview: replace the preview with the purchased episode.
onPurchased={(episode) => {
  router.replace({ pathname: '/episode/[id]', params: {
    id: episode.uuid, dramaId: drama.uuid,
  } });
}}

// playbackScreen_episode: replace the previous episode with the purchased one.
onPurchased={(episode) => {
  if (!dramaId) return;
  router.replace({ pathname: '/episode/[id]', params: {
    id: episode.uuid, dramaId,
  } });
}}
```

기존 player.pause 및 포커스 해제 처리와 재생 화면의 getEpisodePlayback/자동 재생을 활용한다. signed URL을 구매 응답이나 라우트 params에 추가하지 않는다. 기존 충전 버튼 이동은 유지한다. UserProvider 및 백엔드는 변경하지 않는다.

검증 명령:

```text
npm --prefix front run typecheck
npm --prefix front run test
npm --prefix front run export
```

완료 조건:

- 위 checks가 통과하고 필수 콜백이 네 호출점에 모두 연결된다.
- 실행 중인 프론트 8081/백엔드 3000에 HTTP로 연결되는지 확인한 뒤 plan.md의 실제 화면 검증을 수행하고 결과/미검증 사유를 보고한다. 서버를 자동 실행하거나 포트를 우회하지 않는다. 서버가 없으면 검증 실패와 plan.md의 시작 명령을 안내한다.
- 가격보다 작은 잔액은 충전, 동일/큰 잔액은 구매이며 null 잔액과 비로그인에서는 구매 요청하지 않는다.
- 구매 성공 시 API 응답 잔액이 전역 화면에 반영되고 정확한 회차가 자동 재생된다. chargedPoints가 0이어도 성공 흐름을 따른다.
- 구매 실패 시 기존 잔액·경로를 유지하고 오류/재시도가 가능하다. 빠른 중복 클릭은 요청 한 번이며 구매 중 팝업을 닫을 수 없다.
- 상세·추천 구매는 push, 프리뷰·회차 구매는 replace이며 뒤로 가기 동작을 확인한다. 닫힘 중 회차 번호·가격 유지에 회귀가 없다.
