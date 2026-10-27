# task-1-drama-detail-purchased-episodes

## 읽어야 할 파일

- `AGENTS.md`
- `_docs/ARCHITECTURE.md`
- `front/AGENTS.md`
- `_docs/api/02-content/dramas.md`
- `front/src/features/drama/dramaContent.ts`
- `front/src/screens/DramaDetailScreen.tsx`
- `front/src/features/user/UserProvider.tsx`
- `front/src/components/EpisodeUnlockDialog.tsx`
- `front/tests/unit/dramaContent.test.ts`
- `front/tests/unit/episodeUnlockDialog.test.ts`
- `front/scripts/test-front.cjs`
- 구현 전에 `front/AGENTS.md`에 따라 https://docs.expo.dev/versions/v57.0.0/ 의 정확한 버전 문서를 확인한다.

## 작업

드라마 상세 목록의 무료·유료 구매·유료 미구매 표시와 클릭 동작을 분리한다.

### 정확한 수정 파일 범위

- `front/src/features/drama/dramaContent.ts`
- `front/src/screens/DramaDetailScreen.tsx`
- `front/tests/unit/dramaContent.test.ts`
- `front/tests/unit/dramaDetailScreen.test.ts` (신규)
- `front/scripts/test-front.cjs`

다른 작업자와 작업 내용을 공유하는 저장소이므로 타인의 변경을 되돌리지 않고 현재 코드에 맞춰 수정한다. `apply_patch`로만 파일을 수정한다. 공통 다이얼로그와 다른 화면은 읽기 참고 대상이다.

### 구현 지시

1. `DramaContent.episodes` 항목에 필수 `isUnlocked: boolean`을 추가한다. 기존 계약 테스트 fixture에도 필드를 반영한다.
2. `getDramaContent(dramaId, userUuid?)`의 두 번째 인자를 선택적으로 추가한다. 사용자 UUID가 있으면 URL 인코딩하여 `?userUuid=...`를 전달한다. 없으면 기존 URL을 유지한다. 다른 호출자는 수정하지 않는다.
3. 상세 화면에서 `useUser()`의 `user?.uuid`를 읽어 요청에 전달하고 effect 의존성을 `[id, userUuid]`로 변경한다. 기존 비동기 취소 처리와 로딩·오류 처리를 유지하여 이전 사용자의 늦은 응답을 무시한다. 사용자 변경 시 이전 구매 팝업 선택도 초기화한다.
4. 무료 판정은 `pricePoints === 0`으로 먼저 수행한다. 무료 표시는 유지한다. 유료 회차만 `isUnlocked`로 구매 여부를 판단한다. 구매한 유료 회차에는 하단 가격이나 대체 문구를 렌더링하지 않고 접근성 안내에서도 가격을 제거한다. 미구매 회차의 가격과 팝업은 유지한다.
5. 구매 성공 callback에서 해당 회차만 `isUnlocked: true`로 갱신한 다음 기존 재생 경로로 이동한다. 기존 다이얼로그의 닫힘·구매 완료 시점은 변경하지 않는다.
6. 기존 테스트 방식에 맞춰 API 회귀 테스트와 실제 상세 컴포넌트를 실행하는 화면 테스트를 작성한다. 컴포넌트 테스트는 `episodeUnlockDialog.test.ts`의 transpile/VM mock 방식을 참고하고 새로운 테스트 라이브러리는 추가하지 않는다. 신규 테스트를 `test-front.cjs`의 `testFiles`에 등록한다.

### 주요 로직 코드 또는 변경 예시

API 함수에서는 기존 환경 변수·HTTP 오류 처리를 유지하고 요청 부분을 다음처럼 변경한다.

```ts
export async function getDramaContent(dramaId: string, userUuid?: string): Promise<DramaContent> {
  const baseUrl = process.env.EXPO_PUBLIC_API_BASE_URL;
  if (!baseUrl) {
    throw new Error('EXPO_PUBLIC_API_BASE_URL must be set to fetch drama content.');
  }
  const query = userUuid ? `?userUuid=${encodeURIComponent(userUuid)}` : '';
  const response = await fetch(joinApiUrl(baseUrl, `dramas/${encodeURIComponent(dramaId)}${query}`));
  if (!response.ok) {
    throw new Error(`Failed to fetch drama '${dramaId}': ${response.status}`);
  }
  return (await response.json()) as DramaContent;
}
```

