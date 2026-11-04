# task-3-account-points-design

## 기본 입력

- 이 task 문서와 index.json의 task-3 항목, 컨텍스트로 전달된 적용 지침.
- depends_on 없음. task-1/task-2/task-4와 수정 파일·출력·fixture가 독립적이다.

## 읽어야 할 파일

- front/src/screens/AccountScreen.tsx: 포인트 카드·pointsDescription·help Modal 문구와 해당 styles. 주변 프로필·메뉴는 보존할 동작만 확인한다.
- front/src/components/ui.tsx: AppText/Icon/Page와 style 합성에 필요한 부분만.
- front/src/common/theme/tokens.ts: 기존 색·폰트 값만.
- front/src/features/user/UserProvider.tsx: 기존 user/points 읽기 경계만.
- front/src/screens/HomeScreen.tsx: 이미 쓰고 있는 expo-linear-gradient import/JSX 예시 부분만.
- .agents/skills/vercel-react-native-skills/SKILL.md: 해당 RN 스타일·기존 구성 사용 지침.

## 필요 시 참고할 문서

- 루트 AGENTS.md: 적용 지침이 누락되거나 바뀐 경우만.
- _docs/ARCHITECTURE.md의 Frontend/Boundaries: 공유 컴포넌트·상태 경계 판단이 필요한 경우만.
- plan.md의 C3: 아래 시각·소유권 계약 발췌의 누락·충돌 확인 시만. C1은 체험 잔액과 실제 잔액의 관계가 불명확할 때 해당 부분만 확인한다.

## 실패 시 참고할 파일

- front/tests/unit/episodeUnlockDialog.test.tsx: 실행한 실제 포인트 구매 회귀의 실패 부분만.
- front/tests/setup.ts: LinearGradient·Feather 등 설치 경계 문제의 근거가 있을 때만.

## 작업

### 역할과 완료 조건

기존 화면의 디자인·문구를 바꾸는 소스 task다. 새 상태·제품 로직·테스트 export를 만들지 않는다. 다음 파일만 apply_patch로 수정한다. 다른 작업자도 작업하므로 타인의 변경을 되돌리지 않는다.

```text
front/src/screens/AccountScreen.tsx
```

checks는 다음 두 명령이며 모두 실행·통과해야 완료한다.

```powershell
npm --prefix front run typecheck
npm --prefix front run test -- tests/unit/episodeUnlockDialog.test.tsx
```

- C3의 스타일·문구·실제 points 소유권과 기존 이동을 자체 확인한다. episodeUnlockDialog는 실제 구매 경계의 회귀이며 카드의 시각 검사로 보고하지 않는다.
- 기존8081의 /account에서 모바일/데스크톱 그라데이션·잔액·P·충전 링크·null 표시와 /points 및 history 이동을 확인한다. 서버·렌더링 도구·로그인 데이터가 부족하면 미실행 사실을 별도 보고하고 자동 서버 실행은 하지 않는다.
- 단순 시각 변경이므로 새 테스트 파일/빈 테스트 task를 추가하지 않는다. 기존 프로필·설정·메뉴를 리팩터링하지 않는다.

### 적용 계약

- C3: 기존 `front/src/screens/AccountScreen.tsx`의 named `AccountScreen(): React.JSX.Element`, props 없음. 소비는 front/src/app/(tabs)/account.tsx의 default AccountRoute다.
- C3: 실제 useUser().points만 표시하고 null이면 「—」 및 로그인 후 확인 안내를 유지한다. PointsScreen 로컬 체험을 공유하지 않으며 전역 setPoints·AppTopBar·인증을 변경하지 않는다.
- C3: 기존 설치된 LinearGradient로 #272F22 → #171C18, 테두리 #CBF46A18, 반경 모바일18/큰 화면20. 왼쪽 「내 포인트」/숫자 모바일39·큰 화면45·#E1F8C3/작은P약23·label #B8C3B1, 오른쪽 「충전하기」+arrow-right. 기존 번개 아이콘·세로 설명 위주 구성을 교체한다.
- C3: 카드 클릭 → /points, 기존 「포인트 이용 내역」 → /points?tab=history를 유지한다. 사용자명·프로필·계정 badge·나머지 메뉴·모달은 그대로 둔다.
- C3: 이용 안내의 포인트 부분은 「포인트 잔액과 이용 내역을 확인할 수 있어요. 광고와 충전은 실제 결제 없이 체험할 수 있어요. 체험 포인트는 포인트 화면을 나가면 초기화돼요.」로 교체한다. 다른 설정의 준비 중 표시는 변경하지 않는다.

### 수정 지시

1. 필요한 LinearGradient import를 기존 의존성에서 추가하고, 기존 카드 Pressable 안의 배경으로 사용한다. gradient 장식이 클릭을 가로막지 않게 한다.
2. 스타일은 AccountScreen 안에서 적용한다. 좌측 정보/우측 링크의 가로 배치로 바꾸고 카드가 작은 화면에서 잘리지 않게 한다. 화면 콘텐츠는 기존 Page 합성으로 최대780/중앙 배치를 적용할 수 있다.
3. points===null일 때에만 필요한 로그인 안내는 카드나 주변의 적절한 위치에 보존한다. 정상 실제 잔액을 가상 체험 잔액으로 바꾸지 않는다.
4. help의 포인트 안내 문장만 위 문구로 정합화한다. 새 버튼·모달·경로·설정 기능을 추가하지 않는다.

### 반복 작업 위임

불가. 한 파일의 작은 스타일·문구 변경이다. 자식 슬롯0이다.

### 주요 로직 코드 또는 변경 예시

새 로직은 없다. 변경 전 단색 colors.surface·29px 숫자·번개 헤더·세로 설명을, 변경 후 녹색 gradient·39/45px 숫자·작은P·우측 「충전하기」로 교체한다. 실제 points 읽기와 router.push('/points'), 이용 내역의 `{ pathname: '/points', params: { tab: 'history' } }`는 유지한다. help의 오래된 「포인트 조회와 사용은 아직 제공되지 않아요」를 C3의 확정 안내로 교체한다. 공통 theme 파일은 수정하지 않는다.
