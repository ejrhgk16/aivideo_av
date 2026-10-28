# task-2-front-playback-user-uuid

## 읽어야 할 파일

- `AGENTS.md`
- `front/AGENTS.md`
- `_docs/ARCHITECTURE.md`
- `.agents/skills/vercel-react-native-skills/SKILL.md`
- `front/src/features/user/UserProvider.tsx`
- `front/src/screens/playbackScreen_episode.tsx`
- `front/src/features/playback/episodePlayback.ts`
- `front/tests/unit/episodePlayback.test.ts`
- `_docs/api/04-playback/episodes.md`

프론트 코드 작성 전 `front/AGENTS.md`의 지침대로 Expo 57 공식 문서 `https://docs.expo.dev/versions/v57.0.0/`를 읽는다.

## 작업

### 파일 범위와 의존성

소유 파일은 아래 3개다. 다른 작업자도 같은 코드베이스에서 작업하므로 다른 사람의 변경을 되돌리지 않고 현재 상태에 맞춘다.

- `front/src/screens/playbackScreen_episode.tsx`
- `front/src/features/playback/episodePlayback.ts`
- `front/tests/unit/episodePlayback.test.ts`

`depends_on: ["task-1"]`. 백엔드 선택 사용자 query 및 권한 검사 계약이 완료된 뒤 프론트 요청을 연결한다. UserProvider 자체나 프리뷰·구매·회차 이동 로직은 변경하지 않는다. 프리뷰는 기존처럼 사용자 없이 요청·재생된다.

### 구현

- `PlaybackScreenEpisode`에서 `useUser`를 호출해 현재 사용자 UUID를 읽는다. route 파라미터나 하드코딩한 사용자 값으로 대체하지 않는다.
- `getEpisodePlayback`의 두 번째 인자를 선택 `userUuid?: string`으로 추가한다. 화면에서 받은 UUID가 있으면 `encodeURIComponent`로 인코딩해 `?userUuid=` query로 전달한다. feature 함수 안에서 React hook을 호출하지 않는다.
- 사용자 UUID가 없어도 query를 생략한 HTTP 요청을 수행한다. 익명 무료 회차는 정상 재생하고 유료 회차403은 기존 오류 처리로 표시한다. 새로운 로그인 이동·화면·오류 상태를 추가하지 않는다.
- effect의 의존성에 `userUuid`를 포함한다. 사용자 변경·로그아웃 시 이전 effect를 취소하고 기존 playback을 비워 이전 사용자의 늦은 응답이 적용되지 않게 한다. 기존 `active` 취소 처리를 유지한다.
- 서명 URL 응답 정규화·기존 HTTP 오류 처리·영상 컨트롤은 유지한다. 커스텀403 전용 UI는 범위 밖이다.

### 주요 로직 코드 또는 변경 예시

화면에 `import { useUser } from '@/features/user/UserProvider';`를 추가하고 기존 effect를 아래 흐름으로 갱신한다.

```tsx
const { user } = useUser();
const userUuid = user?.uuid;

useEffect(() => {
  let active = true;
  setPlayback(null);
  setLoadState('loading');
  getEpisodePlayback(id, userUuid).then((result) => {
    if (!active) return;
    setPlayback(result);
    setLoadState('loaded');
  }).catch((error: unknown) => {
    if (!active) return;
    const message = error instanceof Error ? error.message : '';
    setLoadState(/:\s*404\b/.test(message) ? 'not-found' : 'error');
  });
  return () => { active = false; };
}, [id, userUuid]);
```

feature의 함수 서명과 fetch 호출을 다음으로 변경한다. 함수의 나머지 기존 환경 확인·응답 처리 코드는 유지한다.

```ts
export async function getEpisodePlayback(
  episodeId: string,
  userUuid?: string,
): Promise<EpisodePlayback> {
```

```ts
const query = userUuid ? `?userUuid=${encodeURIComponent(userUuid)}` : '';
const path = `episodes/${encodeURIComponent(episodeId)}/playback${query}`;
const response = await fetch(joinApiUrl(baseUrl, path));
```

### 테스트와 완료 조건

- 기존 `episodePlayback.test.ts`에 사용자 인자 전달·생략 사례를 모두 유지한다. 생략 시에도 fetch를 호출하고 URL에 `userUuid=undefined`나 빈 query가 없는지 검증한다.
- 기존 URL 검사에 사용자 query를 포함한다. 예: `getEpisodePlayback('episode/1', 'user/1')` 요청 URL은 `http://localhost:3000/api/episodes/episode%2F1/playback?userUuid=user%2F1`이다. 여기의 특수문자는 URL 인코딩 검증용 입력이며 실제 HTTP API에는 유효 UUID를 사용한다.
- 서로 다른 사용자 UUID를 전달했을 때 각 요청 URL이 해당 값을 반영함을 기존 fetch mock으로 검증한다. 상대·절대 영상 URL 처리와 HTTP 오류 검증은 유지한다.
- typecheck로 제품 호출부의 타입을 확인하고, 화면 effect가 `[id, userUuid]`를 사용하며 사용자 부재 시에도 요청하는지 코드 검토한다.
- 완료 조건: UserProvider → 화면 → feature → 선택 `userUuid` query 연결, 사용자 변경·로그아웃 시 취소·재조회, 사용자 부재 시 query 없이 요청, 아래 검증 전부 통과.

```text
npm --prefix front run typecheck
npm --prefix front run test
npm --prefix front run export
```

이 검증은 서버 자동 실행을 필요로 하지 않는다. 추가로 실행 화면을 검증하는 경우 기존 `http://localhost:8081`과 `http://localhost:3000`만 사용한다. 필요한 서버가 없으면 검증 실패로 보고하고 프론트 `npm --prefix front run start -- --port 8081`, 백엔드 `npm --prefix back run start:dev` 실행을 안내한다. 자동 시작하거나 다른 포트를 사용하지 않는다.