상세 화면의 effect와 클릭·구매 callback 및 목록 렌더링의 핵심 변경은 다음과 같다. 기존 effect 본문은 유지하면서 인자·의존성·팝업 초기화를 반영한다.

```tsx
const { user } = useUser();
const userUuid = user?.uuid;

useEffect(() => {
  let active = true;
  setDrama(null);
  setLockedEpisode(null);
  setImageFailed(false);
  setLoadState('loading');
  getDramaContent(id, userUuid).then((content) => {
    if (!active) return;
    setDrama(content);
    setLoadState('loaded');
  }).catch((error: unknown) => {
    if (!active) return;
    const message = error instanceof Error ? error.message : '';
    setLoadState(/:\s*404\b/.test(message) ? 'not-found' : 'error');
  });
  return () => { active = false; };
}, [id, userUuid]);

const openEpisode = (episode: DramaContent['episodes'][number]) => {
  if (episode.pricePoints > 0 && !episode.isUnlocked) {
    setLockedEpisode(episode);
    return;
  }
  router.push({ pathname: '/episode/[id]', params: { id: episode.uuid, dramaId: drama.uuid } });
};

const onPurchased = (episode: DramaContent['episodes'][number]) => {
  setDrama((current) => current === null ? null : {
    ...current,
    episodes: current.episodes.map((item) => item.uuid === episode.uuid
      ? { ...item, isUnlocked: true }
      : item),
  });
  router.push({ pathname: '/episode/[id]', params: { id: episode.uuid, dramaId: drama.uuid } });
};

// episodes.map 내부의 기존 Pressable에 적용할 props와 자식 요소
const accessibilityLabel = `${episode.episodeNumber}화${episode.pricePoints === 0
  ? ' 무료'
  : episode.isUnlocked ? '' : ` ${episode.pricePoints}포인트`}`;
const priceLabel = episode.pricePoints === 0
  ? <AppText style={styles.freeLabel}>무료</AppText>
  : episode.isUnlocked ? null
    : <AppText style={styles.priceLabel}>{episode.pricePoints}P</AppText>;
```

각 회차 Pressable에 위 `accessibilityLabel`을 연결하고 회차 번호 아래에 `priceLabel`을 렌더링한다. `EpisodeUnlockDialog`의 `onPurchased` prop에는 위 callback을 연결한다. 예시는 기존 화면 내부 위치에 맞춰 적용하고 불필요한 추상화는 추가하지 않는다.

### 검증 명령

- `npm --prefix front run typecheck`
- `npm --prefix front run test`
- `npm --prefix front run export`

### 완료 조건

- API 테스트가 비로그인 URL 유지, 로그인 UUID 전달·인코딩, `isUnlocked` 응답 유지와 기존 HTTP 오류 처리를 검증한다.
- 화면 테스트가 무료 회차의 무료 표시와 즉시 재생, 구매한 유료 회차의 가격 제거와 즉시 재생, 미구매 유료 회차의 가격 표시와 구매 팝업을 검증한다. 무료 fixture의 `isUnlocked: true`를 사용해 무료 표시가 사라지는 회귀를 방지한다.
- 구매한 유료 회차의 접근성 안내에도 가격이 없음을 검증한다.
- 로그인·사용자 전환·로그아웃 시 올바른 UUID로 다시 조회하고 이전 사용자 응답이 화면을 덮어쓰지 않는지 검증한다.
- 구매 성공 callback 이후 해당 회차의 가격이 사라지고 재클릭해도 다이얼로그 없이 재생으로 이동하는지 검증한다.
- 모든 검증 명령이 통과하고 변경 범위가 승인된 다섯 파일에 한정된다. 백엔드·다른 화면·공통 다이얼로그의 동작을 변경하지 않는다.
