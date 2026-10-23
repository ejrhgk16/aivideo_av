# task-1-episode-playback-progress

## 읽어야 할 파일

- `AGENTS.md`
- `front/AGENTS.md`
- `_docs/ARCHITECTURE.md`
- `front/src/screens/EpisodePlaybackScreen.tsx`
- `front/node_modules/expo-video/src/VideoPlayer.web.tsx` (`sourceLoad` 이벤트가 없는 웹 구현 확인)
- `front/node_modules/@react-native-community/slider/src/RNCSliderNativeComponent.web.tsx`
- Expo 57 영상 문서: `https://docs.expo.dev/versions/v57.0.0/sdk/video/`

## 작업

변경 가능한 파일은 `front/src/screens/EpisodePlaybackScreen.tsx` 하나다. 웹에서 총 길이 갱신을 `sourceLoad` 이벤트에만 의존하는 문제를 고친다. `PlaybackVideo`의 기존 플레이어 이벤트 구독 안에서 재생 준비 상태와 주기적인 시간 갱신 시 `player.duration`을 읽는다. 유한하고 양수인 길이만 재생 가능한 총 길이로 저장하고, `sourceLoad`도 네이티브 경로용으로 유지한다. 현재 시간은 드래그 중이 아닐 때만 갱신한다. 슬라이더가 하단 영역의 가로 폭을 차지하도록 하고, 길이가 확인되면 활성화한다. 드래그 시작에는 자동 숨김 타이머를 멈추고, 드래그 완료에는 `player.currentTime`을 선택 값으로 설정한 뒤 컨트롤 표시 시간을 다시 시작한다. 기존 전체 화면 및 다른 컨트롤의 배치와 동작은 보존한다.

### 주요 로직 코드 또는 변경 예시

아래는 기존 `PlaybackVideo`의 이벤트 구독과 슬라이더에 적용할 핵심 흐름이다. 실제 코드는 기존 변수명과 스타일을 따르며 중복 구독을 만들지 않는다.

```tsx
useEffect(() => {
  player.timeUpdateEventInterval = 0.5;
  const syncDuration = () => {
    const next = player.duration;
    if (Number.isFinite(next) && next > 0) setDuration(next);
  };
  syncDuration();
  const time = player.addListener('timeUpdate', ({ currentTime }) => {
    syncDuration(); // 웹에는 sourceLoad가 없어도 실제 영상 길이를 읽는다.
    if (!seeking.current && Number.isFinite(currentTime)) setPosition(currentTime);
  });
  const status = player.addListener('statusChange', ({ status }) => {
    if (status === 'readyToPlay') syncDuration();
  });
  const source = player.addListener('sourceLoad', ({ duration: videoDuration }) => {
    if (Number.isFinite(videoDuration) && videoDuration > 0) setDuration(videoDuration);
  });
  const playing = player.addListener('playingChange', ({ isPlaying: playingNow }) => setIsPlaying(playingNow));
  return () => {
    time.remove();
    status.remove();
    source.remove();
    playing.remove();
  };
}, [player]);

<Slider
  style={{ width: '100%' }}
  minimumValue={0}
  maximumValue={Math.max(duration, 1)}
  value={position}
  disabled={duration <= 0}
  onSlidingStart={() => {
    seeking.current = true;
    clearHideTimer();
  }}
  onValueChange={setPosition}
  onSlidingComplete={(value) => {
    player.currentTime = value;
    seeking.current = false;
    showControls();
  }}
/>
```

기존 `statusChange` 오류 구독은 유지하거나 위 구독과 합치되 오류 처리 중복이나 누락이 없도록 한다. 총 길이가 아직 없거나 무한대이면 `0:00` 및 비활성 탐색 상태를 유지한다. 재생 가능 길이가 들어온 후에는 총 길이·현재 시간·진행 막대가 같은 플레이어 값으로 표시되어야 한다.

검증 명령은 아래 세 가지다.

- `npm --prefix front run typecheck`
- `npm --prefix front run test`
- `npm --prefix front run export`

완료 조건은 웹 모바일 크기에서 실제 본편을 재생할 때 총 길이가 표시되고, 현재 시간과 진행 막대가 증가하며, 슬라이더를 놓은 위치로 영상이 이동하는 것이다. 드래그 중 컨트롤이 사라지지 않아야 하고, 드래그 후 자동 숨김이 재개되어야 한다. Android/iOS에서 기존 재생 컨트롤과 탐색 동작이 유지되어야 한다. 자동 명령만으로 브라우저·실기기 상호작용을 확인했다고 주장하지 말고 수동 확인 결과나 미확인 상태를 명시한다.
