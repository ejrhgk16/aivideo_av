# Frontend

Expo / React Native 앱. 명령은 저장소 루트에서 실행한다. 기준 환경·작업 지침은 [AGENTS.md](../AGENTS.md), 코드 책임은 [아키텍처](../_docs/ARCHITECTURE.md)를 따른다.

## 환경·실행

| 파일 | 용도 |
| --- | --- |
| `.env.development` | 개발 서버의 `EXPO_PUBLIC_API_BASE_URL` |
| `.env.production` | 기본 export에 사용할 운영 API 주소 |

공통 `.env`는 사용하지 않는다. 환경 파일은 Git에서 제외하며 `EXPO_PUBLIC_*`에 비밀 값을 넣지 않는다. 운영 주소는 export 전에 채운다.

```dotenv
EXPO_PUBLIC_API_BASE_URL=http://localhost:3000
```

```powershell
npm --prefix front ci
npm --prefix front run start -- --port 8081
```

- 웹 개발 주소는 `http://localhost:8081`, API 실행·설정은 [백엔드 안내](../back/README.md)를 따른다.
- 실제 기기에서는 API 주소의 `localhost`를 개발 PC의 LAN IP로 바꾼다. Expo Go·개발 빌드는 설치된 SDK와 호환되어야 한다.
- Android: `npm --prefix front run android -- --port 8081`. iOS: macOS/Xcode에서 `npm --prefix front run ios -- --port 8081`.
- 이미지·영상 URL은 API 응답을 사용한다. `media/`는 Git에서 제외된 로컬 작업 공간이며 앱 번들·공개 자산과 별개다.
- 한국 시각 표시는 [API 시간 기준](../_docs/api/00-overview/conventions.md#시간과-공개-콘텐츠)에 맞춰 클라이언트에서 변환한다.

## 전역 상태

- 루트의 단일 `UserProvider`가 사용자·포인트·Access/세션·재생 설정(`subtitlesEnabled`, `autoplayNext`)을 소유한다. `SafeAreaProvider`도 루트에 하나만 두며 세션 변경 시 내비게이션을 재마운트하지 않는다.
- 저장 여부·현재 영상의 진행률 tracker·저장/시청 목록은 해당 화면에서 관리한다. feature의 API 호출은 `common/http/api.ts`를 통해 `features/user/sessionClient.ts`를 사용한다.
- 포인트 체험 잔액·내역·광고 횟수는 `PointsScreen` 로컬 상태이며 탭 전환 동안 유지하고 화면 이탈·계정/세션 변경 시 초기화한다. 실제 `UserProvider` 포인트와 API 거래는 변경하지 않는다.
- Access는 메모리, 네이티브 Refresh는 SecureStore, 웹 Refresh는 서버의 HttpOnly 쿠키에 둔다. 인증·복원·만료는 [인증 계약](../_docs/api/00-overview/authentication.md)·[오류 정의](../_docs/api/00-overview/error-code.md), 재생은 [재생 계약](../_docs/api/04-playback/README.md)을 따른다.

## 검증

```powershell
npm --prefix front run typecheck
npm --prefix front run test
npm --prefix front run test -- tests/unit/searchScreen.test.tsx
npm --prefix front run test -- tests/unit/api.test.ts tests/unit/session.test.ts
npm --prefix front run export
```

- 무인자 test는 `tests/`의 모든 `.test.ts`·`.test.tsx`를 실행한다. 선택 경로는 `front/` 기준이며 여러 파일·중복 제거를 지원한다. Jest 옵션 전달은 지원하지 않는다.
- API·순수 함수는 Jest, 화면·컴포넌트·훅은 React Native Testing Library로 검사한다. 작성 규약은 [Jest 스킬](../.agents/skills/javascript-typescript-jest/SKILL.md)·[RNTL 스킬](../.agents/skills/react-native-testing/SKILL.md)을 따른다.
- export는 Android/iOS/Web 번들·자산을 생성한다. 기기 빌드·앱스토어 제출은 별도다.

| 파일 | 테스트 책임 |
| --- | --- |
| `scripts/test-front.cjs` | 정렬된 테스트 탐색·경로 선택, watch 없이 단일 worker 실행 |
| `jest.config.cjs` | Expo transform, 탐색 범위, 소스 alias, setup 연결 |
| `tests/setup.ts`, `tests/support/` | 네이티브 경계 mock·결정적 테스트 지원, RNTL import에 필요한 Node text/immediate 전역, cleanup |

Harness의 작업별 검사와 최종 전체 검증은 [플랜 규칙](../_docs/plans/README.md#finish-검증)을 따른다.
