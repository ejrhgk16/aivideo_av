# 프론트 홈 다중 장르·캠페인·가로 포스터 개선

## 목표
홈 API 작품의 추천 히어로, 추천 포스터, TOP 3에서 모든 장르를 ` · `로 표시하고, 추천 히어로의 터치 스와이프를 지원한다. 삭제했던 중간 로맨스 캠페인 영역을 기존 문구와 버튼으로 복원하되 이미지와 대상 작품은 API 컬렉션에서 가져온다. TOP 3에는 세로 포스터와 별도로 저장된 가로 포스터를 사용한다.

## 범위와 결정
- `task-1`은 완료됐다. 세 영역의 다중 장르 표시, TOP 3 84×118 확대, 추천 히어로 스와이프가 적용됐다.
- 기존 `POSTER`와 `images.poster`/`imageUrls.poster`는 세로형으로 유지한다. 새 `POSTER_LANDSCAPE` 종류와 `posterLandscape` 응답 필드를 추가한다. 값이 없으면 `null`이며 TOP 3 화면에서만 세로 포스터로 대체한다.
- 초기 가로 포스터 DB 레코드는 기존 `HOME_HERO` 파일의 `storageKey`를 참조한다. 이미지 종류와 API 필드는 분리되지만 초기에는 실제 파일을 공유한다. 향후 별도 가로 포스터 파일로 교체할 수 있도록 `poster-landscape` 저장 경로와 개발용 이미지 제공 경로를 지원한다. Git에서 제외된 `front/media/` 바이너리 파일은 이 플랜에서 복사하거나 생성하지 않는다.
- 로맨스 배너용 `HOME_CAMPAIGN` 컬렉션에 로맨스 장르의 기존 시드 작품 한 편을 편성한다. 프론트는 기존 `GET /collections/:code`에 `HOME_CAMPAIGN`을 요청하고 첫 작품의 첫 번째 `campaigns` 이미지를 사용한다. 새 endpoint는 만들지 않는다.
- 배너는 추천 포스터 목록과 TOP 3 사이에 복원한다. 기존 문구 `오늘은, 설레도 괜찮아.`, `퇴근길을 채울 로맨스 한 편`, `로맨스 만나기`와 로맨스 검색 이동을 유지한다. 캠페인 이미지나 작품이 없거나 요청에 실패하면 배너를 숨긴다.
- TOP 3는 `posterLandscape`를 우선 표시하고 세로 `poster`로 대체한다. 이미지는 가로형 비율로 배치하고 작은 화면에서 제목·장르·회차·무료 정보가 읽히게 한다.
- `1분이면, 빠져드는 이야기`의 가로 스크롤과 표시 개수, 무료 회차 문구, 상단 히어로, 최신·장르 탭, 상세 화면 동작은 변경하지 않는다.

## Task

| 번호 | 이름 | 대상 파일 | 핵심 작업 요약 |
| --- | --- | --- | --- |
| 1 | 홈 장르·추천 UI 개선 | 프론트 홈 화면 | 다중 장르, TOP 3 이미지 확대, 히어로 스와이프. 완료 |
| 2 | 가로 포스터 종류와 캠페인 시드 추가 | 백엔드 스키마·시드 | `POSTER_LANDSCAPE` 종류와 마이그레이션, 기존 `homeHero` 경로를 참조하는 초기 가로 포스터, `HOME_CAMPAIGN` 편성 |
| 3 | 가로 포스터 API 응답 연결 | 백엔드 서비스·API 문서 | `posterLandscape` 키·URL 추가, 개발용 이미지 경로 허용, 콘텐츠·컬렉션 계약 갱신 |
| 4 | 홈 캠페인 배너와 TOP 3 가로 이미지 표시 | 프론트 API 타입·홈 화면 | 캠페인 컬렉션 별도 요청, 기존 로맨스 배너 복원, TOP 3 가로 이미지 적용 |

## 실행 순서
- `task-1` 완료 → `task-2` → `task-3` → `task-4`. 백엔드 계약을 먼저 정한 뒤 프론트에서 사용한다.

## 검증
- 백엔드 작업: `npm --prefix back run lint`, `npm --prefix back run test`, `npm --prefix back run build`.
- 프론트 작업: `npm --prefix front run typecheck`, `npm --prefix front run test`, `npm --prefix front run export`.
- 시드 레코드와 API 계약에서 `POSTER_LANDSCAPE`/`posterLandscape` 및 `HOME_CAMPAIGN`을 확인하고, 홈에서 캠페인 이미지와 TOP 3 가로 이미지가 표시되는지 확인한다.
- 실행 결과를 기존 개발 DB에서 보려면 코드 배포 후 새 마이그레이션과 `db:seed`를 실행해야 한다. Harness 검증은 DB 연결 없이 수행한다.

## 검증 결과
- `task-1`: 타입 검사, 테스트 17개, 웹 내보내기 통과.
- `task-2`~`task-4`: 실행 전.
