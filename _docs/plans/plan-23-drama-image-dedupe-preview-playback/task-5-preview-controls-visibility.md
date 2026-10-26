# task-5-preview-controls-visibility

## 읽어야 할 파일

- AGENTS.md
- front/AGENTS.md
- _docs/ARCHITECTURE.md
- front/src/screens/playbackScreen_preview.tsx
- front/src/screens/playbackScreen_episode.tsx
- Expo SDK 57의 expo-video 문서

## 작업

목표: 프리뷰 화면에서 영상 영역을 탭하면 컨트롤이 사라지거나 다시 나타나고, 표시된 컨트롤은 회차 재생 화면과 같이 4초 뒤 자동으로 숨겨진다. 중앙 재생 버튼은 화면 정중앙에 놓고 프리뷰 영상은 원본 비율을 유지해 잘리지 않게 한다.

정확한 변경 파일: `front/src/screens/playbackScreen_preview.tsx` 한 개.

현재 프리뷰 카드의 크기, 그라디언트, 상단 정보·닫기, 우측 저장·회차·공유, 하단 작품 정보·본편 버튼의 위치와 스타일을 유지한다. 중앙 재생/일시정지 버튼만 카드의 가로·세로 정중앙으로 옮긴다. 현재 `alignSelf: 'center'`는 가로 정렬만 지정하므로 세로 중앙 배치도 명시한다. `VideoView`의 `contentFit="cover"`를 회차 화면과 같은 `contentFit="contain"`으로 바꿔 영상의 일부가 잘리지 않게 한다. 포스터는 첫 프레임 전 배경으로만 유지한다. 새 컨트롤이나 설정 메뉴를 추가하지 않는다. `playbackScreen_episode.tsx`의 컨트롤 표시 상태·4초 타이머·탭 전환·타이머 정리 방식을 참고해 프리뷰에 적용한다. 컨트롤이 숨겨져도 영상은 계속 재생하며, 다시 표시된 버튼은 기존 동작을 유지한다. 로딩·오류 화면과 재생 API 호출은 변경하지 않는다.

검증 명령: `npm --prefix front run typecheck`, `npm --prefix front run test`, `npm --prefix front run export`. 가능한 실행 환경에서는 세로·가로 프리뷰로 잘림 여부, 버튼의 실제 중앙 위치, 탭·4초 자동 숨김을 수동 확인한다. 실행 환경이 없으면 시각·터치 동작 미검증을 결과에 명시한다.

완료 조건: 진입 직후 기존 버튼이 보이며 재생 버튼은 카드의 가로·세로 중앙에 있다. 세로·가로 영상을 카드 안에서 원본 비율대로 전체 표시하며 가장자리가 잘리지 않는다. 버튼이 아닌 영상 영역을 탭하면 컨트롤이 즉시 숨겨지고, 다시 탭하면 같은 위치에 표시된다. 표시된 후 4초가 지나면 자동으로 숨겨진다. 중앙 재생/일시정지 버튼을 누르면 재생 상태가 전환되고 표시 타이머가 다시 시작된다. 닫기·저장·회차·공유·본편 버튼은 기존처럼 작동한다. 화면 이탈 시 타이머를 정리하고 재생을 멈춘다. 세 검증 명령이 통과한다.

### 주요 로직 코드 또는 변경 예시

기존 `PreviewVideo` 안에서 회차 화면과 같은 상태·타이머 흐름을 사용한다. 영상·포스터·그라디언트 위에 투명한 탭 영역을 두되 기존 버튼보다 아래에 배치해 버튼 터치를 가로채지 않는다. 모든 컨트롤 그룹에 같은 `controlsVisible` 조건을 적용한다. 재생 버튼 외 다른 컨트롤의 스타일 값은 그대로 쓴다.

~~~tsx
const [controlsVisible, setControlsVisible] = useState(true);
const hideTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

const clearHideTimer = useCallback(() => {
  if (hideTimer.current) clearTimeout(hideTimer.current);
  hideTimer.current = null;
}, []);
const showControls = useCallback(() => {
  clearHideTimer();
  setControlsVisible(true);
  hideTimer.current = setTimeout(() => setControlsVisible(false), 4000);
}, [clearHideTimer]);
const toggleControls = useCallback(() => {
  if (controlsVisible) {
    clearHideTimer();
    setControlsVisible(false);
  } else {
    showControls();
  }
}, [clearHideTimer, controlsVisible, showControls]);

useEffect(() => {
  showControls();
  return clearHideTimer;
}, [clearHideTimer, showControls]);

const togglePlayback = () => {
  if (isPlaying) player.pause();
  else player.play();
  showControls();
};

<VideoView player={player} nativeControls={false} contentFit="contain" style={StyleSheet.absoluteFill} onFirstFrameRender={() => setFirstFrameReady(true)} />
<Pressable
  style={StyleSheet.absoluteFill}
  onPress={toggleControls}
  accessibilityLabel="재생 컨트롤 표시 또는 숨기기"
/>
{controlsVisible && <Pressable
  style={styles.playMark}
  accessibilityRole="button"
  accessibilityLabel={isPlaying ? '일시정지' : '재생'}
  onPress={togglePlayback}
>
  <Icon name={isPlaying ? 'pause' : 'play'} size={29} color={colors.text} />
</Pressable>}

playMark: {
  position: 'absolute', top: '50%', left: '50%',
  marginTop: -33, marginLeft: -33,
  width: 66, height: 66, alignItems: 'center', justifyContent: 'center',
  borderWidth: 1, borderColor: '#FFFFFF40', borderRadius: 40, backgroundColor: '#0005',
},
~~~
