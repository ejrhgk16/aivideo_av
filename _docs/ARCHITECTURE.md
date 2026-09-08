# Architecture

## Overview

이 저장소는 Expo 기반 React Native 클라이언트와 NestJS API 서버를 분리해 관리한다.

```text
front (React Native / Expo) ── HTTP API ──> back (NestJS)
```

## Frontend

- 위치: `front/`
- 라우팅: Expo Router. `front/src/app/_layout.tsx`가 네이티브 Stack을 설정하고, 각 route 파일은 화면 UI를 렌더링한다.
- 화면 UI: `front/src/screens/`; 재사용 UI: `front/src/components/`; 디자인 토큰: `front/src/theme/`.
- 기능 로직: `front/src/features/<feature>/`. 기능별 endpoint, 상태 훅, 타입을 함께 둔다.
- 공통 기반: `front/src/services/`에 HTTP client, 세션 저장소, 환경 설정을 둔다. `front/src/utils/`에는 순수 공용 함수만 둔다.
- 정적 리소스: `front/assets/`. 화면 이미지와 아이콘은 각각 `assets/images/`, `assets/icons/`에 둔다.
- 플랫폼 실행: Expo를 통해 Android, iOS, Web을 지원한다.
- 서버 통신 코드는 화면 컴포넌트와 분리한다. API 계약이 변경되면 관련 문서와 백엔드 테스트를 함께 갱신한다.


## Backend

- 위치: `back/`
- 애플리케이션 코드: `back/src/`
- e2e 테스트: `back/test/`
- NestJS의 module, controller, service 경계를 따른다.
- 빌드 결과물은 `back/dist/`에 생성되며 저장소에 커밋하지 않는다.

## Documentation and Changes

- 작업 계획은 `_docs/plans/`에 작성한다.
- 디렉터리 구조나 프론트-백엔드 책임이 바뀌면 이 문서를 함께 수정한다.
- 의존성과 환경변수는 각 앱의 `package.json`과 `.env.example`을 기준으로 관리한다.
