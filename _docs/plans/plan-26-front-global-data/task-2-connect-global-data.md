# task-2-connect-global-data

## 읽어야 할 파일
- `AGENTS.md`
- `_docs/ARCHITECTURE.md`
- `front/AGENTS.md`
- `front/src/features/user/UserProvider.tsx`
- `front/src/features/points/PointsProvider.tsx`
- `front/src/features/points/pointsState.ts`
- `front/src/components/AppTopBar.tsx`
- `front/src/components/EpisodeUnlockDialog.tsx`
- `front/src/screens/AccountScreen.tsx`
- `front/src/screens/PointsScreen.tsx`
- Expo 57 문서: https://docs.expo.dev/versions/v57.0.0/ (제품 코드 작성 전 확인)

## 작업

task-1 완료 후 실행한다. 변경 허용 파일은 다음 4개뿐이다. 다른 작업자의 변경을 되돌리지 않고 apply_patch로 수정한다.

- `front/src/components/AppTopBar.tsx`
- `front/src/components/EpisodeUnlockDialog.tsx`
- `front/src/screens/AccountScreen.tsx`
- `front/src/screens/PointsScreen.tsx`

네 컴포넌트에서 usePoints를 호출하여 포인트를 표시한다. status가 ready일 때만 잔액을 표시하고 그 외에는 —를 표시한다. 0을 falsy로 취급하지 않는다. 작은 표현식은 각 호출 위치에 두고 별도의 공통 표시 컴포넌트나 범용 상태 라이브러리를 추가하지 않는다.

idle은 기존 준비 중 안내, loading은 조회 중 안내, error는 조회 실패 안내로 표시한다. ready에서는 준비 중/조회 불가 문구를 남기지 말고 현재 잔액을 안내한다. 헤더 접근성 라벨도 실제 상태와 일치시킨다. 회차 팝업은 잔액을 알게 되어도 구매 버튼을 새로 추가하거나 구매 가능 여부를 확정하지 않는다. 구매가 미연동임을 안내하고 기존 충전 화면 이동을 유지한다.

AccountScreen에서 useUser의 사용자 정보가 있으면 displayName(없으면 기존 기본 이름)과 accountType에 맞는 표시를 사용한다. user=null이면 기존 게스트 표시를 유지한다. 실제 인증이 없으므로 UUID 존재만으로 로그인 완료로 표시하지 않는다. 명확한 매핑은 GUEST=게스트, MEMBER=회원, OPERATOR=운영자, PARTNER=제휴사로 한다.

재생 설정 UI는 준비 중으로 유지한다. 실제 구매·충전·포인트 조회·사용자 생성 API 요청, 테스트 버튼, 초기 가짜 잔액, 화면 재진입 기반 잔액 동기화, 레이아웃 재구성은 추가하지 않는다.

### 주요 로직 코드 또는 변경 예시

```tsx
const { balance, status } = usePoints();
const amount = status === 'ready' && balance !== null
  ? balance.toLocaleString('ko-KR')
  : '—';
const description = status === 'loading' ? '포인트를 조회하고 있어요'
  : status === 'error' ? '포인트 정보를 불러오지 못했어요'
  : status === 'ready' ? `사용 가능한 포인트는 ${amount} P예요`
  : '포인트 정보를 준비하고 있어요';

// AppTopBar에는 P 아이콘이 이미 있으므로 숫자만 표시한다.
<AppText weight="bold" style={styles.balance}>{amount}</AppText>
// AccountScreen, PointsScreen, EpisodeUnlockDialog의 잔액 위치:
<AppText weight="bold">{amount} P</AppText>
```

위 코드는 각 위치의 기존 컴포넌트·스타일을 보존해 적용한다. usePoints 상태 변경이 리렌더에 반영되도록 Context 값을 모듈 상수로 복사하거나 별도 로컬 잔액으로 초기화하지 않는다. 회차 팝업의 안내 문장은 ready여도 구매 미연동이라는 사실을 유지한다.

검증 명령:
- `npm --prefix front run typecheck`
- `npm --prefix front run test`
- `npm --prefix front run export`

완료 조건: 네 위치가 같은 Context를 사용하며 null과 0을 구분하고 상태별 안내·접근성 문구가 일치한다. 게스트 UI, 기존 충전 화면 이동 및 준비 중 기능을 유지한다. 테스트·타입 검사·export 결과를 기록한다. API가 없어 실제 잔액 조회와 구매를 검증하지 못한다는 한계를 명시한다. 실행 중 앱을 확인할 경우 localhost:8081만 사용하고 서버가 없으면 자동 실행 없이 실패와 실행 명령을 안내한다.
