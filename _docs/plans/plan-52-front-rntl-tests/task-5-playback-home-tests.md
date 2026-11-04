# task-5-playback-home-tests

## 기본 입력

- 이 task 문서와 index.json의 task-5 항목.
- 컨텍스트로 전달된 루트·front 적용 지침 및 선행 task 완료 요약. 다른 작업자가 함께 작업하므로 다른 task의 변경을 되돌리지 않는다.

## 읽어야 할 파일

- front/tests/unit/playbackScreenEpisode.test.ts와 savedVideoScreens.test.ts의 시나리오·응답 fixture·기존 player 이벤트 입력.
- front/src/screens/playbackScreen_episode.tsx와 playbackScreen_preview.tsx의 export props·재생/저장/시청기록 effect·focus/seek 처리·접근성 이름.
- front/src/screens/HomeScreen.tsx의 HOME_FEATURED 및 현재 hero 변경·미리보기 이동.
- front/src/features/playback/playbackResponses.ts 및 drama/dramaResponses.ts, home/homeResponses.ts의 fixture 타입.
- front/src/features/playback/watchProgress.ts의 실제 tracker, savedVideos.ts의 저장/해제 요청 계약과 UserProvider.tsx의 세션 입력 계약.
- task-1의 front/tests/support/video.ts 공개 API, tests/setup.ts native mock/정리 계약. 함수 내부 전체를 다시 읽지 않는다.

## 필요 시 참고할 문서

- 전달된 적용 지침이 누락되었거나 변경되었을 때만 AGENTS.md와 front/AGENTS.md의 테스트·셸 규칙을 확인한다.
- 테스트/제품 책임 경계 판단이 필요할 때만 _docs/ARCHITECTURE.md의 Frontend와 Boundaries를 확인한다.
- 이 문서의 승인 계약이 누락되거나 충돌할 때만 plan.md의 승인된 계약 및 기능별 검증 대응을 확인한다. 전체 plan 재독은 필요하지 않다.

## 실패 시 참고할 파일

- task-7에서 재생/저장 assertion이 실패하면 해당 이벤트를 소비하는 화면 effect 및 해당 테스트 fixture만 확인한다. 공유 player API 결함은 task-1 소유자에게 전달한다.

## 작업

본편·미리보기·홈의 화면 함수를 실제 RNTL/Router로 렌더링하고 기존 저장·시청기록·이동 계약을 유지한다.

### 파일별 보존 계약

- playbackScreenEpisode: 복원 대기·익명 유료 로그인·권한 거부/없는 영상/네트워크 재시도 구분. 실제로 진행한 본편에서 STARTED와 2/3 COMPLETED를 1회씩 전달. 영상 UUID와 서버 saved 값으로 저장·해제. 사용자가 멈춘 상태를 저장 후에도 유지. 중복 탭 잠금·오류 시 값 유지/재시도. focus 상세 응답은 pending/완료된 저장을 덮지 않고 episode/video UUID 모두 맞아야 적용. 익명 쓰기는 로그인 경로로 이동. 익명/대기/blur/만료 시 기록 없음.
- savedVideoScreens의 preview: route가 선택한 정확한 video UUID 저장, focus metadata 재조회에도 player/재생 위치 유지, 서버 duration과 실제 진행에만 STARTED/COMPLETED. 일시정지·seek·blur 이벤트의 기록 제외. 저장 중복 잠금·오류 유지·재시도. 복원 중 쓰기 금지, 익명 로그인, route/account 변경 뒤 늦은 write 무시.
- savedVideoScreens의 home: 로그인/익명 모두 현재 HOME_FEATURED hero의 첫 preview로 직접 이동하고 저장 API는 호출하지 않는다. preview 없는 hero는 비활성이다. hero 변경 후에는 새 preview를 사용하며 세션 복원 중에는 개인화 컬렉션을 요청하지 않는다.

### 구현 지시

- useUser의 실제 반환 타입에 맞는 fixture를 파일 안에 두고 API Promise만 제어한다. 실제 UI 컴포넌트/실제 화면 훅은 mock하지 않는다. 라우팅과 focus는 inline renderRouter fixture에서 수행한다.
- task-1의 mockVideoPlayers로 player identity·구독·playing·currentTime을 관찰한다. React 상태를 테스트 배열로 대신하지 않는다. native player 이벤트는 await act 안에서 emit한다.
- 시청기록은 실제 createWatchProgressTracker를 사용하고 saveWatchProgress 전송 함수만 부분 mock한다. timestamp·duration은 기존 입력을 유지하고 seek 경로는 Slider의 native 이벤트를 fireEvent로 보낸다. 시간을 건너뛴 단일 timeUpdate를 정상 연속 재생으로 처리하지 않는다.
- 저장 성공/실패와 focus read/write 경합은 deferred Promise로 재현한다. 버튼 disabled 결과와 호출 횟수, player.play가 재호출되지 않음을 함께 확인한다.
- 본편/미리보기 route fixture는 실제 props를 전달하고 이동 대상은 pathname과 params를 검증한다. 단순 push spy만으로 focus 전환을 흉내 내지 않는다.

