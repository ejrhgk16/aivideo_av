# task-4-recommendation-vertical-swipe

## 읽어야 할 파일

- `AGENTS.md`
- `front/AGENTS.md` 및 구현 전에 Expo 57 문서 `https://docs.expo.dev/versions/v57.0.0/`
- `_docs/ARCHITECTURE.md`
- `front/src/screens/RecommendationScreen.tsx`
- `front/src/components/ui.tsx` (`Page`의 스크롤·레이아웃 확인용)
- `front/src/screens/playbackScreen_preview.tsx` (읽기 전용 재생 UI 참고)
- `front/src/features/home/homeContent.ts` (`imageUrls.poster` 응답 확인)
- `front/src/common/media.ts` (포스터 URL 처리)

## 확인된 사실과 문제

- 실행 중인 `GET /collections/RECOMMENDATION_DAILY` 응답의 `dramas`는 5개다. 현재 화면도 전체 `dramas`를 `FlatList`에 전달하고 `pagingEnabled`를 사용한다.
- 사용 환경은 웹 브라우저다. 사용자는 첫 영상이 정상 재생되지만 다음 추천 영상으로 넘어가지 않는다고 보고했다.
- 재생 카드에는 화면 전체 `Pressable`이 있고, `onScrollBeginDrag`에서 `activeId`를 `null`로 바꿔 플레이어를 언마운트한다. 스와이프 동작과 `onScrollEndDrag`·`onMomentumScrollEnd`의 활성 카드 갱신을 함께 점검한다.
- 코드상 활성 카드를 바꾸는 경로는 `onScrollEndDrag`의 120ms 타이머와 `onMomentumScrollEnd`뿐이다. `onScroll`이나 가시성 변화로 최종 페이지를 갱신하는 경로가 없다. 설치된 React Native Web 0.21의 `ScrollView`는 DOM `scroll`을 처리하지만 드래그·모멘텀 종료 이벤트를 별도로 합성하지 않는다. 따라서 웹에서는 스크롤 후에도 `activeId`가 첫 작품에 남는 것이 원인이다. 전체 화면 `Pressable`의 제스처 간섭 가능성은 수정 후 웹 터치 스와이프로 검증한다.

## 작업

변경 파일은 `front/src/screens/RecommendationScreen.tsx` 하나다. 기존 `playbackScreen_preview.tsx`를 수정하거나 공통 재생 컴포넌트를 만들지 않는다.

1. 첫 영상이 재생 중인 추천 카드 본문에서 위로 스와이프하면 두 번째 작품, 다시 위로 스와이프하면 세 번째 작품으로 이동하도록 터치 처리와 `FlatList`의 페이징을 수정한다. 아래로 스와이프하면 이전 작품으로 돌아온다. 중앙 탭으로 컨트롤 표시·숨김과 버튼·탐색 바 조작도 유지한다. 전체 화면 터치 레이어 또는 네이티브 영상 뷰가 스크롤 제스처를 가로채는지 확인한다.
2. 웹에서 실제로 발생하는 `onScroll`과 최종 페이지 오프셋 또는 카드 가시성으로 활성 작품을 갱신한다. 첫 스크롤에 이전 영상을 멈추고, CSS 스크롤 스냅까지 끝난 뒤 최종 정착 카드의 `activeId`를 설정한다. 짧은 드래그 후 같은 페이지에 남는 경우에도 영상이 복구되어야 한다. 기존 네이티브 동작도 유지한다. 페이지 전환 중 URL 요청 결과가 뒤늦게 도착해 다른 카드의 재생 상태를 덮지 않게 한다.
3. 영상이 표시되지 않는 카드의 이전 추천 카드 UI를 제거하고 `imageUrls.poster` 이미지만 카드 영역에 표시한다. 비활성·로딩·프리뷰 없음·URL 조회 실패·플레이어 오류 상태를 포함한다. 제목·설명·배지·그라데이션·저장·회차·공유·본편 보기 버튼은 포스터 전용 화면에 겹치지 않는다. 포스터 URL이 없으면 단색 배경만 표시한다. 재생 중 또는 사용자가 일시정지한 활성 카드에는 영상과 재생 조작 UI를 유지한다.
4. API 응답 5개를 모두 이동할 수 있게 하되, 기존 `initialId` 우선 표시, 활성 카드별 URL 요청, `contentFit="contain"`, 재생 중 카드의 저장·회차·공유·본편 보기 동작을 유지한다. 데이터나 백엔드 API는 변경하지 않는다. 이번 수정으로 불필요해진 이전 카드 UI·스타일만 제거한다.

