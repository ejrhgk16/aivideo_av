# task-3-frontend-tests

## 기본 입력

- 이 문서와 index.json task-3 항목, 전달된 적용 지침.
- depends_on: []. task-1과 독립 작성 가능하다. 아래 C3/C4는 승인된 미래 인터페이스다.
- 다른 작업자와 저장소를 공유하므로 자신의 files 외 파일을 수정하거나 타인의 변경을 되돌리지 않는다.

## 읽어야 할 파일

- front/tests/unit/dramaContent.test.ts: session singleton 격리·configureApiClient·목록/상세 HTTP assertions.
- front/tests/unit/searchScreen.test.tsx: renderSearch/deferred/session/focus/필터 시나리오.
- front/tests/unit/savedVideoScreens.test.tsx: dramaContent mock·beforeEach의 getDramaList 기본 응답과 기존 홈 프리뷰 회귀.
- front/src/features/drama/dramaContent.ts, dramaResponses.ts의 현재 export와 아래 승인된 미래 타입.
- front/src/screens/HomeScreen.tsx의 catalog 요청/최신/장르/히어로, SearchScreen.tsx의 복원·포커스·검색·장르·결과 표시.
- front/src/features/home/homeContent.ts, homeResponses.ts: 홈 컬렉션 API 경계·fixture shape.
- front/src/features/user/UserProvider.tsx의 useUser export와 front/src/features/user/sessionClient.ts의 configureSessionClient/apiRequest 계약.
- front/tests/setup.ts, front/jest.config.cjs, front/package.json·lockfile의 실제 도구 버전과 front/README.md의 검증.
- .agents/skills/react-native-testing/SKILL.md, references/api-reference-v13.md, references/expo.md, .agents/skills/javascript-typescript-jest/SKILL.md. 이미 전달된 지침은 재독하지 않는다.

## 필요 시 참고할 문서

- 루트 AGENTS.md가 누락되거나 변경된 경우에만 원문을 확인한다.
- 파일 책임·전역 상태 경계 변경이 필요하다고 판단한 경우에만 _docs/ARCHITECTURE.md의 Frontend/Boundaries 및 front/README.md의 전역 상태를 확인한다. 이 계획은 화면 로컬 상태를 유지한다.
- 계약이 누락·충돌한 경우에만 같은 폴더 plan.md의 해당 C1~C6 절을 확인한다. 전체 plan 재독을 요구하지 않는다.
- 역할/상태 규칙이 누락된 경우에만 _docs/plans/README.md의 관련 절을 확인한다.

## 실패 시 참고할 파일

- 작성 단계는 행동 검사를 실행하지 않는다. task-4가 결함을 보고한 경우 실패한 테스트·공용 setup·해당 계약만 대조한다.
- 실패 분석에서 영상 경계가 필요할 때만 front/tests/support/video.ts를 읽는다. 이 task는 기존 저장/프리뷰 시나리오를 새로 설계하지 않는다.

## 작업

### 역할과 완료 조건

미구현 기능 테스트 작성 역할이다. 아래 네 파일만 수정하며 제품 구현을 하지 않는다. 특히 기존 프론트 테스트도 반드시 새 응답·장르 호출에 맞춰 수정한다. 단순 mock shape 적응에 그치지 않고 실제 화면 동작을 검증한다.

적절한 독립 정적 검사 없이 미래 타입을 import하므로 checks=[]다. 모든 imports·공개 타입 fixture·mock targets·300ms 및 deferred 이벤트 순서를 계약/설치 export와 대조하고 완료 요약을 task-4에 전달한다. 작성 완료는 기능 통과가 아니며 동작 실행은 task-4가 맡는다.

### 수정 허용 파일

```text
front/tests/unit/dramaContent.test.ts
front/tests/unit/searchScreen.test.tsx
front/tests/unit/homeScreen.test.tsx
front/tests/unit/savedVideoScreens.test.tsx
```

### Checks

checks: []. 미구현 API·화면 계약에 대한 imports/mock/fixture/시나리오를 정적으로 검토한다. 제품 구현 전 동작 실행·전체 typecheck·예상 실패 실행은 하지 않는다.

### 적용 계약

C3 정의 책임은 task-4다. 기존 DramaContent/DramaSummary와 getDramaContent를 유지한다.

