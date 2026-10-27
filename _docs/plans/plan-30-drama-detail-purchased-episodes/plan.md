# plan-30-drama-detail-purchased-episodes

## 목표

드라마 상세 회차 목록에서 무료 여부와 유료 회차 구매 여부를 분리하여 표시하고 클릭 동작을 결정한다.

| 상태 | 박스 하단 | 클릭 |
| --- | --- | --- |
| 무료 (`pricePoints === 0`) | 무료 | 바로 재생 |
| 유료·구매 완료 (`isUnlocked === true`) | 가격 표시 없음 | 바로 재생 |
| 유료·미구매 (`isUnlocked === false`) | 포인트 가격 | 기존 구매 다이얼로그 |

## 범위와 가정

- 사용자 승인: 범위 및 단일 task 구조 승인 완료.
- 기존 상세 API의 선택적 `userUuid`와 회차별 `isUnlocked`를 사용한다. `isUnlocked`는 무료 회차도 true이므로 무료 판정을 먼저 수행한다.
- 프론트 API 호출·타입, 상세 화면, 관련 회귀 테스트 및 테스트 실행 목록을 수정한다.
- 로그인 사용자 UUID를 전달하고 사용자 변경 시 재조회한다. 비로그인 요청에는 사용자 UUID를 넣지 않는다.
- 상세 화면에서 구매 성공 시 해당 회차의 로컬 권한을 갱신하여 재생 후 돌아와도 구매 안내가 반복되지 않게 한다.
- 구매한 유료 회차의 접근성 안내에서도 가격을 제거한다. 별도 구매 완료 문구나 배지는 추가하지 않는다.

## 비목표

백엔드 REST 동작·API 문서·DB·공통 구매 다이얼로그·다른 화면의 동작·디렉터리 책임 변경은 포함하지 않는다. 다른 호출자의 기존 `getDramaContent(dramaId)` 호출은 유지한다. `web-prototype/`은 대상이 아니다.

## Task

| 번호 | 이름 | 대상 파일 | 핵심 작업 요약 |
| --- | --- | --- | --- |
| 1 | 상세 화면의 무료·구매 권한 구분 | `front/src/features/drama/dramaContent.ts`, `front/src/screens/DramaDetailScreen.tsx`, `front/tests/unit/dramaContent.test.ts`, `front/tests/unit/dramaDetailScreen.test.ts`, `front/scripts/test-front.cjs` | 사용자별 권한 조회, 무료·구매·미구매 분기, 구매 직후 상태 갱신과 회귀 테스트 |

## 실행 순서 및 병렬 작업

- `task-1`은 선행 의존성이 없다 (`depends_on: []`). API 타입·호출과 화면·테스트가 동일한 동작을 검증하므로 하나의 task로 실행한다. 별도 병렬 task는 없다.
- 실행은 `dev`에서 수행하고 branch/worktree를 생성하지 않는다.

## 검증

- `npm --prefix front run typecheck`
- `npm --prefix front run test`
- `npm --prefix front run export`
- 요청 URL과 응답 권한, 화면 표시·접근성·클릭, 로그인 사용자 변경 및 구매 후 재클릭을 자동 테스트로 검증한다.
- 서버를 필요로 하는 수동 확인을 추가한다면 기존 프론트 8081·백엔드 3000을 사용한다. 연결 실패는 실패로 보고하며 자동 실행·대체 포트를 사용하지 않는다. 실행 안내는 `npm --prefix front run start -- --port 8081`, `npm --prefix back run start:dev`다.

## 검증 결과

계획 생성 단계다. 제품 코드는 수정하지 않았으며 제품 검증은 task 실행 시 수행한다.
