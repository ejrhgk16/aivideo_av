# plan-27-front-episode-purchase

## 목표

공통 EpisodeUnlockDialog에서 로그인 사용자의 보유 포인트가 회차 가격 이상이면 구매하기를 표시하고 기존 구매 API를 호출한다. 구매 성공 후 응답의 availablePoints로 User Context를 갱신하고, 팝업을 닫은 뒤 호출 화면의 성공 콜백으로 구매 회차를 즉시 재생한다.

## 승인된 범위와 가정

- 조건은 `user !== null && points !== null && episode.pricePoints <= points`다. 가격과 잔액이 같은 경우에도 구매할 수 있다.
- 잔액 부족 또는 비로그인/잔액 미확인 상태는 기존 포인트 충전하기 동작을 유지한다. 새 로그인 흐름을 만들지 않는다.
- 구매 버튼, API 호출, 중복 요청 방지, 오류 표시, Context 잔액 갱신은 공통 팝업에서 처리한다.
- 팝업은 `onPurchased(episode)` 성공 콜백을 제공한다. 상세·추천은 `router.push`, 프리뷰·회차 재생은 `router.replace`로 이동한다.
- 기존 구매 API의 userUuid는 Context 사용자 UUID, episodeUuid는 선택 회차 UUID를 사용한다. body 없이 POST한다.
- 잔액을 프론트에서 계산해 차감하지 않고 API의 availablePoints를 사용한다. 이미 구매한 회차의 chargedPoints가 0인 성공 응답도 같은 방식으로 처리한다.
- 구매와 signed URL 발급은 분리한다. 기존 재생 화면의 GET playback 요청과 자동 재생을 사용한다. 구매 성공 후 재생 실패는 구매 실패로 취급하거나 잔액을 되돌리지 않는다.
- 구매 요청 중 중복 클릭과 팝업 닫기를 막는다. 실패 시 팝업을 유지하고 오류를 표시하며, 성공 콜백과 Context 잔액 갱신을 실행하지 않는다.
- 기존 닫힘 애니메이션 중 회차 번호·가격이 사라지는 문제의 수정은 유지한다.

## 비목표와 영향 레이어

프론트 features의 구매 HTTP 함수, 공통 팝업, 화면의 이동 콜백, 프론트 테스트만 변경한다. 백엔드 endpoint·API 계약·DB·시드·인증·재생 권한 검사는 변경하지 않는다. 구매 이력 조회·소유 회차 캐시·실제 포인트 충전 기능은 추가하지 않는다. 디렉터리 책임은 기존 ARCHITECTURE 기준을 따르며 구조 변경은 없다.

## Task

| 번호 | 이름 | 대상 파일 | 핵심 작업 요약 |
| --- | --- | --- | --- |
| 1 | 회차 구매 요청과 테스트 | `front/src/features/economy/episodePurchase.ts`, `front/tests/unit/episodePurchase.test.ts`, `front/scripts/test-front.cjs` | 기존 API 계약에 맞는 POST 함수·응답 타입·오류 처리 및 테스트 등록 |
| 2 | 공통 구매 팝업과 화면별 재생 이동 | `front/src/components/EpisodeUnlockDialog.tsx`, `front/src/screens/DramaDetailScreen.tsx`, `front/src/screens/RecommendationScreen.tsx`, `front/src/screens/playbackScreen_preview.tsx`, `front/src/screens/playbackScreen_episode.tsx` | 구매 조건·중복 방지·오류·Context 갱신과 네 화면의 성공 콜백 연결 |

## 실행 순서 및 병렬 작업

- task-1은 선행 의존성이 없으며 먼저 단독 실행한다.
- task-2는 task-1 완료 후 실행한다. 파일은 겹치지 않지만 task-1에서 만드는 구매 함수와 오류 타입을 사용하므로 병렬 실행하지 않는다.

## 검증

각 task의 checks는 아래 세 명령이다.

```text
npm --prefix front run typecheck
npm --prefix front run test
npm --prefix front run export
```

task-1은 fetch 모킹으로 정확한 POST 경로·빈 body·응답·HTTP/네트워크 실패를 검증한다. task-2는 실행 중인 `http://localhost:8081`과 `http://localhost:3000`을 사용해 실제 구매와 화면 이동을 확인하고 결과를 기록한다. 서버 연결은 HTTP 요청으로 확인하며 자동 실행하거나 포트를 바꾸지 않는다. 서버가 없으면 해당 검증은 실패로 기록하고 아래 실행 명령을 안내한다.

```text
npm --prefix front run start -- --port 8081
npm --prefix back run start:dev
```

가격 미만·동일·초과 잔액, 비로그인, 구매 성공 후 Context 및 화면 잔액 일치, 중복 클릭 방지, 구매 실패 시 잔액/경로 유지, 네 진입점의 성공 후 올바른 회차·작품 전달과 재생, 상세에서 뒤로 가기 복귀, 프리뷰·회차의 replace, 닫기 시 회차 텍스트 유지를 확인한다. 기존 개발 사용자·공개 유료 회차·영상 및 충분한 포인트가 필요하다. 실제 성공 구매는 개발 DB 포인트·원장·권한을 변경한다. 검증용 DB 초기화나 시드 재실행은 계획하지 않는다. 데이터가 부족하거나 화면 검증 도구가 없으면 미검증 사유를 명시하며 통과로 보고하지 않는다.

## 검증 결과

- 계획 생성 단계: 제품 코드 수정 및 제품 검증은 아직 수행하지 않았다.
