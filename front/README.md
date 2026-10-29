# AI DRAMA 앱

공개 웹 시안의 화면과 기능을 기존 Expo 57 / React Native 프로젝트에 통합했습니다. `front`만 설치해 실행할 수 있습니다.

## 실행

프로젝트 기준 환경은 Node.js 24.7.0, npm 11.5.1입니다.

```sh
cd front
npm ci
npm start
```

API 주소는 `front/.env.development`에서 `EXPO_PUBLIC_API_BASE_URL`로 설정합니다. 앱에서 접근 가능한 HTTP(S) URL을 사용하고, 실제 기기에서는 `localhost` 대신 개발 PC의 LAN IP와 API 포트를 지정합니다. 예시는 `.env.example`에 있습니다.

웹은 로그인·세션 복원·로그아웃 요청에 브라우저 쿠키를 포함하고 `X-Auth-Transport: cookie`를 보냅니다. 백엔드는 Refresh를 HttpOnly 쿠키로 저장하고, 새로고침 뒤 `/auth/refresh`로 Access와 사용자 정보를 복원합니다. 쿠키는 프론트 JavaScript 저장소에서 읽거나 수정하지 않습니다. 네이티브 앱은 기존 Expo SecureStore와 JSON Refresh 방식을 사용합니다.

다른 탭에서 계정이 바뀐 경우 다음 Refresh 응답의 사용자 UUID를 현재 계정과 비교합니다. 달라지면 현재 탭의 인증 상태를 비우고 진행 중인 요청을 중단해 이전 계정 요청이 새 계정으로 재전송되지 않도록 합니다. 이 검사는 별도 탭 동기화 없이 Refresh 시점에 동작합니다.

웹 개발은 프론트 `http://localhost:8081`, API `http://localhost:3000` 조합을 사용합니다. API 주소는 `EXPO_PUBLIC_API_BASE_URL`에 설정하고, 백엔드 `WEB_CORS_ORIGINS`에는 브라우저의 정확한 origin을 허용해야 합니다. 배포 시 HTTPS를 사용하고 프론트/API를 `app.example.com` 및 `api.example.com`처럼 같은 사이트에 두거나 동일 origin 프록시를 구성합니다. 별개 사이트의 서드파티 쿠키와 `*.vercel.app` 프로젝트 간 쿠키 공유는 지원하지 않습니다.

웹 세션을 수동으로 확인하려면 브라우저에서 저장된 개발 사이트 쿠키를 지운 뒤 `http://localhost:8081`을 열어 첫 방문이 익명으로 끝나는지 확인합니다. 로그인 후 개발자 도구의 Network에서 `/auth/login` 응답 JSON에 Refresh가 없고, `auth.refreshToken`이 HttpOnly·Path `/auth`·SameSite Lax 쿠키로 설정되는지 확인합니다. 새로고침 뒤 `/auth/refresh`가 세션을 복원하고, 로그아웃 뒤 다시 새로고침하면 익명으로 남아야 합니다. 로컬 HTTP에서는 Secure가 꺼지고 운영 HTTPS에서는 켜집니다. 쿠키 값은 복사하거나 공유하지 않습니다.

홈 컬렉션, 검색, 작품 상세 데이터와 이미지는 `EXPO_PUBLIC_API_BASE_URL`의 NestJS API에서 가져옵니다. API 응답의 상대 이미지 URL은 API 주소에 연결하고, 절대 URL(운영 signed URL 포함)은 그대로 사용합니다. 개발 중 API는 `back/.env.development`의 `MEDIA_STORAGE_ROOT`가 가리키는 `front/media/` 파일을 `/media/images/` 경로로 제공합니다.

Expo Go 또는 개발 빌드에서 QR 코드를 열어 기기로 확인합니다. Expo 57과 호환되는 실행 앱이 필요합니다.

```sh
npm run web       # 브라우저
npm run android   # Android 에뮬레이터 또는 연결 기기
npm run ios       # macOS + Xcode 시뮬레이터
```

## 코드 위치

| 위치 | 역할 |
| --- | --- |
| `src/app/` | Expo Router 경로와 네비게이터 |
| `src/screens/` | 홈·추천·검색·보관함·내 정보·상세 화면 |
| `src/components/` | 공통 글자·버튼·포스터·페이지 |
| `src/common/` | 공용 HTTP·저장소·환경·theme·순수 utility 코드 |
| `src/features/` | 기능별 상태, endpoint, 타입 (`drama/`, `home/` 등) |
| `media/` | 로컬 개발용 콘텐츠 미디어 파일 |
| `assets/fonts/` | 앱에 포함되는 글꼴·라이선스 |

`back`과 `web-prototype`의 의존성은 필요하지 않습니다. 기존 공개 웹 주소는 이 앱의 개발 서버나 배포 주소와 별개입니다.

## 현재 연결 상태

홈, 검색, 추천과 작품 상세는 공개 API 데이터를 표시합니다. 내 정보와 포인트 화면은 연결되어 있지만 포인트 조회·적립·충전·사용은 아직 제공하지 않습니다. 보관함 저장·시청 기록과 계정별 데이터는 사용자 저장·시청 API가 연결되기 전까지 사용할 수 없습니다. 재생·결제 기능은 아직 제공하지 않습니다.

## 검증

```sh
npm run typecheck
npm test
npm run export
```

`npm test`는 API 콘텐츠와 이미지 URL 처리를 검사합니다. `npm run export`는 Android/iOS/Web의 JavaScript 번들과 자산을 생성하며, 실제 기기 빌드나 앱스토어 제출을 대신하지 않습니다.

글꼴은 [Pretendard 공식 저장소](https://github.com/orioncactus/pretendard)의 정적 TTF를 사용하며 라이선스는 `assets/fonts/LICENSE.txt`에 있습니다.