### 주요 로직 코드 또는 변경 예시

웹에서 발생하는 `onScroll`을 기준으로 마지막 오프셋을 저장하고 스크롤이 잠시 멈춘 뒤 활성 작품을 정한다. 네이티브의 모멘텀 종료 이벤트는 그대로 최종 페이지를 확정하는 데 사용할 수 있다. 실제 구현에서는 스크롤 중 플레이어를 멈추는 시점이 터치 제스처를 끊지 않는지 확인한다.

```tsx
const lastScrollY = useRef(0);
const settleTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

const settleOnPage = (offsetY: number) => {
  if (cardHeight <= 0) return;
  const index = Math.max(0, Math.min(dramas.length - 1, Math.round(offsetY / cardHeight)));
  setActiveId(dramas[index]?.uuid ?? null);
};

const clearSettleTimer = () => {
  if (settleTimer.current) clearTimeout(settleTimer.current);
  settleTimer.current = null;
};

const handleFeedScroll = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
  lastScrollY.current = event.nativeEvent.contentOffset.y;
  clearSettleTimer();
  settleTimer.current = setTimeout(() => {
    settleTimer.current = null;
    settleOnPage(lastScrollY.current);
  }, 150);
};

<FlatList
  data={dramas}
  pagingEnabled
  onScroll={handleFeedScroll}
  scrollEventThrottle={16}
  onMomentumScrollEnd={(event) => {
    clearSettleTimer();
    settleOnPage(event.nativeEvent.contentOffset.y);
  }}
  // 기존 initialScrollIndex, getItemLayout, keyExtractor 등은 유지
/>
```

기존 추천 카드 UI를 그대로 남기는 분기를 포스터 전용 분기로 바꾼다. `Image`와 `resolveApiImageUrl`을 가져와 사용한다. `showVideo`는 영상이 준비되고 해당 카드가 활성화·포커스된 경우만 참이다. 일시정지는 플레이어 마운트를 해제하지 않으므로 영상 프레임과 조작 UI가 남는다.

```tsx
const posterUrl = resolveApiImageUrl(drama.imageUrls.poster);
const showVideo = screenFocused && activeId === drama.uuid
  && activePreview?.dramaId === drama.uuid && activePreview.kind === 'ready';

return <View style={[styles.card, { height: cardHeight }]}>
  {showVideo && activePreview?.kind === 'ready'
    ? <RecommendationPreviewPlayer
        url={activePreview.url}
        drama={drama}
        content={activeDrama}
        saved={savedIds.includes(drama.uuid)}
        onError={() => setActivePreview((current) => current?.dramaId === drama.uuid
          ? { kind: 'unavailable', dramaId: drama.uuid } : current)}
        onToggleSave={() => toggleSave(drama.uuid)}
        onOpenEpisodes={() => openEpisodes(drama)}
        onShare={() => { void shareDrama(drama); }}
      />
    : posterUrl
      ? <Image source={{ uri: posterUrl }} contentFit="cover" style={StyleSheet.absoluteFill} />
      : <View style={[StyleSheet.absoluteFill, styles.placeholder]} />}
</View>;
```

위 코드는 변경 방향을 보여주는 예시다. 실제 코드에서는 `onScroll`의 마지막 오프셋이 CSS 스크롤 스냅으로 정착한 위치인지 확인하고, 기존 URL 요청 취소·재생 의도·타이머 정리를 유지한다.

## 검증

- `npm --prefix front run typecheck`
- `npm --prefix front run test`
- `npm --prefix front run export`
- 웹 브라우저에서 첫 영상 재생 중 카드 본문을 위로 두 번, 아래로 한 번 스와이프해 작품과 영상이 순서대로 바뀌는지 확인한다. 컨트롤을 표시한 상태와 숨긴 상태, 짧은 드래그, 탭 복귀도 확인한다. 영상 로딩·실패·비활성 카드에는 포스터 이미지만 보이고 이전 카드의 텍스트·버튼이 없는지도 확인한다. 브라우저 조작 검증이 불가능하면 코드·자동 검증 결과와 실제 터치 동작 미검증을 분명히 구분해 보고한다.

완료 조건: 추천 첫 영상 재생 중에도 세로 스와이프가 동작하고, 다음·이전 카드에 정착할 때 해당 작품의 영상이 재생된다. 스와이프와 탭 이탈 시 이전 영상이 멈춘다. 영상이 표시되지 않는 카드에는 포스터만 나타나며, 재생 중 카드의 컨트롤·버튼·탐색 바는 계속 동작한다.
