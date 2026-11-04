# task-3-catalog-screen-tests

## 기본 입력

- 이 task 문서와 index.json의 task-3 항목.
- 컨텍스트로 전달된 루트·front 적용 지침과 필요한 선행 task 완료 요약. 다른 작업자가 함께 작업하므로 다른 task의 변경을 되돌리지 않는다.

## 읽어야 할 파일

- 담당 기존 dramaDetailScreen/searchScreen/libraryScreen/pointsScreen.test.ts의 테스트 이름·fixture·현재 기대값. 이전용 가짜 hook 구현은 재사용하지 않는다.
- front/src/screens/DramaDetailScreen.tsx, SearchScreen.tsx, LibraryScreen.tsx, PointsScreen.tsx의 export props·표시 문구·접근성 입력·API 및 포커스 사용 구간.
- front/src/features/drama/dramaResponses.ts, playback/playbackResponses.ts, economy/economyResponses.ts의 fixture에 필요한 공개 타입.
- front/src/features/user/UserProvider.tsx의 useUser 반환 타입/세션 입력, front/src/components/ui.tsx의 Button/EmptyState 실제 표시 및 접근성 계약.
- task-1의 Jest/setup/영상 helper 계약. expo-router/testing-library의 renderRouter/testRouter 사용 API는 설치된 RNTL 13 호환 버전 기준으로 확인한다.

## 필요 시 참고할 문서

- 전달된 적용 지침이 누락되었거나 변경되었을 때만 AGENTS.md와 front/AGENTS.md의 테스트·셸 규칙을 확인한다.
- 테스트 지원 코드와 제품 코드의 책임 경계가 불명확할 때만 _docs/ARCHITECTURE.md의 Frontend 및 Boundaries를 확인한다.
- 이 task 계약에 누락·충돌이 있을 때만 plan.md의 승인된 계약 및 기능별 검증 대응을 확인하고 보고한다. 전체 plan 재독을 요구하지 않는다.

## 실패 시 참고할 파일

- task-7이 전달한 실패에 한해 해당 화면의 상태 갱신·직접 사용 API·해당 fixture를 확인한다.

## 작업

4개 화면 테스트를 .test.tsx로 이전하고 실제 컴포넌트를 RNTL/메모리 Router에서 렌더링한다.

### 파일별 보존 계약

- dramaDetailScreen: 무료/구매/잠금 표시·경로 분기, 구매 완료된 회차만 로컬 갱신, 복원 대기·404·인라인 재시도, 계정 변경 후 권한 재조회·오래된 응답 무시.
- searchScreen: 세션 복원 대기, 만료 후 익명 데이터 재조회, 포커스 복귀/오류 재시도에서도 제목·장르 필터 유지, 구계정 늦은 응답 무시.
- libraryScreen: 저장/기록 탭별 요청과 본편·프리뷰 라우트, 카드 정보·이미지 크기/길이·없는 이미지, 첫 페이지 오류/빈 목록 구분, 동일 페이지 재시도·중복 요청/UUID 제거·끝 페이지, 계정/탭/blur/refocus 정리와 focus refresh에서 추가·삭제 반영.
- pointsScreen: 충전 탭이 내역을 요청하지 않음, history route/param 전환·복원·비로그인 안내, 거래별 라벨·부호·잔액·회차·서울 시각, empty/error/retry·동일 페이지·중복/끝, 계정/포커스/언마운트 뒤 늦은 응답 폐기·잔액 유지.

### 구현 지시

- 각 화면에 필요한 경로만 inline renderRouter fixture로 만든다. 이동 대상에 Text를 표시하는 최소 route 컴포넌트를 두고 testRouter/screen pathname으로 실제 경로 전환을 검증한다.
- 세션 상태는 useUser 경계의 Jest mock 반환값을 바꾸고 RNTL rerender로 전달한다. 테스트 대상 화면의 React 훅은 실제 실행한다. focus/blur는 메모리 라우터로 수행하고 가짜 useFocusEffect를 만들지 않는다.
- 실제 AppText/Button/EmptyState/Page를 렌더링한다. API는 jest.mock으로 pending Promise/resolve/reject 순서를 제어한다. late response는 await act로 완료시키고 현재 화면 결과가 덮이지 않는지 확인한다.
- 텍스트 입력·장르·재시도는 접근성 query와 userEvent 우선, 리스트 끝/레이아웃 이벤트는 fireEvent로 주입한다. 가짜 children 트리 탐색이나 화면 함수 직접 호출을 제거한다.

### 역할과 완료 조건

