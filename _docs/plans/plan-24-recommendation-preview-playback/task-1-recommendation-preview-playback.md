# task-1-recommendation-preview-playback

## 읽어야 할 파일

- `AGENTS.md`
- `front/AGENTS.md` 및 구현 전에 Expo 57 문서 `https://docs.expo.dev/versions/v57.0.0/`
- `_docs/ARCHITECTURE.md`
- `front/src/screens/playbackScreen_preview.tsx`
- `front/src/screens/RecommendationScreen.tsx`
- `front/src/features/home/homeContent.ts`
- `front/src/features/playback/previewPlayback.ts`

## 작업

정확한 변경 파일은 `front/src/screens/RecommendationScreen.tsx` 하나다. 다른 파일은 수정하지 않는다. 특히 `playbackScreen_preview.tsx`는 읽기 전용 참고 자료이며 공통 플레이어를 만들지 않는다.

1. 기존 `getHomeCollection('RECOMMENDATION_DAILY')` 호출과 `FlatList`의 `pagingEnabled`, 추천 작품 순서, `initialId` 우선 표시를 유지한다. 컬렉션 로드 직후 첫 표시 작품의 `previewVideos[0].uuid`로 `getPreviewPlayback`을 호출한다. 이후에는 스크롤로 활성화된 작품만 호출한다. 컬렉션 API 응답에 재생 URL을 추가하거나 모든 작품의 URL을 한 번에 요청하지 않는다. 다음 작품 선요청도 이번 작업에는 넣지 않는다.
2. 활성 카드에만 `expo-video` 플레이어를 마운트하고 `VideoView contentFit="contain"`으로 재생한다. 스크롤을 시작하면 플레이어를 언마운트해 영상을 멈추고, 모멘텀이 없는 짧은 드래그를 포함해 페이지에 정착하면 해당 카드를 활성화한다. 추천 탭 이탈 시 일시정지하고 복귀하면 활성 카드의 자동 재생을 복구한다. 다른 카드는 포스터 카드로 남긴다.
3. 영상 로딩 중·프리뷰 없음·URL 조회 오류·플레이어 오류 시 포스터를 표시하고 기존 저장·회차·공유·본편 보기 동작과 세로 스크롤을 유지한다. 뒤늦게 완료된 이전 카드의 요청이 현재 카드의 화면을 덮지 못하게 한다. 이 작업에서는 전체 재생 조작 UI를 구현하지 않는다. 해당 UI는 `task-2`에서 추가한다.

### 주요 로직 코드 또는 변경 예시

아래는 첫 카드 활성화, 카드별 URL 요청, 영상 재생의 핵심 흐름이다. 실제 컴포넌트의 기존 레이아웃과 포스터 카드 액션은 유지하면서 적용한다.

```tsx
type ActivePreview =
  | { kind: 'loading'; dramaId: string }
  | { kind: 'ready'; dramaId: string; url: string }
  | { kind: 'poster'; dramaId: string };

const [activeId, setActiveId] = useState<string | null>(null);
const [activePreview, setActivePreview] = useState<ActivePreview | null>(null);

const receiveCollection = (result: HomeCollection) => {
  const ordered = [...result.dramas].sort((first, second) => {
    if (first.uuid === initialId) return -1;
    if (second.uuid === initialId) return 1;
    return first.displayOrder - second.displayOrder;
  });
  setCollection(result);
  setActiveId(ordered[0]?.uuid ?? null);
  setStatus('loaded');
};

useEffect(() => {
  if (!activeId) {
    setActivePreview(null);
    return;
  }
  const item = collection?.dramas.find((drama) => drama.uuid === activeId);
  const videoId = item?.previewVideos[0]?.uuid;
  if (!videoId) {
    setActivePreview({ kind: 'poster', dramaId: activeId });
    return;
  }
  let live = true;
  setActivePreview({ kind: 'loading', dramaId: activeId });
  getPreviewPlayback(activeId, videoId).then(
    (playback) => { if (live) setActivePreview({ kind: 'ready', dramaId: activeId, url: playback.url }); },
    () => { if (live) setActivePreview({ kind: 'poster', dramaId: activeId }); },
  );
  return () => { live = false; };
}, [activeId, collection]);

const settleOnPage = (offsetY: number) => {
  const index = Math.max(0, Math.min(dramas.length - 1, Math.round(offsetY / cardHeight)));
  setActiveId(dramas[index]?.uuid ?? null);
};
const viewabilityConfig = useRef({ itemVisiblePercentThreshold: 95 }).current;
const onViewableItemsChanged = useRef(({ viewableItems }: { viewableItems: ViewToken[] }) => {
  const visible = viewableItems.find((entry) => entry.isViewable)?.item as HomeCollectionDrama | undefined;
  if (visible) setActiveId(visible.uuid);
}).current;

function ActiveRecommendationVideo({ url, onError }: { url: string; onError: () => void }) {
  const player = useVideoPlayer(url, (videoPlayer) => videoPlayer.play());
  useFocusEffect(useCallback(() => {
    player.play();
    return () => player.pause();
  }, [player]));
  useEffect(() => {
    const status = player.addListener('statusChange', ({ status: next }) => {
      if (next === 'error') onError();
    });
    return () => status.remove();
  }, [player, onError]);
  return <VideoView player={player} nativeControls={false} contentFit="contain" style={StyleSheet.absoluteFill} />;
}

<FlatList
  data={dramas}
  pagingEnabled
  initialScrollIndex={initialIndex}
  getItemLayout={(_, index) => ({ length: cardHeight, offset: cardHeight * index, index })}
  onScrollBeginDrag={() => setActiveId(null)}
  onMomentumScrollEnd={(event) => settleOnPage(event.nativeEvent.contentOffset.y)}
  viewabilityConfig={viewabilityConfig}
  onViewableItemsChanged={onViewableItemsChanged}
  renderItem={({ item }) => activeId === item.uuid && activePreview?.kind === 'ready' && activePreview.dramaId === item.uuid
    ? <View style={[styles.card, { height: cardHeight }]}>
        <ActiveRecommendationVideo url={activePreview.url}
          onError={() => setActivePreview({ kind: 'poster', dramaId: item.uuid })} />
        {renderExistingCardActions(item)}
      </View>
    : renderPosterCard(item)}
/>
```

`receiveCollection`을 기존 컬렉션 조회의 성공 분기에서 호출한다. 영상 첫 프레임 전에는 포스터를 덮어 보여주고, 프레임이 준비되면 제거한다. `onViewableItemsChanged`가 모멘텀이 없는 드래그의 정착도 감지한다. `renderExistingCardActions`와 `renderPosterCard`는 기존 카드 UI·이벤트를 유지해 구현하며, 이름 자체는 예시다. 플레이어는 추천 화면 내부 전용 함수로 둔다.

검증 명령:

- `npm --prefix front run typecheck`
- `npm --prefix front run test`
- `npm --prefix front run export`

완료 조건: 추천 피드의 세로 페이징·초기 작품 선택·기존 액션을 유지한 채 첫 카드 및 이후 활성 카드의 URL만 개별 요청하고 영상이 재생된다. 스와이프·탭 이탈 시 영상이 멈추며 실패 카드의 포스터와 조작이 살아 있다. 기기 수동 확인이 불가능하면 실제 터치·영상 재생은 미검증으로 기록한다.
