# task-2-recommendation-playback-controls

## 읽어야 할 파일

- `AGENTS.md`
- `front/AGENTS.md` 및 구현 전에 Expo 57 문서 `https://docs.expo.dev/versions/v57.0.0/`
- `_docs/ARCHITECTURE.md`
- `front/src/screens/RecommendationScreen.tsx`
- `front/src/screens/playbackScreen_preview.tsx` (읽기 전용 UI·동작 참고)
- `front/src/features/drama/dramaContent.ts`
- `front/src/components/EpisodeUnlockDialog.tsx`

## 작업

`task-1` 완료 후 실행한다. 정확한 변경 파일은 `front/src/screens/RecommendationScreen.tsx` 하나다. `playbackScreen_preview.tsx`와 다른 파일은 수정하지 않는다. 추천 화면 안의 전용 플레이어에 전체 재생 조작 UI를 구현하며 공통 플레이어 컴포넌트를 만들지 않는다.

1. 현재 활성 작품에 한해 기존 `getDramaContent`를 조회한다. 상세의 첫 회차 UUID·가격으로 `1화부터 본편 보기`를 구현한다. 무료 회차는 추천 탭에서 회차 화면을 `push`하고, 유료 회차는 기존 `EpisodeUnlockDialog`를 표시한다. 상세 조회가 실패해도 영상 재생과 피드 스크롤은 유지하고 본편 버튼은 회차 목록으로 연결한다. 작품 제목은 상세 화면, 회차 버튼은 상세의 회차 탭으로 연결한다.
2. `playbackScreen_preview.tsx`의 조작을 추천 카드에 독립적으로 적용한다: 탭으로 표시·숨김과 4초 자동 숨김, 중앙 재생·일시정지, 배속 메뉴, 현재 시간·길이와 탐색 바, 더보기 설정 모달, 저장·회차·공유, 작품 제목·장르·제작사, 첫 회차 버튼, 유료 회차 팝업. 설정의 자막·다음 화 자동 재생·신고는 현재처럼 준비 중으로 표시한다. 저장 상태는 `RecommendationScreen`의 `savedIds`를 사용해 카드 이동 후에도 유지한다.
3. 상단 닫기는 이전 화면이 있으면 뒤로 가고 없으면 홈으로 이동한다. 추천 탭에서는 상태 바를 숨기지 않고 카드 내부 여백에 맞춰 조작 UI를 배치한다. 탭 이탈·카드 전환 시 영상과 타이머를 정리하고, 탭 복귀 시 이탈 전 재생 의도를 복구한다. 전체 화면 터치 레이어와 탐색 바가 `FlatList`의 세로 스와이프를 막지 않아야 한다. 영상 실패 시 `task-1`의 포스터 대체 표시를 유지한다.

### 주요 로직 코드 또는 변경 예시

아래는 활성 작품의 상세 정보, 시간·속도 구독, 컨트롤 타이머, 첫 회차 진입을 연결하는 핵심 흐름이다. 기존 화면의 `ActiveRecommendationVideo`를 이 기능으로 확장한다.

```tsx
useEffect(() => {
  if (!activeId) {
    setActiveDrama(null);
    return;
  }
  let live = true;
  setActiveDrama(null);
  getDramaContent(activeId).then(
    (drama) => { if (live) setActiveDrama(drama); },
    () => { if (live) setActiveDrama(null); },
  );
  return () => { live = false; };
}, [activeId]);

const clearHideTimer = useCallback(() => {
  if (hideTimer.current) clearTimeout(hideTimer.current);
  hideTimer.current = null;
}, []);
const showControls = useCallback(() => {
  clearHideTimer();
  setControlsVisible(true);
  hideTimer.current = setTimeout(() => setControlsVisible(false), 4000);
}, [clearHideTimer]);

useEffect(() => {
  player.timeUpdateEventInterval = 0.5;
  const time = player.addListener('timeUpdate', ({ currentTime }) => {
    if (!seeking.current) setPosition(currentTime);
    if (player.duration > 0) setDuration(player.duration);
  });
  const playing = player.addListener('playingChange', ({ isPlaying }) => setIsPlaying(isPlaying));
  const rate = player.addListener('playbackRateChange', ({ playbackRate }) => setPlaybackRate(playbackRate));
  return () => { time.remove(); playing.remove(); rate.remove(); };
}, [player]);

const watchFirstEpisode = () => {
  const firstEpisode = [...(activeDrama?.episodes ?? [])]
    .sort((first, second) => first.episodeNumber - second.episodeNumber)[0];
  player.pause();
  if (!firstEpisode) {
    router.push({ pathname: '/drama/[id]', params: { id: drama.uuid, tab: 'episodes' } });
  } else if (firstEpisode.pricePoints > 0) {
    setLockedEpisode(firstEpisode);
  } else {
    router.push({ pathname: '/episode/[id]', params: { id: firstEpisode.uuid, dramaId: drama.uuid } });
  }
};

<Slider
  minimumValue={0}
  maximumValue={Math.max(duration, 1)}
  value={position}
  disabled={duration <= 0}
  onSlidingStart={() => { seeking.current = true; clearHideTimer(); }}
  onValueChange={setPosition}
  onSlidingComplete={(value) => {
    player.currentTime = value;
    seeking.current = false;
    showControls();
  }}
/>
```

위 `drama`는 현재 카드의 `HomeCollectionDrama`이고 `activeDrama`는 `DramaContent | null`이다. 재생 컨트롤의 이벤트·타이머 상태는 활성 카드 플레이어에 두어 카드 전환 시 정리한다. 상세 응답으로 버튼 메타데이터를 갱신하되 상세 조회 실패가 재생 URL 요청 실패로 번지지 않도록 한다. `playbackScreen_preview.tsx`의 UI를 참고하지만 스타일과 상태를 그 파일에서 가져오지 않는다.

검증 명령:

- `npm --prefix front run typecheck`
- `npm --prefix front run test`
- `npm --prefix front run export`

완료 조건: 추천 카드에 전체 재생 조작이 동작하고, 영상이 없거나 실패해도 포스터와 기존 추천 액션을 사용할 수 있다. 세로 페이지 스크롤·초기 작품 선택·탭 이동이 유지되고, 별도 프리뷰 화면은 변경되지 않는다. 기기 수동 확인이 불가능하면 실제 터치·영상 재생은 미검증으로 기록한다.
