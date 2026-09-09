# Architecture

## Overview

이 저장소는 Expo 기반 React Native 클라이언트와 NestJS API 서버를 분리해 관리한다.

```text
front (React Native / Expo) ── HTTP API ──> back (NestJS)
```

## Frontend

- 위치: `front/`
- 라우팅: Expo Router. `front/src/app/_layout.tsx`가 글꼴·로컬 상태 공급자와 네이티브 Stack을 설정한다. `(tabs)/_layout.tsx`에서 홈·추천·찾기·보관함·내 정보의 NativeTabs를 연결하고, 브라우저에서는 `_layout.web.tsx`의 하단 Tabs를 사용한다. `drama/[id]`, `player/[id]`, `wallet` route는 화면 컴포넌트에 경로 값만 전달한다.
- 화면 UI: `front/src/screens/`; 재사용 UI: `front/src/components/`; 디자인 토큰: `front/src/theme/`.
- 기능 로직: `front/src/features/<feature>/`. 기능별 endpoint, 상태 훅, 타입을 함께 둔다.
- 공통 기반: `front/src/services/`에 HTTP client, 세션 저장소, 환경 설정을 둔다. `front/src/utils/`에는 순수 공용 함수만 둔다.
- 정적 리소스: `front/assets/`. 화면 이미지와 아이콘은 각각 `assets/images/`, `assets/icons/`에 둔다.
- 플랫폼 실행: Expo를 통해 Android, iOS, Web을 지원한다.
- AI DRAMA 화면은 React Native 컴포넌트로 구현한다. HTML, 브라우저 저장소, WebView, `web-prototype` import에 의존하지 않는다.
- `features/drama/catalog.ts`는 예시 작품, `experience.ts`는 포인트·회차 이용·저장·시청 기록의 순수 규칙, `ExperienceProvider.tsx`는 앱 상태를 담당한다. `services/experience-storage.ts`가 AsyncStorage 읽기·순차 쓰기를 처리한다.
- 상태를 읽기 전에는 변경하지 않는다. 연속 클릭에도 최신 상태로 차감하며, 한 번 연 회차는 추가 차감하지 않는다. 저장 실패는 화면에 알린다.
- `services/share-drama.ts`는 모바일 공유창과 Web 링크 복사를 처리한다. 공유 링크는 누구나 접근 가능한 기존 공개 시안의 작품 소개를 가리킨다.
- 정적 포스터는 `assets/images/`, 모바일용 Pretendard 정적 TTF와 라이선스는 `assets/fonts/`에 보관한다. `theme/tokens.ts`, `components/ui.tsx`에서 색상·글꼴·공통 UI를 관리한다.
- 추천 피드는 세로 페이지 단위로 이동한다. 재생·광고 타이머는 화면 포커스와 앱 활성 상태를 확인한다. 추천은 시청 기록과 포인트를 변경하지 않는다.
- 실제 영상·광고·결제·회원 API는 아직 연결하지 않았다. 현재 포인트와 이용 권한은 기기 내부의 체험 데이터이며 실제 서비스 권한 검증으로 사용하면 안 된다.
- 서버 통신 코드는 화면 컴포넌트와 분리한다. API 계약이 변경되면 관련 문서와 백엔드 테스트를 함께 갱신한다.


## Backend

- 위치: `back/`
- 애플리케이션 코드: `back/src/`
- e2e 테스트: `back/test/`
- NestJS의 module, controller, service 경계를 따른다.
- 빌드 결과물은 `back/dist/`에 생성되며 저장소에 커밋하지 않는다.

## Web Prototype

- 위치: `web-prototype/`
- 공개 체험: https://ai-drama-screen.qwerqerqwere.chatgpt.site/
- 최초 공개 시안의 React / vinext 웹앱 원본이다. 화면과 체험 기능을 `front/`로 옮겼으며, 현재 앱 개발의 기준은 `front/`다. `front`는 이 폴더를 읽거나 실행하지 않는다. 기존 공개 사이트를 보존하기 위해 원본만 유지한다.
- 홈, 추천 숏폼 피드, 검색, 회차 선택, 보관함, 이어보기, 포인트 충전·차감 체험을 포함한다.
- 포인트와 시청 기록은 브라우저에 저장하는 데모 데이터다. 실제 영상·광고·결제·회원 기능 및 모바일 설치 패키지는 포함하지 않는다.
- 이 폴더 안에서 `pnpm install --frozen-lockfile`, `pnpm dev`, `pnpm build`를 사용한다. 의존성과 lockfile은 기존 앱들과 별도로 관리한다.
- 기존 Sites 소스 커밋 `c697c3bd82edf156d5e537f4c6e65e451ae67ba0`의 추적 파일을 가져왔다. 사이트 배포 설정과 이미지·글꼴 라이선스도 함께 보관한다.

## Documentation and Changes

- 작업 계획은 `_docs/plans/`에 작성한다.
- AI DRAMA 기획서와 구현 안내는 `_docs/AI_DRAMA_기획서_구현안내_20260909.pptx`에 보관한다. 현재 공개 웹앱의 화면·기능 범위와 체험 링크를 포함한다.
- 디렉터리 구조나 프론트-백엔드 책임이 바뀌면 이 문서를 함께 수정한다.
- 의존성과 환경변수는 각 앱의 `package.json`과 `.env.example`을 기준으로 관리한다.