```ts
// front/src/features/drama/dramaResponses.ts: named exports
export type DramaListParams = { page?: number; q?: string; genre?: string };
export type DramaListPage = { items: DramaSummary[]; page: number; hasNext: boolean };
export type GenreSummary = {
  id: number;
  code: string;
  name: string;
  tileImage: string | null;
};
// front/src/features/drama/dramaContent.ts: named exports 및 타입 재export
export function getDramaList(params?: DramaListParams): Promise<DramaListPage>;
export function getGenres(): Promise<GenreSummary[]>;
```

- getDramaList() 기본 URL은 /dramas?sort=latest&page=1, 선택 JWT다. q/genre trim 후 빈 값 제외, sort/page/q/genre 순서로 encoding한다.
- getDramaList({page:2,q:' 봄 ',genre:'ROMANCE'}) -> /dramas?sort=latest&page=2&q=%EB%B4%84&genre=ROMANCE.
- getGenres()는 /genres/auth:'public', 기존 { id, code, name, tileImage } 전체 배열을 받는다. tileImage는 저장소 키이며 직접 URL로 붙이지 않는다.
- C1에서 서버 필터 후 페이지를 적용한다. 프론트는 서버 items를 다시 로컬 조건으로 거르지 않는다.

C4의 관찰 계약:
- 화면별 목록 상태, focus/세션/조건 generation, 복원 중 요청 없음, 세션/blur/unmount 후 늦은 응답 무시.
- Home 포커스는 네 컬렉션+getDramaList({page:1})+getGenres()를 독립 시작한다. 추천 탭에서도 목록 prefetch 유지. 최신 더 보기로 다음 페이지를 추가한다. 장르 API 실패가 최신 목록 성공을 지우지 않는다.
- 장르 목록은 GET /genres 전체 결과를 사용한다. 타일의 대표 이미지는 현재 불러온 작품 중 같은 장르 코드의 기존 posterLandscape 또는 poster URL을 재사용하고, 없으면 기존 placeholder를 표시한다. 이미지 유무로 장르를 제외하지 않는다. 현재 작품 페이지에 없는 장르도 표시하고 클릭하면 /search?genre=code.
- Search 포커스는 getGenres 성공 후 현재 조건으로 첫 목록을 요청한다. route genre는 code/name을 code로 정규화하고 미지정/unknown은 전체다.
- 입력 label '작품 제목이나 장르 검색', 300ms debounce. 입력 조건 변경 즉시 이전 목록/응답 무효화, 장르 선택은 현재 입력값으로 즉시 page1 재조회하고 이전 debounce 취소. trim 값이 동일하면 불필요한 요청 없음.
- 재포커스/재시도 시 입력과 장르 유지. 첫 페이지 교체, 추가 페이지 UUID 중복 제거, hasNext=false면 더 보기 숨김, 실패 시 같은 페이지 재시도.
- 최초 실패는 기존 '작품을 불러오지 못했어요'/다시 시도, 장르 실패는 '장르를 불러오지 못했어요'/다시 시도, 추가 실패는 기존 목록을 유지하고 추가 영역 다시 시도.
- 추가 버튼은 role button/name '더 보기', 추가 로딩은 '더 불러오는 중이에요'. Search 성공 개수는 '불러온 작품 N개'.
- '모든 작품 보기'는 입력·장르 초기화 후 page1 조회다. 기존 loading/empty 문구와 상세/프리뷰 이동을 유지한다.

C6:
- 실제 Jest29.7.0/jest-expo57.0.6/RNTL13.3.3/Router57.0.20/React19.2.3다.
- renderRouter/testRouter와 Stack, 실제 화면·공용 UI·React를 사용한다.
- 화면 경계 mock은 @/features/drama/dramaContent(getDramaList/getGenres 및 기존 getDramaContent), @/features/home/homeContent(getHomeCollection), @/features/user/UserProvider(useUser)다.
- API 테스트는 현재 configureSessionClient와 fetch 경계를 사용해 URL·인증·오류를 확인한다. 새 제품 test-only props/exports를 만들지 않는다.

### 파일별 작업과 핵심 시나리오

