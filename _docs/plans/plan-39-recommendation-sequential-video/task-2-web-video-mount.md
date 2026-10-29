# task-2-web-video-mount

## 읽어야 할 파일
- `AGENTS.md`
- `_docs/ARCHITECTURE.md`
- `front/AGENTS.md`
- `_docs/plans/plan-39-recommendation-sequential-video/plan.md`
- `front/src/screens/RecommendationScreen.tsx`
- `front/src/features/playback/recommendationPreviewBuffer.ts`
- `front/tests/unit/recommendationPreviewBuffer.test.ts`
- `front/scripts/test-front.cjs`
- 구현 전 Expo 57 공식 문서 및 설치된 expo-video의 웹 VideoView·VideoPlayer 구현에서 마운트 → HTML video 로딩 → canplay → readyToPlay 흐름을 확인한다.

## 작업
리뷰 P1만 해결한다. 현재 화면은 preparedPlayers에 등록된 플레이어만 VideoView를 마운트한다. 웹에서는 VideoView가 먼저 마운트돼야 로딩과 readyToPlay 이벤트가 발생하므로 이 순환 의존을 제거한다.

### 정확한 수정 범위
- `front/src/screens/RecommendationScreen.tsx`
- `front/tests/unit/recommendationPreviewBuffer.test.ts`
- 위 두 파일만 수정한다. 버퍼 모듈·의존성·다른 화면·백엔드를 변경하지 않는다.
- 리뷰 P2는 사용자의 요청에 따라 수정하지 않는다. beginPageInput, correcting, targetIndex, 스크롤·타이머·입력 차단 동작은 현재 상태를 유지한다.

### 구현 지시
- 화면에 포커스가 있고 버퍼에 유효한 플레이어가 있으면 실제 준비 여부와 무관하게 해당 카드의 VideoView를 마운트한다. 버퍼의 kind: ready는 플레이어 생성 완료이며 player.status의 readyToPlay와 구별한다.
- preparedPlayers는 영상 가시성과 컨트롤 노출 판단에 사용한다. 준비 전 VideoView는 opacity: 0으로 숨기고 기존 검은 카드 배경을 보여준다. display: none이나 조건부 언마운트로 로딩을 막지 않는다.
- readyToPlay 이벤트 후 같은 VideoView의 opacity만 변경한다. key와 player를 유지하고 현재 작품만 자동 재생한다. 준비된 이웃 영상은 표시하되 재생하지 않는다.
- 로딩 중 표지를 표시하지 않는 규칙, 영상 없음·실패 시 기존 표지, blur 정지·해제 및 사용자 일시정지를 보존한다.

### 주요 로직 코드 또는 변경 예시
기존 renderItem에서 마운트 조건과 표시 조건을 분리한다. 기존 컨트롤·표지 조건 및 카드 배치는 보존한다.

```tsx
const player = entry?.kind === 'ready' ? entry.player : undefined;
const mountVideo = screenFocused && Boolean(player);
const showVideo = mountVideo && preparedPlayers.get(key) === player;
const showControls = showVideo && !scrolling && activeId === drama.uuid && activePlayer === player;

// 기존 카드 내부의 VideoView 부분
{mountVideo && player ? <VideoView
  key={key}
  player={player}
  nativeControls={false}
  contentFit="contain"
  surfaceType="textureView"
  pointerEvents="none"
  style={[StyleSheet.absoluteFill, styles.playerVideo, { opacity: showVideo ? 1 : 0 }]}
/> : null}
```

### 회귀 테스트와 완료 조건
- 기존 loading 테스트의 'VideoView가 없어야 한다'는 기대를 'VideoView가 마운트되며 opacity는 0'으로 변경한다. 준비 전 표지·컨트롤은 없어야 한다.
- 웹 생명주기를 재현하는 테스트를 추가한다. idle 플레이어로 시작하고 실제 렌더링된 카드에서 해당 player의 VideoView가 발견된 경우에만 canplay에 해당하는 readyToPlay 이벤트를 발생시키는 헬퍼 또는 흐름을 사용한다. 화면과 무관하게 준비 이벤트를 보내 기존 결함을 우회하지 않는다.
- 기존 코드에서는 View 미마운트 때문에 준비 단계로 진행하지 못해 실패하고, 수정 후에는 마운트 → 준비 이벤트 → 영상 노출·현재 작품 재생이 검증돼야 한다.
- 준비 이벤트가 status 속성 갱신보다 먼저 와도 영상 노출이 갱신돼야 한다. 준비 전후 VideoView key와 player가 동일해야 한다.
- 이웃 플레이어 역시 준비 전 마운트되고 준비 후 노출되지만 재생되지 않아야 한다. 사용자 일시정지 유지, 실패 시 표지, blur 후 재생 방지에 관한 기존 검증을 보존한다.
- 스크롤·보정·입력 처리에 제품 코드 diff가 없어야 한다.

### 검증 명령
- `npm --prefix front run typecheck`
- `npm --prefix front run test`
- `npm --prefix front run export`
- 기존 `http://localhost:8081`의 현재 코드 반영을 확인하고, 가능하면 브라우저에서 추천 화면 첫 진입 → 실제 영상 로딩·재생 및 표지 생략을 확인한다. HTTP 200이나 export 성공을 실제 영상 재생 확인으로 보고하지 않는다.
- 서버가 없으면 화면 검증 실패와 `npm --prefix front run start -- --port 8081` 안내를 기록한다. 서버를 자동 실행하거나 다른 포트로 우회하지 않는다. 브라우저 조작 도구나 네이티브 기기가 없으면 해당 검증을 미검증으로 명시한다.
