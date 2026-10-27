# task-1-global-context

## 읽어야 할 파일
- `AGENTS.md`
- `_docs/ARCHITECTURE.md`
- `front/AGENTS.md`
- `front/src/app/_layout.tsx`
- `front/scripts/test-front.cjs`
- `front/tests/unit/homeContent.test.ts`
- `_docs/AI_DRAMA_data_model/01-identity/users.md`
- `_docs/AI_DRAMA_data_model/01-identity/user_preferences.md`
- `_docs/api/01-identity/README.md`
- `_docs/api/05-economy/points.md`
- Expo 57 문서: https://docs.expo.dev/versions/v57.0.0/ (제품 코드 작성 전 확인)

## 작업

변경 허용 파일은 다음 8개뿐이다. 다른 작업자가 있을 수 있으므로 기존 변경을 되돌리지 않는다. apply_patch로만 수정한다.

- `front/src/features/user/UserProvider.tsx`
- `front/src/features/points/PointsProvider.tsx`
- `front/src/features/points/pointsState.ts`
- `front/src/features/playback/PlaybackSettingsProvider.tsx`
- `front/src/app/_layout.tsx`
- `front/tests/unit/pointsState.test.ts`
- `front/scripts/test-front.cjs`
- `_docs/ARCHITECTURE.md`

UserProvider는 최소 현재 사용자 타입(uuid, nullable displayName, 데이터 모델의 accountType)과 user: User | null, setUser를 제공한다. 토큰·가짜 사용자·게스트 UUID 생성은 구현하지 않는다. 초기값은 null이다. 로그인 결과를 원자적으로 반영하도록 `setUser(user, initialBalance?)`를 지원한다. 내부 세션 스냅샷은 user, initialBalance(number | null), revision을 보관하고 setUser 호출마다 revision을 증가시킨다. initialBalance는 로그인 시 PointsProvider 초기화용이며 이후 현재 잔액의 중복 저장소로 사용하지 않는다. 인자 생략 또는 user=null이면 초기 잔액은 null이다. 로그인 성공 시 실제 잔액 0도 유지한다.

PointsProvider는 useUser에서 사용자 UUID와 초기 잔액, revision을 읽고 revision으로 내부 Provider를 key 처리한다. 사용자 전환·로그아웃·동일 사용자 재로그인 시 새 스냅샷으로 초기화하며 새 초기 잔액이 없으면 idle/null, 있으면 ready/실제 잔액으로 시작한다. 이전 잔액을 잠깐 보여주는 effect 초기화나 setUser 직후 이전 PointsProvider에 setBalance를 호출하는 방식은 피한다. pointsState.ts는 React에 의존하지 않는 초기 상태 함수와 reducer를 정의한다. 포인트는 idle/loading/ready/error 상태와 balance: number | null을 구분한다. start, success, failure, reset 동작을 제공하되 API 호출은 구현하지 않는다. 성공은 서버 잔액으로 교체한다. 사용자 UUID 없는 상태에서는 갱신하지 않는다. 결과의 소유 UUID가 다르면 무시하며 unmount된 이전 Provider의 콜백은 현재 상태를 바꾸지 못해야 한다.

PlaybackSettingsProvider는 subtitlesEnabled=true와 autoplayNext=false 및 각 설정 변경 함수를 제공한다. 이 단계에서는 메모리에서만 유지하며 실제 플레이어·설정 UI·영구 저장과 연동하지 않는다. 무관한 설정과 범용 저장소를 추가하지 않는다.

각 Provider는 사용 훅을 export하고 루트 화면 트리에서 사용 가능하게 연결한다. UserProvider 안에 PointsProvider를 두며 PlaybackSettingsProvider는 key로 재생성되는 PointsScope 밖에 두어 로그인에 의해 설정이 초기화되지 않게 한다. 기존 폰트 로딩, SafeAreaProvider, StatusBar 동작은 유지한다. Context 값과 액션의 참조를 필요 범위에서 안정화하고 세 도메인을 하나의 Context에 합치지 않는다.

