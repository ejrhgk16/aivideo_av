# task-4-preview-screen

## 읽어야 할 파일

- AGENTS.md
- front/AGENTS.md
- _docs/ARCHITECTURE.md
- front/src/screens/DramaDetailScreen.tsx
- front/src/screens/RecommendationScreen.tsx
- front/src/screens/ImmersiveEpisodePlaybackScreen.tsx
- front/src/app/_layout.tsx
- front/src/app/episode/[id].tsx
- front/src/features/playback/previewPlayback.ts
- front/src/features/drama/dramaContent.ts

## 작업

목표: 상세 화면의 분위기 미리보기 버튼에서 첫 프리뷰를 RecommendationScreen의 카드 UI를 적용한 새 화면에서 재생하고, 재생 화면의 파일명을 역할별로 정리한다.

정확한 변경 파일:

- front/src/screens/DramaDetailScreen.tsx
- front/src/screens/ImmersiveEpisodePlaybackScreen.tsx (이름 변경 전 경로)
- front/src/screens/playbackScreen_episode.tsx (이름 변경 후 경로)
- front/src/screens/playbackScreen_preview.tsx
- front/src/app/_layout.tsx
- front/src/app/episode/[id].tsx
- front/src/app/preview/[dramaId]/[videoId].tsx

DramaDetailScreen은 정렬된 previewVideos의 첫 UUID를 /preview/[dramaId]/[videoId] 경로로 전달한다. 프리뷰가 없으면 버튼을 비활성화한다. 새 playbackScreen_preview.tsx는 getPreviewPlayback으로 URL을, getDramaContent로 작품 정보를 가져온다. 상세 진입 작품이 추천 컬렉션에 없을 수도 있으므로 getHomeCollection에 의존하지 않는다. RecommendationScreen의 화면 높이를 채우는 카드 배치를 기준으로 VideoView를 포스터 배경 위치에 놓고 자동 재생한다. 첫 영상 프레임이 나올 때까지 작품 포스터를 보여준다. 그라디언트, 상단 정보·닫기, 중앙 재생/일시정지, 우측 저장·회차·공유, 하단 작품 정보·본편 이동 버튼을 실제 동작에 연결한다. 영상 연결 전이라는 임시 문구는 사용하지 않는다. 네이티브 영상 컨트롤 대신 카드 위 컨트롤을 사용한다. 로딩·API 오류·영상 오류 상태를 표시하고 화면을 벗어나면 재생을 멈춘다. 프리뷰 경로를 Expo Router에 추가하고 front/src/app/_layout.tsx의 Stack에 등록한다. 실제 회차 화면 파일은 ImmersiveEpisodePlaybackScreen.tsx에서 playbackScreen_episode.tsx로 이름을 바꾸고 기존 회차 경로의 import를 수정한다. 선택한 작품 한 편을 재생하며 추천 탭의 기존 FlatList 피드는 변경하지 않는다.

검증 명령: npm --prefix front run typecheck, npm --prefix front run test, npm --prefix front run export

완료 조건: 프리뷰가 있는 작품에서 버튼이 첫 프리뷰 영상을 열고 RecommendationScreen 카드 배치 안에 실제 영상이 재생된다. 첫 프레임 전에는 포스터가 보이고, 중앙 버튼은 재생·일시정지를 전환하며, 우측·하단 동작은 기존 추천 카드와 같은 목적지로 연결된다. 프리뷰가 없으면 버튼이 비활성화된다. 회차 재생 경로는 이름 변경 후에도 연결되며 프론트 검증 명령이 통과한다.

### 주요 로직 코드 또는 변경 예시

상세 화면의 선택과 경로 전달:

~~~tsx
const firstPreview = drama.previewVideos[0];
const openPreview = () => {
  if (!firstPreview) return;
  router.push({
    pathname: '/preview/[dramaId]/[videoId]',
    params: { dramaId: drama.uuid, videoId: firstPreview.uuid },
  });
};

<Pressable disabled={!firstPreview} onPress={openPreview} accessibilityRole="button">
  <AppText>분위기 미리보기</AppText>
</Pressable>
~~~

새 경로와 화면은 전달받은 두 UUID로 재생 정보를 조회하고, URL을 받은 뒤 별도 컴포넌트에서 플레이어를 만든다:

~~~tsx
type PreviewState =
  | { kind: 'loading' }
  | { kind: 'ready'; drama: DramaContent; playback: PreviewPlayback }
  | { kind: 'error' };