### 역할과 완료 조건

테스트 작성 역할이다. 제품 src와 공통 실행기/setup/helper는 수정하지 않는다. 원본 최상위·하위 시나리오 전부를 이전 테스트와 대응시키고 완료 요약에 기존/새 이름과 관찰 방식 변경 사유를 적는다. 원본 .test.ts 삭제와 새 .test.tsx 작성을 모두 이 task가 담당한다. 가짜 렌더러에 묶인 내부 구조 관찰을 공개 결과·명시적인 native 경계 관찰로 바꾸되 의미·경계값·실패 조건을 약화하지 않는다. 작성 완료는 기능 통과가 아니다. 실제 선택·전체 검증은 task-7이 수행한다. 통합 시 결함이 보고되면 해당 작성 task의 파일 범위에서 수정한다. 공유 지원 API의 결함은 task-1 소유자에게 보고한다.


### 수정 허용 파일

- `front/tests/unit/playbackScreenEpisode.test.ts`
- `front/tests/unit/playbackScreenEpisode.test.tsx`
- `front/tests/unit/savedVideoScreens.test.ts`
- `front/tests/unit/savedVideoScreens.test.tsx`

### 의존성과 checks

- depends_on: task-1.

checks: []. 적절한 독립 정적 TS 검사 명령이 없으므로 테스트 실행 없이 계약·시나리오 검토 결과를 완료 요약에 기록한다. 전체 타입·동작 검증은 task-7에 배정한다.

### 반복 작업 위임

불가. 각 플랫폼 이벤트·비동기 경합·생명주기 판단이 필요하여 독립적인 반복 치환으로 볼 수 없다. task-2~6은 최대 5개 부모 worker로 병렬 실행하며 공통 설정/지원 파일은 읽기 전용이다. 하위 에이전트를 생성하지 않는다.

### 주요 로직 코드 또는 변경 예시

공통 native player 경계를 사용해 본편의 일시정지 유지 여부를 검증하는 핵심 흐름이다. 아래 fixture/세션 mock은 이 파일의 기존 응답 데이터와 실제 타입으로 선언한다.

```tsx
import { renderRouter, screen } from 'expo-router/testing-library';
import { userEvent } from '@testing-library/react-native';
import { PlaybackScreenEpisode } from '@/screens/playbackScreen_episode';
import { getEpisodePlayback } from '@/features/playback/episodePlayback';
import { saveVideo } from '@/features/playback/savedVideos';
import { mockVideoPlayers } from '../support/video';
import { useUser } from '@/features/user/UserProvider';

jest.mock('@/features/playback/episodePlayback', () => ({ getEpisodePlayback: jest.fn() }));
jest.mock('@/features/playback/savedVideos', () => ({ saveVideo: jest.fn(), removeSavedVideo: jest.fn() }));
jest.mock('@/features/user/UserProvider', () => ({ useUser: jest.fn() }));

const session: ReturnType<typeof useUser> = {
  user: { uuid: 'member-1', displayName: null, accountType: 'MEMBER' },
  points: 120, accessToken: 'access-test', isRestoring: false,
  restoreError: null, sessionExpired: false, sessionVersion: 1,
  subtitlesEnabled: true, autoplayNext: false,
  setUser: jest.fn(), setPoints: jest.fn(), login: jest.fn(), logout: jest.fn(),
  dismissSessionExpired: jest.fn(), isCurrentSession: (version) => version === 1,
  setSubtitlesEnabled: jest.fn(), setAutoplayNext: jest.fn(),
};


test('saving a paused episode keeps the same player paused', async () => {
  jest.mocked(useUser).mockReturnValue(session);
  jest.mocked(getEpisodePlayback).mockResolvedValue({
    url: 'https://example.test/full.mp4', videoUuid: 'video-1', isSaved: false,
    title: '본편', episodeNumber: 1, durationMs: 90000,
  });
  jest.mocked(saveVideo).mockResolvedValue(undefined);
  renderRouter({ index: () => <PlaybackScreenEpisode id="episode-1" /> });
  const user = userEvent.setup();
  await user.press(await screen.findByRole('button', { name: '일시정지' }));
  const player = mockVideoPlayers[0];
  const previousPlayCalls = player.play.mock.calls.length;
  expect(player.playing).toBe(false);
  await user.press(screen.getByRole('button', { name: '작품 저장' }));
  expect(await screen.findByRole('button', { name: '저장 해제' })).toBeOnTheScreen();
  expect(saveVideo).toHaveBeenCalledWith('video-1', 'EPISODE');
  expect(mockVideoPlayers[0]).toBe(player);
  expect(player.playing).toBe(false);
  expect(player.play).toHaveBeenCalledTimes(previousPlayCalls);
});
```

API 모듈은 파일 상단에서 Jest로 mock하고 useUser는 위처럼 실제 member 타입·isRestoring:false fixture를 제공한다. saveVideo는 videoUuid와 contentType 두 인자를 검증하고 기존 요청 검증도 보존한다. 이 예시로 나머지 오류/seek/진행/경합 시나리오를 대체하지 않는다.