1. dramaContent.test.ts: 배열 fixture/기대 URL을 page object/명시 page로 변경한다. page2, 한글·공백·literal 특수문자 encoding, q/genre 생략, optional auth, HTTP 오류를 검사한다. getGenres의 public URL/응답/오류도 추가하고 상세의 기존 검사와 모듈/환경 격리를 유지한다.
2. searchScreen.test.tsx: getGenres mock과 공개 타입의 GenreSummary/DramaListPage fixture를 사용한다. 기본 장르 준비 -> page1, 추가/실패/재시도, 조건별 page1, 300ms, 장르 즉시 적용, 첫 페이지에 없던 검색 결과, loaded count, route code/name, 독립 장르 오류, 복원/계정 변경/blur 늦은 응답을 검사한다.
3. homeScreen.test.tsx(신규): 최신 page1/page2/hasNext=false, 중복 UUID/요청 방지, 최초·추가 실패 복구, 복원·세션·focus 경합, 최신 페이지와 무관한 장르 타일 및 code 이동/기존 포스터 재사용/placeholder, 장르 실패의 독립 복구를 검사한다. 컬렉션은 실제 HomeCollection shape로 mock한다.
4. savedVideoScreens.test.tsx: 기존 getDramaList mock을 {items:[],page:1,hasNext:false}로 적응하고 getGenres mock을 추가한다. mockReset/beforeEach를 함께 수정하고 홈 히어로 프리뷰·기존 저장 회귀를 보존한다.
5. deferred는 초기/추가/이전 조건/이전 계정 요청을 구별한다. 먼저 시작한 오래된 응답을 나중에 완료해도 최신 화면에 들어오지 않아야 한다. 모든 테스트는 진행 중인 Promise·fake timer를 정리한다.

### 주요 로직 코드 또는 변경 예시

mock의 공개 타입·함수 이름을 아래처럼 맞춘다. 기존 getDramaContent가 필요한 파일은 함께 유지한다.

```tsx
jest.mock('@/features/drama/dramaContent', () => ({
  getDramaList: jest.fn(),
  getGenres: jest.fn(),
}));
const emptyPage: DramaListPage = { items: [], page: 1, hasNext: false };
jest.mocked(getDramaList).mockResolvedValue(emptyPage);
jest.mocked(getGenres).mockResolvedValue([
  { id: 1, code: 'ROMANCE', name: '로맨스',
    tileImage: 'genres/romance/images/tile.webp' },
]);
```

300ms를 검사하는 핵심 이벤트 순서다. 초기 장르와 page1을 완료한 실제 SearchScreen이 렌더링된 상태에서 수행한다. 외부 timer 업데이트만 act로 감싼다.

```tsx
jest.useFakeTimers();
const user = userEvent.setup();
const before = jest.mocked(getDramaList).mock.calls.length;
await user.type(screen.getByLabelText('작품 제목이나 장르 검색'), '봄');
await act(async () => { jest.advanceTimersByTime(299); });
expect(getDramaList).toHaveBeenCalledTimes(before);
await act(async () => { jest.advanceTimersByTime(1); });
expect(getDramaList).toHaveBeenLastCalledWith(expect.objectContaining({ page: 1, q: '봄' }));
```

공백/미지정 옵션의 의미가 같은 객체는 key 존재 자체를 계약으로 강제하지 않는다. q/genre의 실제 값과 HTTP URL을 검사한다. 더 보기의 실제 동작 예시는 아래와 같다.

```tsx
const user = userEvent.setup();
await user.press(await screen.findByRole('button', { name: '더 보기' }));
await waitFor(() => expect(getDramaList).toHaveBeenLastCalledWith(expect.objectContaining({ page: 2 })));
await act(async () => {
  nextPage.resolve({ items: [secondDrama], page: 2, hasNext: false });
  await nextPage.promise;
});
expect(await screen.findByRole('button', { name: secondDrama.title + ' 작품 소개' }))
  .toBeOnTheScreen();
expect(screen.queryByRole('button', { name: '더 보기' })).not.toBeOnTheScreen();
```

nextPage/secondDrama는 각 테스트 안의 local deferred/실제 DramaSummary fixture다. helper나 props의 새 제품 export를 가정하지 않는다. error/retry/late response를 snapshot이나 내부 state assertions로 대체하지 않는다.

### 반복 작업 위임

불가. 각 화면의 focus·세션·검색·pagination 계약이 달라 독립 파일 반복으로 위임할 수 없다. child 슬롯0이다. task-1 또는 task-2와 병렬 작성 가능하며 task-4는 이 task 완료 후 실행한다.