아키텍처 문서에 features 하위 각 상태의 책임, 루트 조합, 포인트 초기화 원칙과 이번 단계의 API 미연동을 기록한다. 테스트 러너의 기존 testFiles 목록에 새 pointsState.test.ts만 추가하고 기존 테스트 목록을 임의 변경하지 않는다.

### 주요 로직 코드 또는 변경 예시

다음 핵심 흐름을 구현한다. 구체적인 훅 이름은 task-2에서도 일관되게 사용한다.

```tsx
export function PointsProvider({ children }: { children: ReactNode }) {
  const { user, initialBalance, revision } = useUser();
  const userUuid = user?.uuid ?? null;
  return <PointsScope key={revision} userUuid={userUuid} initialBalance={initialBalance}>
    {children}
  </PointsScope>;
}

function PointsScope({ userUuid, initialBalance, children }: {
  userUuid: string | null;
  initialBalance: number | null;
  children: ReactNode;
}) {
  const [state, dispatch] = useReducer(pointsReducer, { userUuid, initialBalance },
    ({ userUuid, initialBalance }) => createPointsState(userUuid, initialBalance));
  const setBalance = useCallback((ownerUuid: string, balance: number) => {
    dispatch({ type: 'success', userUuid: ownerUuid, balance });
  }, []);
  const reset = useCallback(() => dispatch({ type: 'reset' }), []);
  const start = useCallback((ownerUuid: string) => {
    dispatch({ type: 'start', userUuid: ownerUuid });
  }, []);
  const fail = useCallback((ownerUuid: string) => {
    dispatch({ type: 'failure', userUuid: ownerUuid });
  }, []);
  const value = useMemo(() => ({ ...state, setBalance, reset, start, fail }),
    [state, setBalance, reset, start, fail]);
  return <PointsContext.Provider value={value}>{children}</PointsContext.Provider>;
}
```

```ts
export function pointsReducer(state: PointsState, action: PointsAction): PointsState {
  if (action.type === 'reset') return createPointsState(state.userUuid);
  if (state.userUuid === null || action.userUuid !== state.userUuid) return state;
  switch (action.type) {
    case 'start': return { ...state, status: 'loading', balance: null };
    case 'success': return { ...state, status: 'ready', balance: action.balance };
    case 'failure': return { ...state, status: 'error', balance: null };
  }
}
```

`createPointsState(userUuid, initialBalance = null)`는 사용자와 초기 잔액이 모두 있으면 ready 상태와 해당 잔액을 반환하고, 아니면 idle/null을 반환한다. reset은 기존 로그인 초기 잔액을 복원하지 않고 idle/null로 초기화한다. UserProvider의 setUser는 다음처럼 한 번에 갱신한다.

```tsx
const setUser = useCallback((user: User | null, initialBalance: number | null = null) => {
  setSession(previous => ({
    user,
    initialBalance: user === null ? null : initialBalance,
    revision: previous.revision + 1,
  }));
}, []);
```

state/action 타입은 위 흐름에 맞춰 명시하고 단정·any로 타입 검사를 우회하지 않는다. 실제 네트워크 작업 없이 start/fail을 자동 호출하지 않는다.

검증 명령:
- `npm --prefix front run typecheck`
- `npm --prefix front run test`
- `npm --prefix front run export`

완료 조건: 초기 미조회/로그인 초기 잔액(0 포함)/성공 0/연속 성공 시 잔액 교체/loading/error/reset/다른 사용자 결과/익명 상태 갱신 차단 테스트가 통과한다. 사용자 변경과 동일 사용자 재로그인은 keyed Provider에서 새 스냅샷으로 초기화되고 이전 scope의 결과가 현재 scope로 전달되지 않는지 검토한다. 루트 연결 및 재생 설정 기본값을 확인한다. 순수 reducer 테스트만으로 실제 화면 구독 갱신까지 검증했다고 보고하지 않는다. task-2 화면 변경은 하지 않는다.
