# task-1-account-points-screens

## 읽어야 할 파일

- `AGENTS.md`
- `_docs/ARCHITECTURE.md`
- `front/AGENTS.md`
- `front/src/screens/AccountScreen.tsx`
- `front/src/screens/LibraryScreen.tsx`
- `front/src/app/_layout.tsx`
- `front/src/app/(tabs)/account.tsx`
- `front/src/components/ui.tsx`
- `front/README.md`

## 작업

변경 가능한 파일은 정확히 다음 다섯 개다.

- `front/src/screens/AccountScreen.tsx`
- `front/src/screens/PointsScreen.tsx` (신규)
- `front/src/app/points.tsx` (신규)
- `front/src/app/_layout.tsx`
- `front/README.md`

1. `AccountScreen`의 기존 `보관함` 섹션과 `저장한 작품` 버튼을 제거한다. 제목을 `MY SPACE` / `나의 작은 영화관`으로 바꾸고, 게스트 프로필(`드라마를 좋아하는 당신`, `게스트로 둘러보고 있어요`, `체험 계정`)을 표시한다. `내 포인트` 카드에는 실제 잔액 대신 `— P`와 준비 중 문구를 표시한다.
2. 포인트 카드는 `/points`를 열고, `포인트 이용 내역` 메뉴는 `/points?tab=history`를 연다. `시청 기록` 메뉴는 기존 `/library?tab=history`로 이동한다. 재생 설정·이용 안내·앱 정보 메뉴는 각각 읽기 전용 모달을 열고 닫을 수 있게 한다. 재생 설정 모달은 자막 표시·다음 회차 자동 재생·화질 항목을 보여주되 조작과 저장은 비활성으로 표시한다. 이용 안내는 현재 포인트 기능이 화면만 준비됐음을 설명하고, 앱 정보는 AI DRAMA와 체험 화면 정보를 보여준다. 기존 `저장한 작품` 메뉴를 남기지 않는다.
3. `PointsScreen`을 만든다. 뒤로 가기, `MORE STORIES, MORE MOMENTS` / `이야기를 계속하는 방법`, 사용 가능한 포인트(`— P`), `충전하기`와 `이용 내역` 탭을 표시한다. 충전 탭에는 광고 보상 `+10 P`와 100P/₩1,100, 300P/₩3,300, 600P/₩6,600 상품을 예시로 표시하되 `예시 가격`과 `준비 중`을 명시하고 버튼을 비활성화한다. 이용 내역 탭에는 조회 기능이 준비 중임을 표시한다. `0P`, `0건`처럼 실제 데이터로 오해할 수 있는 수치는 만들지 않는다.
4. `front/src/app/points.tsx`에서 `PointsScreen`을 렌더링하고, `front/src/app/_layout.tsx`의 Stack에 `points` 화면을 등록한다. 포인트 화면의 뒤로 가기는 이전 화면으로 돌아가며, 직접 진입했으면 내 정보 탭으로 이동한다. 이용 내역 탭은 경로의 `tab=history`로 초기화하고 사용자가 두 탭을 전환할 수 있게 한다.
5. `front/README.md`의 현재 연결 상태만 수정해 내 정보·포인트 화면은 연결됐지만 포인트 조회·적립·충전·사용은 아직 제공되지 않는다고 기록한다. 기존 API·보관함·재생 기능에 관한 다른 문구는 이번 변경과 직접 관련된 경우에만 수정한다.

### 주요 로직 코드 또는 변경 예시

```tsx
// AccountScreen: 각 메뉴는 실제 대상 화면 또는 읽기 전용 모달을 연다.
const router = useRouter();
const [dialog, setDialog] = useState<'settings' | 'help' | 'about' | null>(null);

<Pressable onPress={() => router.push('/points')} accessibilityRole="button">
  <AppText>내 포인트</AppText><AppText>— P</AppText>
</Pressable>
<Pressable onPress={() => router.push({ pathname: '/points', params: { tab: 'history' } })} accessibilityRole="button">
  <AppText>포인트 이용 내역</AppText>
</Pressable>
<Pressable onPress={() => router.push({ pathname: '/library', params: { tab: 'history' } })} accessibilityRole="button">
  <AppText>시청 기록</AppText>
</Pressable>
<Pressable onPress={() => setDialog('settings')} accessibilityRole="button"><AppText>재생 설정</AppText></Pressable>
<Pressable onPress={() => setDialog('help')} accessibilityRole="button"><AppText>이용 안내</AppText></Pressable>
<Pressable onPress={() => setDialog('about')} accessibilityRole="button"><AppText>앱 정보</AppText></Pressable>
<Modal visible={dialog !== null} transparent onRequestClose={() => setDialog(null)}>
  <View>{dialog === 'settings' ? <AppText>재생 설정은 준비 중이에요.</AppText>
    : dialog === 'help' ? <AppText>현재 포인트 기능은 화면만 준비돼 있어요.</AppText>
    : <AppText>AI DRAMA</AppText>}
    <Button label="닫기" onPress={() => setDialog(null)} />
  </View>
</Modal>

// PointsScreen: URL로 열린 탭과 사용자가 고른 탭을 동기화한다.
const params = useLocalSearchParams<{ tab?: string }>();
const [selectedTab, setSelectedTab] = useState<'charge' | 'history' | null>(null);
useEffect(() => setSelectedTab(null), [params.tab]);
const tab = selectedTab ?? (params.tab === 'history' ? 'history' : 'charge');
const back = () => router.canGoBack() ? router.back() : router.replace('/account');
const packs = [{ points: 100, price: '₩1,100' }, { points: 300, price: '₩3,300' }, { points: 600, price: '₩6,600' }];

<Button label="돌아가기" onPress={back} />
<Button label="충전하기" onPress={() => setSelectedTab('charge')} />
<Button label="이용 내역" onPress={() => setSelectedTab('history')} />
{tab === 'charge'
  ? <View>
      <Button label="광고 보고 +10 P 받기 · 준비 중" disabled onPress={() => {}} />
      <AppText>예시 가격 · 실제 결제 없음</AppText>
      {packs.map((pack) => <Button key={pack.points} label={`${pack.points} P · ${pack.price} · 준비 중`} disabled onPress={() => {}} />)}
    </View>
  : <EmptyState title="이용 내역은 준비 중이에요" description="포인트 내역을 조회하는 기능은 아직 연결되지 않았어요." />}
```

예시 코드의 화면 배치·스타일은 기존 `Page`, `AppText`, `Button`, `Icon`과 테마를 사용해 완성한다. 예시 상품 버튼도 비활성화하고, 읽기 전용 안내 모달에는 접근 가능한 닫기 동작을 제공한다. 포인트 관련 상태 저장·변경 함수를 추가하지 않는다.

검증 명령:

- `npm --prefix front run typecheck`
- `npm --prefix front run test`
- `npm --prefix front run export`

완료 조건: 내 정보의 프로필, 포인트 카드, 포인트 이용 내역, 시청 기록, 재생 설정, 이용 안내, 앱 정보가 승인된 구성으로 나타나며 모든 활성 메뉴가 대상 화면이나 모달을 연다. 포인트 화면의 탭과 뒤로 가기가 동작한다. 잔액·광고 보상·충전·이용 내역이 실제 데이터나 결제처럼 표시되지 않고, 포인트 값이 변경되지 않는다.
