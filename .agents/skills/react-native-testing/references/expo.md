# Expo 테스트 규약

Expo Router·jsdom·네이티브 영상/스크롤을 다룰 때 읽는다. 버전과 경로는 현재 저장소의 package.json·lockfile·setup을 우선한다.

## 공통 설정 재사용

- 이 저장소의 프론트는 Jest + jest-expo, 컴포넌트/훅은 RNTL, API 클라이언트·순수 함수는 Jest를 사용한다. 백엔드 HTTP API 검증은 Postman 규약을 따른다. 기존 [setup](../../../../front/tests/setup.ts)과 [영상 helper](../../../../front/tests/support/video.ts)를 재사용한다.
- SDK 57 Router 테스트의 RNTL 13 조합을 React 19라는 이유만으로 14로 바꾸지 않는다. 설치된 Router 테스트 API와 export를 확인한다.
- setup에는 공식 safe-area Jest mock의 default export와 폰트·영상 경계가 있다. 실제 공용 UI·React·Router를 통째로 대체하지 않는다.
- RNTL 13 + jsdom에서 waitFor 조건이 참인데도 반환되지 않으면 import 시 캡처하는 immediate를 확인한다. 현재 setup은 RNTL import 전에 없는 Node setImmediate/clearImmediate와 TextEncoder/TextDecoder만 제공한다. 각 테스트에 같은 폴리필을 복사하지 않는다.
- 이 프론트 테스트는 서버·DB·실제 네트워크를 사용하지 않는다. 실제 영상 디코딩, 브라우저 배치·스크롤 물리, 기기 터치는 검증 범위 밖이다.

## Router와 화면 준비

- focus/blur는 공식 `expo-router/testing-library`로 재현한다. 화면 상태·플레이어를 유지해야 하면 앱과 같은 `Stack` layout을 구성한다. 기본 Slot의 재마운트를 상태 유지로 오인하지 않는다.
- `testRouter` helper는 자체 act를 수행한다. 바깥 act로 감싸지 말고, 목적 화면이 실제 표시된 뒤 복귀시킨다. pathname 변경만으로 화면 commit을 판단하지 않는다.
- 전체 pathname을 검증할 때 보존된 query도 포함한다. 기대하지 않은 재조회가 보이면 실제 focus·재마운트·API 계약부터 확인한다.
- 목록이 layout 뒤 생성되면 feed layout → 목록 표시 → content size → scroll 도착 순으로 이벤트를 전달한다.
- 영상 카드 제목·controls는 조건부다. 대상 preview 요청과 준비 이벤트를 완료한 뒤 표시를 검증하고, 미준비·실패 시나리오는 그 상태를 유지한다.
- 재포커스 시 새 buffer가 만들어질 수 있다. 현재 요청과 해제되지 않은 최신 player를 관찰하고, 해제된 이전 인스턴스를 ready 처리하지 않는다.

## 네이티브 경계

- 지원되지 않는 Modal dismiss·Slider·player·스크롤 이벤트에만 native query/prop/ref 접근을 제한하고 이유를 남긴다. 임의 host 이름이나 화면 함수 직접 호출로 대체하지 않는다.
- preset의 View/ScrollView는 class wrapper일 수 있어 createNodeMock의 host ref와 다르다. 필요한 feed ref만 최소 경계로 연결하고, 스크롤 요청은 실제 preset ScrollView 인스턴스의 scrollTo에서 관찰한다. FlatList·PanResponder 알고리즘은 유지한다.
- React Native의 일부 export는 lazy getter다. 부분 mock이 필요하면 descriptor를 보존한다. 모듈 전체 spread로 불필요한 TurboModule을 로드하지 않는다.
- 웹 이벤트는 실제 jsdom HTMLElement/EventTarget/WheelEvent를 사용한다. 별도 DOM 전파 엔진을 만들지 않는다.
- 리스너는 현재 callback의 연결과 blur/unmount 후 해제를 검증한다. 정상적인 effect 재등록을 누수로 판단하지 않는다.

## 타이머와 경합

- RAF·performance.now·setTimeout은 같은 Jest fake clock으로 제어한다. 필요한 시간만 bounded하게 진행하며 여러 프레임은 한 async act에서 처리해 불필요한 실제 scheduler 왕복을 줄인다.
- 애니메이션 요청·프레임 완료·실제 scroll 도착·wheel quiet는 별도 조건이다. runAllTimers로 합치거나 임의 15프레임 같은 숫자를 일반 규칙으로 고정하지 않는다. duration과 RAF 정렬 오차를 계산한다.
- scrollTo의 인자는 실제 세로/가로 API 형태와 대조한다. 목표 offset·content-size gate를 통과시키기 위해 기대 좌표를 낮추지 않는다.
- focus 자체의 정렬과 metadata 응답의 추가 동작을 분리해 기준값을 잡는다. 요청·Promise 격리 등 공통 규칙은 [Jest 스킬](../../javascript-typescript-jest/SKILL.md)을 따른다.
