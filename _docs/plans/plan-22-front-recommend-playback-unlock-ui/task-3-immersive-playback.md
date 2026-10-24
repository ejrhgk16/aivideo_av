# task-3-immersive-playback

## 읽어야 할 파일

- `AGENTS.md`
- `_docs/ARCHITECTURE.md`
- `front/AGENTS.md` 및 해당 파일이 요구하는 Expo 57 공식 문서
- `front/src/app/episode/[id].tsx`
- `front/src/screens/EpisodePlaybackScreen.tsx` (읽기만 하고 수정하지 않음)
- `front/src/features/playback/episodePlayback.ts`
- `front/src/screens/DramaDetailScreen.tsx` (`task-2` 완료 상태)
- `front/src/components/ui.tsx`
- `web-prototype/components/drama-app.tsx` (재생 화면 UI 대조용, 읽기만)
- `web-prototype/app/globals.css` (재생 화면 스타일 대조용, 읽기만)

## 작업

변경 파일은 새 `front/src/screens/ImmersiveEpisodePlaybackScreen.tsx`와 `front/src/app/episode/[id].tsx`다. 기존 `front/src/screens/EpisodePlaybackScreen.tsx`는 파일 전체를 그대로 보존한다. 라우트가 새 화면을 렌더링하도록 바꾸고 선택적으로 전달된 `dramaId`, `dramaTitle`을 새 화면에 넘긴다.

새 화면은 기존 `getEpisodePlayback(id)` 호출과 실제 `expo-video` 영상 재생을 유지한다. 기존 화면의 로딩·404·일반 오류·영상 오류, 재생/일시정지, 재생 시간·탐색, 화면 이탈 시 일시정지를 새 화면에도 구현한다. 화면 구성은 상단 닫기·회차 표시, 중앙 재생, 우측 저장·회차·공유, 하단 작품·회차 정보와 진행 막대를 배치한다. 저장은 화면 내부 표시 상태로만 토글한다. 공유는 플랫폼 공유 시트를 사용한다. 회차 버튼은 `dramaId`가 있으면 작품 상세의 `전체 회차` 탭으로 이동하고, 직접 열린 회차 링크처럼 `dramaId`가 없는 경우에는 버튼을 표시하지 않는다. 새 API 요청이나 의존성을 추가하지 않는다.

읽기 전용 시안과 대조할 요소는 상단의 닫기·회차·속도/설정 배치, 중앙 재생 버튼, 우측 저장·회차·공유 세로 배열, 하단의 작품명·회차·이전/다음 화 위치·진행 막대·시간 표시다. 기존 API 응답에는 인접 회차 정보가 없으므로 이전/다음 화는 동작 가능한 회차 정보를 갖는 경우에만 활성화하고 가짜 이동을 만들지 않는다. 속도는 현재 플레이어에서 지원되는 범위에서만 적용하고, 설정 팝업의 서버 미연결 항목은 동작 가능한 것처럼 표시하지 않는다. 시안 파일은 수정하거나 검증하지 않는다.

검증 명령: `npm --prefix front run typecheck`, `npm --prefix front run test`, `npm --prefix front run export`.

완료 조건: 상세 화면에서 무료 회차를 열면 새 UI에서 실제 영상이 재생되고, 시간 표시·탐색·일시정지·오류 동작이 유지된다. 작품 정보가 전달된 경우 회차 버튼이 해당 작품의 회차 탭을 연다. 기존 재생 화면 파일 내용은 변경되지 않는다.

### 주요 로직 코드 또는 변경 예시

라우트는 기존 회차 식별자를 유지하고 작품 정보를 추가로 전달한다.

```tsx
const { id, dramaId, dramaTitle } = useLocalSearchParams<{
  id: string;
  dramaId?: string;
  dramaTitle?: string;
}>();
return <ImmersiveEpisodePlaybackScreen id={id} dramaId={dramaId} dramaTitle={dramaTitle} />;
```

새 화면은 기존 화면의 데이터 요청과 플레이어 생명주기를 복사해 별도 구현한다. 핵심 이벤트는 다음과 같다.

```tsx
useEffect(() => {
  let active = true;
  setLoadState('loading');
  getEpisodePlayback(id).then((result) => {
    if (!active) return;
    setPlayback(result);
    setLoadState('loaded');
  }).catch((error: unknown) => {
    if (!active) return;
    const message = error instanceof Error ? error.message : '';
    setLoadState(/:\s*404\b/.test(message) ? 'not-found' : 'error');
  });
  return () => { active = false; };
}, [id]);

const player = useVideoPlayer(playback.url, (instance) => {
  instance.currentTime = 0;
  instance.play();
});
useFocusEffect(useCallback(() => () => player.pause(), [player]));

const openEpisodes = () => {
  if (!dramaId) return;
  router.push({ pathname: '/drama/[id]', params: { id: dramaId, tab: 'episodes' } });
};
const togglePlayback = () => {
  if (player.playing) player.pause();
  else player.play();
};

<VideoView player={player} nativeControls={false} style={StyleSheet.absoluteFill} />
<Pressable onPress={togglePlayback} accessibilityLabel={player.playing ? '일시정지' : '재생'}>
  <Icon name={player.playing ? 'pause' : 'play'} />
</Pressable>
{dramaId ? <Pressable onPress={openEpisodes} accessibilityLabel="전체 회차"><Icon name="layers" /></Pressable> : null}
```

재생 시간·탐색은 기존 화면과 같이 `timeUpdate`/`sourceLoad`/`playingChange` 이벤트와 Slider를 연결하고, 영상 오류에는 재생 실패 화면을 보여준다. 화면에 표시하는 작품명은 `dramaTitle`을 우선 사용하고 회차 제목만 있는 경우에는 응답의 `title`을 사용한다.
