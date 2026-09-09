# AI DRAMA 앱

공개 웹 시안의 화면과 기능을 기존 Expo 57 / React Native 프로젝트에 통합했습니다. `front`만 설치해 실행할 수 있습니다.

## 실행

프로젝트 기준 환경은 Node.js 24.7.0, npm 11.5.1입니다.

```sh
cd front
npm ci
npm start
```

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
| `src/screens/` | 홈·추천·검색·보관함·내 정보·상세·재생·포인트 화면 |
| `src/components/` | 공통 글자·버튼·포스터·페이지 |
| `src/theme/` | 색상·Pretendard 글꼴 이름 |
| `src/features/drama/` | 작품 데이터, 포인트 및 시청 기록 규칙, 앱 상태 |
| `src/services/` | AsyncStorage 및 플랫폼 공유 |
| `assets/images/`, `assets/fonts/` | 앱에 포함되는 포스터·글꼴·라이선스 |

`back`과 `web-prototype`의 의존성은 필요하지 않습니다. 기존 공개 웹 주소는 이 앱의 개발 서버나 배포 주소와 별개입니다.

## 유지한 이용 흐름

- 작품별 첫 7~10화 무료, 이후 회차는 확인 후 10P 차감
- 최초 4P, 광고 체험 완료 시 10P·하루 최대 5회, 예시 포인트 충전
- 저장한 작품, 시청 기록, 이어보기, 자막·자동 다음 화 설정을 기기에 보관
- 추천 탭에서 예고·1화 분위기를 세로로 넘겨보기, 본편 또는 회차 목록으로 이동
- 재생 화면의 일시 정지·속도·위치 조절과 이전/다음 화

실제 드라마 파일이 없어 포스터와 예시 자막으로 재생을 표현합니다. 광고·결제는 체험이며 실제 청구는 없습니다. 회원 동기화·운영자 업로드·NestJS API 연결·앱스토어 배포는 다음 개발 범위입니다. 창작마당은 포함하지 않습니다.

## 검증

```sh
npm run typecheck
npm test
npm run export
```

`npm test`는 회차 차감·중복 차감 방지·광고 일일 한도·기록 저장 규칙을 검사합니다. `npm run export`는 Android/iOS/Web의 JavaScript 번들과 자산을 생성하며, 실제 기기 빌드나 앱스토어 제출을 대신하지 않습니다.

글꼴은 [Pretendard 공식 저장소](https://github.com/orioncactus/pretendard)의 정적 TTF를 사용하며 라이선스는 `assets/fonts/LICENSE.txt`에 있습니다.
