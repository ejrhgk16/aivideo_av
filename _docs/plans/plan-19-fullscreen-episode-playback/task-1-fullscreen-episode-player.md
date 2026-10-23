# task-1-fullscreen-episode-player

## 읽어야 할 파일

- `AGENTS.md`
- `front/AGENTS.md`
- `_docs/ARCHITECTURE.md`
- `front/src/screens/EpisodePlaybackScreen.tsx`
- `front/src/components/ui.tsx`
- `front/src/app/_layout.tsx`
- `front/app.json`
- Expo 57 문서: `https://docs.expo.dev/versions/v57.0.0/sdk/video/`

## 작업

변경 가능한 파일은 `front/src/screens/EpisodePlaybackScreen.tsx` 하나다. 회차 재생 성공 화면의 `Page` 여백, 별도 헤더와 16:9 고정 영상 크기를 없애고, 검은 배경의 앱 화면 전체에 `VideoView`를 배치한다. `contentFit="contain"`으로 영상 원본 비율을 유지한다. 상태 표시줄은 재생 화면에서만 숨기고, 영상은 화면 끝까지 배치하되 터치 컨트롤은 기기의 안전 영역 안에 둔다. 기존 앱의 세로 방향 설정은 변경하지 않는다.

Expo 57의 `VideoView` 기본 컨트롤은 앱의 뒤로 가기 버튼과 표시 상태를 공유할 수 없으므로 `nativeControls={false}`를 사용한다. 영상 위 오버레이에 뒤로 가기와 회차 제목, 재생/일시정지, 현재 시간·전체 길이와 위치 탐색을 제공한다. 재생 화면을 터치하면 이 컨트롤들이 함께 나타나거나 사라지고, 표시 중에는 일정 시간 후 함께 자동으로 숨긴다. 컨트롤을 조작하는 동안 의도치 않게 숨거나 영상 영역 터치로 오인되지 않게 한다. 플레이어의 재생 상태·시간 이벤트를 구독하고, 구독과 타이머를 정리한다. 기존 화면 이탈 시 일시정지, 로딩·조회 오류·재생 오류 동작을 보존한다.

### 주요 로직 코드

기존 `PlaybackVideo` 안에서 구현하며 변수명·스타일명은 기존 코드에 맞춘다.

```tsx
const [controlsVisible, setControlsVisible] = useState(true);
const [isPlaying, setIsPlaying] = useState(player.playing);
const [position, setPosition] = useState(player.currentTime);
const [duration, setDuration] = useState(player.duration);
const hideTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
const seeking = useRef(false);
const formatTime = (seconds: number) => {
  const whole = Math.floor(Math.max(0, seconds));
  return `${Math.floor(whole / 60)}:${String(whole % 60).padStart(2, '0')}`;
};

const clearHideTimer = () => {
  if (hideTimer.current) clearTimeout(hideTimer.current);
  hideTimer.current = null;
};
const showControls = () => {
  clearHideTimer();
  setControlsVisible(true);
  hideTimer.current = setTimeout(() => setControlsVisible(false), 3000);
};
const toggleControls = () => {
  if (controlsVisible) {
    clearHideTimer();
    setControlsVisible(false);
  } else showControls();
};

useEffect(() => {
  player.timeUpdateEventInterval = 0.5;
  const time = player.addListener('timeUpdate', ({ currentTime }) => {
    if (!seeking.current) setPosition(currentTime);
  });
  const source = player.addListener('sourceLoad', ({ duration }) => setDuration(duration));
  const playing = player.addListener('playingChange', ({ isPlaying }) => setIsPlaying(isPlaying));
  return () => { time.remove(); source.remove(); playing.remove(); };
}, [player]);
useEffect(() => {
  showControls();
  return clearHideTimer;
}, []);
```

화면 배치와 탐색 동작은 아래 흐름을 따른다. `insets`는 `useSafeAreaInsets()`로 얻고, 상단·하단 컨트롤에만 적용한다. 기존 `videoFailed` 오류 화면은 유지한다.

```tsx
<View style={styles.fullscreen}>
  <StatusBar hidden />
  <VideoView player={player} nativeControls={false} contentFit="contain"
    style={[StyleSheet.absoluteFill, { width: '100%', height: '100%' }]} />
  <Pressable style={StyleSheet.absoluteFill} onPress={toggleControls}
    accessibilityLabel="재생 컨트롤 표시 또는 숨기기" />
  {controlsVisible && <>
    <View style={[styles.topControls, { paddingTop: insets.top }]}>
      <Pressable onPress={onBack} accessibilityRole="button" accessibilityLabel="뒤로 가기">
        <Icon name="chevron-left" />
      </Pressable>
      <AppText>{playback.title || `${playback.episodeNumber}화`}</AppText>
    </View>
    <Pressable style={styles.playPause} accessibilityRole="button"
      accessibilityLabel={isPlaying ? '일시정지' : '재생'}
      onPress={() => {
        if (isPlaying) player.pause(); else player.play();
        showControls();
      }}>
      <Icon name={isPlaying ? 'pause' : 'play'} />
    </Pressable>
    <View style={[styles.bottomControls, { paddingBottom: insets.bottom }]}>
      <AppText>{formatTime(position)} / {formatTime(duration)}</AppText>
      <Slider minimumValue={0} maximumValue={Math.max(duration, 1)} value={position}
        disabled={duration <= 0}
        onSlidingStart={() => { seeking.current = true; clearHideTimer(); }}
        onValueChange={setPosition}
        onSlidingComplete={(value) => {
          player.currentTime = value;
          seeking.current = false;
          showControls();
        }} />
    </View>
  </>}
</View>
```

상단 버튼, 중앙 버튼, 하단 슬라이더가 전체 화면 터치 영역보다 위에 렌더링되어 각 조작이 `toggleControls`로 전달되지 않게 한다. 시간은 `mm:ss`로 표시하고 유효한 `duration`을 받기 전에는 탐색을 비활성화한다. 스타일은 영상 가장자리에 여백을 주지 않고 오버레이 버튼만 안전 영역 안에 둔다.

검증 명령은 아래 세 가지다.

- `npm --prefix front run typecheck`
- `npm --prefix front run test`
- `npm --prefix front run export`

완료 조건은 영상 뷰가 앱 화면 전체를 차지하면서 영상 비율이 유지되고, 터치 시 뒤로 가기와 재생 컨트롤이 함께 표시되며, 재생/일시정지·위치 탐색·자동 숨김·뒤로 가기가 의도대로 작동하는 것이다. Android/iOS 실제 기기에서 검은 여백과 안전 영역, 터치 동작을 확인할 수 있도록 수동 확인 항목을 결과에 명시한다. 자동 명령만으로 네이티브 상호작용을 확인했다고 주장하지 않는다.
