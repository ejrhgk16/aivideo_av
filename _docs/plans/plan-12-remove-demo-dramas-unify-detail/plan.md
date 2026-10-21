# remove-demo-dramas-unify-detail

## 목표

`signal`, `season`, `moon`으로 만든 프론트 임시 작품과 전용 체험 흐름을 제거한다. 공개 작품 상세는 `DramaDetailScreen` 한 파일에서 `GET /dramas/:dramaId`로 조회하며, 공개 회차는 기존 상세 화면의 작은 네모 격자로 표시한다. 홈 최신·장르와 검색은 기존 `GET /dramas` 결과를 사용하고, 추천은 기존 `RECOMMENDATION_DAILY` 컬렉션의 공개 작품을 소개한다.

## 범위와 가정

- 프론트 화면, 기능 코드, 테스트, 환경 예시, 문서, 임시 이미지가 변경 대상이다. 백엔드 API 계약과 디렉터리 책임은 변경하지 않는다.
- 공개 상세 API의 `episodes`만 격자에 표시한다. 공개되지 않은 회차는 생성하지 않는다. `pricePoints === 0`이면 무료, 그 외에는 잠금 아이콘과 응답의 포인트 값을 함께 표시한다.
- 현재 공개 API에는 사용자별 해제 상태와 재생 가능한 영상 URL이 없다. 잠금 아이콘은 유료 회차 표시이며 사용자별 권한 상태를 판단하지 않는다. 회차 격자는 정보를 보여주되 재생·해제·구매를 시작하지 않는다. 관련 버튼과 샘플 포인트 체험을 제거한다. 회차 권한 기능은 추후 별도로 구현한다.
- 목록 API의 장르 정보로 홈 장르 탐색과 검색 필터를 구성한다. 목록에 없는 장르는 임의로 만들지 않는다. API 요청 중·실패·빈 결과 상태를 구분한다.
- 추천 화면은 컬렉션의 포스터와 상세 이동만 제공한다. 시청 기록과 저장 목록은 API가 연결되기 전까지 빈 상태로 표시한다.
- 기존 백엔드 엔드포인트와 DB 시드는 수정하지 않는다. 실제 재생, 구매, 사용자별 저장·시청 기록 API 연동은 이 계획에 포함하지 않는다.

## Task

| 번호 | 이름 | 대상 파일 | 핵심 작업 요약 |
| --- | --- | --- | --- |
| 1 | unify-api-detail | `front/src/screens/DramaDetailScreen.tsx`, `front/src/screens/ApiDramaDetailScreen.tsx` | API 상세 조회와 상태 처리를 단일 화면으로 합치고 공개 회차를 네모 격자로 표시, 유료 회차에 잠금 아이콘과 포인트를 함께 표시, 별도 API 화면 삭제 |
| 2 | api-catalog-discovery | `front/src/features/drama/dramaContent.ts`, `front/src/screens/HomeScreen.tsx`, `front/src/screens/SearchScreen.tsx`, `front/tests/unit/dramaContent.test.ts` | 공개 작품 목록 조회를 추가해 홈 최신·장르와 검색의 임시 작품 대체 |
| 3 | remove-demo-flows | `front/src/screens/RecommendationScreen.tsx`, `front/src/screens/LibraryScreen.tsx`, `front/src/screens/AccountScreen.tsx`, `front/src/screens/PlayerScreen.tsx`, `front/src/screens/WalletScreen.tsx`, `front/src/app/_layout.tsx`, `front/src/app/player/[id].tsx`, `front/src/app/wallet.tsx` | 추천은 API 작품 소개로 전환하고 샘플 재생·포인트 흐름과 라우트 제거, 보관함·내 정보 정리 |
| 4 | delete-demo-assets-state | `front/src/features/drama/catalog.ts`, `front/src/features/drama/ExperienceProvider.tsx`, `front/src/features/drama/experience.ts`, `front/src/common/storage/experienceStorage.ts`, `front/src/common/shareDrama.ts`, `front/src/components/ui.tsx`, `front/src/common/media.ts`, `front/tests/unit/experience.test.ts`, `front/tests/unit/media.test.ts`, `front/scripts/test-experience.cjs`, `front/scripts/test-front.cjs`, `front/package.json`, `front/package-lock.json`, `front/.env.example`, `front/README.md`, `front/media/images/signal.jpg`, `front/media/images/season.jpg`, `front/media/images/moon.jpg` | 남은 정적 카탈로그, 체험 상태·미디어·의존성·테스트·설정·설명을 제거 |

## 실행 순서 및 병렬 작업

- `task-1`과 `task-2`는 선행 의존성이 없고 대상 파일이 겹치지 않아 병렬 실행 가능하다.
- `task-3`은 `task-1`과 `task-2` 완료 후 실행한다. 통합 상세와 API 목록 이동이 준비된 뒤 샘플 전용 화면·라우트를 제거해야 한다.
- `task-4`는 `task-3` 완료 후 실행한다. 모든 화면에서 정적 카탈로그와 체험 상태의 참조가 제거된 뒤 해당 모듈·자산을 삭제해야 한다.

## 검증

- 각 task: `npm --prefix front run typecheck`, `npm --prefix front run test`, `npm --prefix front run export`.
- 최종 완료 조건: 세 임시 ID가 제품 코드와 테스트에서 사라지고, API 작품 상세가 단일 화면으로 표시되며 공개 회차 격자가 응답의 번호·가격을 따른다. 유료 회차는 잠금 아이콘과 포인트를 함께 표시한다. 홈 최신·장르·검색·추천에서 임시 작품이 보이지 않고, 삭제한 체험 화면으로 향하는 이동이 남지 않는다.

## 승인 및 실행 상태

- 범위 승인: 임시 세 작품 및 전용 체험 흐름 제거, API 상세 화면 통합, 기존 네모 회차 UI 적용.
- task 구성 승인: `task-1`과 `task-2` 병렬, 이후 `task-3`, 마지막 `task-4`; 각 task의 정확한 파일 범위와 검증 명령.
- `task-1`~`task-4`가 모두 완료됐다. 임시 이미지 폴더는 사용자가 삭제했고, `task-4`의 선언된 검증 명령은 다시 통과했다.
