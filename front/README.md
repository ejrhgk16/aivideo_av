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

홈, 검색, 추천과 작품 상세는 공개 API 데이터를 표시합니다. 보관함과 계정별 기능은 사용자 저장·시청 API가 연결되기 전까지 사용할 수 없습니다. 재생·결제 기능은 아직 제공하지 않습니다.

## 검증

```sh
npm run typecheck
npm test
npm run export
```

`npm test`는 API 콘텐츠와 이미지 URL 처리를 검사합니다. `npm run export`는 Android/iOS/Web의 JavaScript 번들과 자산을 생성하며, 실제 기기 빌드나 앱스토어 제출을 대신하지 않습니다.

글꼴은 [Pretendard 공식 저장소](https://github.com/orioncactus/pretendard)의 정적 TTF를 사용하며 라이선스는 `assets/fonts/LICENSE.txt`에 있습니다.