테스트 작성 역할이다. 제품 src와 다른 task의 파일은 수정하지 않는다. 기존 파일의 모든 최상위·하위 시나리오를 새 테스트에 대응시키고, 이름 또는 이름 변경 사유를 완료 요약에 기록한다. 테스트 환경 때문에 관찰 방식을 바꾸더라도 동작 계약·경계값·오류 조건을 약화하지 않는다. 원본을 지우기 전에 대응 검토를 마치고, 이전 .test.ts는 삭제하여 중복 실행을 막는다. 테스트 작성 완료는 기능 통과가 아니다. 실제 선택·전체 테스트는 task-7이 실행한다. 실패 분석으로 테스트 결함이 밝혀지면 해당 작성 task가 근거에 맞춰 범위 안에서 수정하고 task-7이 다시 검증한다. 공통 지원 코드 결함은 task-1 소유자에게 보고한다.

### 수정 허용 파일

- `front/tests/unit/dramaDetailScreen.test.ts`
- `front/tests/unit/dramaDetailScreen.test.tsx`
- `front/tests/unit/searchScreen.test.ts`
- `front/tests/unit/searchScreen.test.tsx`
- `front/tests/unit/libraryScreen.test.ts`
- `front/tests/unit/libraryScreen.test.tsx`
- `front/tests/unit/pointsScreen.test.ts`
- `front/tests/unit/pointsScreen.test.tsx`

### 의존성과 checks

- depends_on: task-1.
- checks: []. 독립적인 정적 TS 검사 명령이 없으므로 작성 단계에서 기능 테스트를 실행하지 않는다. 계약·시나리오 대응 관계 검토 결과를 완료 요약에 기록한다.

### 반복 작업 위임

불가. 각 실행 경계·생명주기·관찰 결과를 판단해야 하므로 독립적인 반복 치환 작업으로 보지 않는다. 하위 에이전트를 생성하지 않는다. task-2~6은 최대 5개 부모 worker로 병렬 실행한다. 공통 지원 파일은 읽기 전용이다.

### 주요 로직 코드 또는 변경 예시

검색에서 실제 React 렌더링·입력·결과를 확인하는 핵심 예시다. fixture를 fixture 타입에 맞춰 확장하고 나머지 기존 시나리오도 유지한다.

```tsx
import { renderRouter, screen } from 'expo-router/testing-library';
import { userEvent } from '@testing-library/react-native';
import { SearchScreen } from '@/screens/SearchScreen';
import { getDramaList } from '@/features/drama/dramaContent';
import { useUser } from '@/features/user/UserProvider';

jest.mock('@/features/drama/dramaContent', () => ({ getDramaList: jest.fn() }));
jest.mock('@/features/user/UserProvider', () => ({ useUser: jest.fn() }));

const session: ReturnType<typeof useUser> = {
  user: null,
  points: null, accessToken: null, isRestoring: false,
  restoreError: null, sessionExpired: false, sessionVersion: 1,
  subtitlesEnabled: true, autoplayNext: false,
  setUser: jest.fn(), setPoints: jest.fn(), login: jest.fn(), logout: jest.fn(),
  dismissSessionExpired: jest.fn(), isCurrentSession: (version) => version === 1,
  setSubtitlesEnabled: jest.fn(), setAutoplayNext: jest.fn(),
};


test('search filters results through the real input', async () => {
  jest.mocked(getDramaList).mockResolvedValue([
    {
      uuid: 'drama-1', title: '봄날', slug: 'spring',
      shortDescription: '', productionCompany: null, genres: [],
      imageUrls: { poster: null, posterLandscape: null, homeHero: null, detailCover: null, campaigns: [] },
      previewVideos: [], episodeCount: 1, freeEpisodeCount: 1,
    },
  ]);
  jest.mocked(useUser).mockReturnValue(session);
  renderRouter({ index: SearchScreen });
  expect(await screen.findByRole('button', { name: '봄날 작품 소개' })).toBeOnTheScreen();
  const user = userEvent.setup();
  await user.type(screen.getByLabelText('작품 제목이나 장르 검색'), '없는 제목');
  expect(screen.queryByRole('button', { name: '봄날 작품 소개' })).not.toBeOnTheScreen();
  expect(screen.getByText('아직 찾는 이야기가 없어요')).toBeOnTheScreen();
});
```

위 session처럼 각 파일의 useUser 입력은 실제 반환 타입으로 선언하고 시나리오별 필드를 바꾼다. DramaSummary는 episodeCount, HomeCollectionDrama는 publishedEpisodeCount를 사용하므로 기존 비타입 VM fixture의 필드 혼용을 옮기지 않는다. any 캐스팅으로 누락 필드를 숨기지 않는다.