export function PlaybackScreenPreview({ dramaId, videoId }: { dramaId: string; videoId: string }) {
  const router = useRouter();
  const [state, setState] = useState<PreviewState>({ kind: 'loading' });
  const back = () => router.canGoBack() ? router.back() : router.replace('/');

  useEffect(() => {
    let active = true;
    setState({ kind: 'loading' });
    Promise.all([getDramaContent(dramaId), getPreviewPlayback(dramaId, videoId)]).then(
      ([drama, playback]) => { if (active) setState({ kind: 'ready', drama, playback }); },
      () => { if (active) setState({ kind: 'error' }); },
    );
    return () => { active = false; };
  }, [dramaId, videoId]);

  if (state.kind === 'loading') {
    return <Page><EmptyState title="영상을 불러오는 중이에요" /></Page>;
  }
  if (state.kind === 'error') {
    return <Page><EmptyState title="영상을 재생할 수 없어요" action="뒤로 가기" onAction={back} /></Page>;
  }
  return <PreviewVideo drama={state.drama} url={state.playback.url} onClose={back} />;
}

function PreviewVideo({ drama, url, onClose }: { drama: DramaContent; url: string; onClose: () => void }) {
  const router = useRouter();
  const player = useVideoPlayer(url, (videoPlayer) => videoPlayer.play());
  const [isPlaying, setIsPlaying] = useState(player.playing);
  const [saved, setSaved] = useState(false);
  const [videoFailed, setVideoFailed] = useState(false);
  const [firstFrameReady, setFirstFrameReady] = useState(false);
  const posterUrl = resolveApiImageUrl(drama.imageUrls.poster);
  useFocusEffect(useCallback(() => () => player.pause(), [player]));
  useEffect(() => {
    const playing = player.addListener('playingChange', ({ isPlaying: next }) => setIsPlaying(next));
    const status = player.addListener('statusChange', ({ status: next }) => {
      if (next === 'error') setVideoFailed(true);
    });
    return () => { playing.remove(); status.remove(); };
  }, [player]);

  const openEpisodes = () => {
    player.pause();
    router.push({ pathname: '/drama/[id]', params: { id: drama.uuid, tab: 'episodes' } });
  };
  const togglePlayback = () => { if (isPlaying) player.pause(); else player.play(); };
  const shareDrama = () => {
    void Share.share({ title: drama.title, message: [drama.title, drama.shortDescription].filter(Boolean).join('\n') });
  };
  const freeCount = drama.episodes.filter((episode) => episode.pricePoints === 0).length;
  const genres = drama.genres.map((genre) => genre.name).join(' · ');

  if (videoFailed) {
    return <Page><EmptyState title="영상을 재생할 수 없어요" action="뒤로 가기" onAction={onClose} /></Page>;
  }
  return <Page scroll={false} contentStyle={styles.pageContent}>
    <View style={styles.card}>
      <StatusBar hidden />
      <VideoView player={player} nativeControls={false} contentFit="cover" style={StyleSheet.absoluteFill} onFirstFrameRender={() => setFirstFrameReady(true)} />
      {!firstFrameReady && posterUrl ? <Image source={{ uri: posterUrl }} contentFit="cover" style={StyleSheet.absoluteFill} /> : null}
      <LinearGradient pointerEvents="none" colors={['#03060BAA', 'transparent', '#070C13A8', '#070C13']} style={StyleSheet.absoluteFill} />
      <View style={styles.topBar}>
        <Pressable onPress={onClose} accessibilityRole="button" accessibilityLabel="닫기"><Icon name="x" /></Pressable>
        <AppText>작품 미리보기</AppText>
      </View>
      <Pressable style={styles.playMark} onPress={togglePlayback} accessibilityRole="button" accessibilityLabel={isPlaying ? '일시정지' : '재생'}>
        <Icon name={isPlaying ? 'pause' : 'play'} />
      </Pressable>
      <View style={styles.sideActions}>
        <Pressable onPress={() => setSaved((value) => !value)} accessibilityRole="button" accessibilityLabel={saved ? '저장 해제' : '저장'}><Icon name="bookmark" /></Pressable>
        <Pressable onPress={openEpisodes} accessibilityRole="button" accessibilityLabel="회차 목록"><Icon name="layers" /></Pressable>
        <Pressable onPress={shareDrama} accessibilityRole="button" accessibilityLabel="공유"><Icon name="share-2" /></Pressable>
      </View>
      <View style={styles.bottomInfo}>
        <AppText>{freeCount}화 무료 · {genres}</AppText>
        <AppText>{drama.title}</AppText>
        <AppText>{drama.shortDescription}</AppText>
        <Pressable onPress={openEpisodes} accessibilityRole="button"><AppText>1화부터 본편 보기</AppText></Pressable>
      </View>
    </View>
  </Page>;
}

export default function PreviewRoute() {
  const { dramaId, videoId } = useLocalSearchParams<{ dramaId: string; videoId: string }>();
  return <PlaybackScreenPreview dramaId={dramaId} videoId={videoId} />;
}
~~~

PreviewRoute는 front/src/app/preview/[dramaId]/[videoId].tsx에 두고, AppNavigation의 Stack에 동일한 경로 이름을 추가한다. 위 예시는 호출 지점을 한 블록으로 보여주며 실제 구현에서는 화면과 경로 파일로 나눈다. styles.pageContent, card, topBar, playMark, sideActions, bottomInfo는 RecommendationScreen의 배치와 크기를 기준으로 작성하고 card는 화면 높이를 채운다.
