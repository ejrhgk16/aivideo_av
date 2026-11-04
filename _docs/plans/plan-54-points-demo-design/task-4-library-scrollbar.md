# task-4-library-scrollbar

## 기본 입력

- 이 task 문서와 index.json의 task-4 항목, 컨텍스트로 전달된 적용 지침.
- depends_on 없음. 다른 세 task와 수정 파일·출력·fixture가 독립적이다.

## 읽어야 할 파일

- front/src/screens/LibraryScreen.tsx: 두 탭이 공유하는 FlatList JSX, onEndReached·footer·기존 Page scroll=false 연결만.
- 설치된 front/node_modules/react-native의 ScrollView/FlatList 타입: showsVerticalScrollIndicator의 지원 타입이 불명확할 때만 해당 선언을 확인한다.

## 필요 시 참고할 문서

- 루트 AGENTS.md: 전달된 적용 지침이 누락되거나 변경된 경우만.
- _docs/ARCHITECTURE.md의 Frontend/Boundaries: 책임 경계 확인이 필요한 경우만.
- plan.md의 C4: 아래 한 줄 prop 계약과 충돌이 있을 때만.
- front/README.md의 검증: 선택 테스트 명령·기존8081 확인 규칙이 전달되지 않은 경우만.

## 실패 시 참고할 파일

- front/tests/unit/libraryScreen.test.tsx: 실패한 탭·추가 페이지·중복·세션·재생 이동 시나리오만. 실행만을 위해 전체를 읽지 않는다.
- front/src/features/playback/savedVideos.ts, watchHistory.ts: 해당 목록 요청·경로 회귀 실패 근거가 있을 때 관련 export만.

## 작업

### 역할과 완료 조건

기존 구현의 한 줄 표시 prop 변경을 맡는 소스 task다. 다음 파일만 apply_patch로 수정한다. 다른 작업자의 변경을 되돌리지 않는다.

```text
front/src/screens/LibraryScreen.tsx
```

checks는 다음 명령이며 실행·통과해야 완료한다.

```powershell
npm --prefix front run test -- tests/unit/libraryScreen.test.tsx
```

- 두 탭이 공유하는 FlatList에 정확히 `showsVerticalScrollIndicator={false}`를 추가하고 다른 제품 동작은 변경하지 않는다.
- 테스트 수정·새 테스트·실행기 변경은 불가다. 실패가 기존 검사 결함이면 근거를 메인에게 보고한다.
- 기존8081 /library와 /library?tab=history에 긴 기존 목록이 있을 때 스크롤바가 숨겨지고 휠·터치로 마지막 항목과 더 보기/추가 페이지에 접근되는지 확인한다. 시각·스크롤 확인 도구/데이터가 없으면 미실행을 명시한다. 서버가 없으면 안내하고 자동 실행하지 않는다.

### 적용 계약

- C4: 기존 `front/src/screens/LibraryScreen.tsx`의 named `LibraryScreen(): React.JSX.Element`, props 없음. 소비는 front/src/app/(tabs)/library.tsx의 default LibraryRoute다.
- C4: 저장한 작품·시청 기록의 공용 FlatList에 `showsVerticalScrollIndicator={false}`만 추가한다. scrollEnabled=false, overflow:hidden으로 자르기, ScrollView로 목록 교체, 전역 CSS는 사용하지 않는다.
- C4: 휠·터치 스크롤·onEndReached/loadNextPage·더 보기/재시도·로그인/탭/세션·UUID 중복 제거·카드 표시와 본편/미리보기 이동을 유지한다.

### 반복 작업 위임

불가. 한 파일의 한 줄 prop 변경이라 반복 위임 이점이 없다. 자식 슬롯0이다.

### 주요 로직 코드 또는 변경 예시

새 로직은 없다. 기존 `<FlatList data={visibleItems} ... />`에 `showsVerticalScrollIndicator={false}`를 추가한다. 현재 onEndReached, onEndReachedThreshold, ListFooterComponent, style, contentContainerStyle과 외부 Page scroll=false는 그대로 유지한다. 목적은 시각적 스크롤바 숨김이며 목록의 실제 스크롤을 제거하지 않는다.
