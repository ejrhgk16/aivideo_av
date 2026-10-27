# plan-28-episode-dialog-dismissal

## 목표

회차 구매 팝업의 닫힘 애니메이션 동안 표시 내용을 유지하고, 구매 성공 후 팝업이 사라진 다음 호출 화면의 onPurchased를 실행한다. 일반 닫기는 이동 없이 종료한다.

## 승인된 범위와 원인

- 현재 episode가 null이 되면 canPurchase가 false가 되어 안내와 버튼이 충전 상태로 바뀐다. 회차 번호와 가격만 보존하는 기존 수정으로는 충분하지 않다.
- 현재 구매 성공은 onClose 직후 onPurchased를 같은 흐름에서 실행해 fade 완료를 기다리지 않는다.
- 공통 팝업에서 표시값 보존과 닫힘 완료 순서를 함께 수정한다. 구매 API, UserProvider, 네 호출 화면의 push/replace 정책은 유지한다.
- 새 패키지, 범용 모달 프레임워크, 구매 오류 정책 변경, 백엔드 변경은 범위 밖이다. 기존 components 책임을 유지하므로 아키텍처 문서 변경은 없다.
- 웹·Android·iOS를 대상으로 한다. onDismiss만으로 모든 플랫폼의 fade 완료를 처리한다고 가정하지 않는다. 기존 Animated로 opacity를 제어하고 실제 완료 이벤트를 사용한다. 고정 시간 후 이동하는 setTimeout은 사용하지 않는다.

## Task

| 번호 | 이름 | 대상 파일 | 핵심 작업 요약 |
| --- | --- | --- | --- |
| 1 | 회차 팝업 닫힘 수명주기와 회귀 테스트 | `front/src/components/EpisodeUnlockDialog.tsx`, `front/tests/unit/episodeUnlockDialog.test.ts`, `front/scripts/test-front.cjs` | 표시 보존, fade 완료 후 이동, 중복/취소 방지 및 기본 테스트 등록 |

## 실행 순서 및 병렬 작업

- task-1은 선행 의존성 없는 단일 task다. 표시 상태와 완료 콜백을 같은 컴포넌트에서 다루므로 나누지 않는다. 병렬 실행할 다른 task는 없다.

## 검증

```text
npm --prefix front run typecheck
npm --prefix front run test
npm --prefix front run export
```

회귀 테스트는 실제 컴포넌트의 이벤트와 렌더 결과를 대상으로 하며 애니메이션 완료를 수동 제어한다. 닫힘 전후 텍스트, 완료 전 콜백 미실행, 일반 닫기의 이동 없음, 성공 콜백 한 번 실행, 중복 입력 및 중단된 애니메이션을 확인한다. 테스트 자체가 닫힘 로직을 복제하거나 소스 문자열 검색만 하는 방식은 사용하지 않는다.

실제 화면 검증은 기존 http://localhost:8081 및 http://localhost:3000의 HTTP 응답을 먼저 확인한 뒤 수행한다. 서버를 자동 실행하거나 포트를 바꾸지 않는다. 서버가 없으면 검증 실패 및 아래 실행 안내를 보고한다.

```text
npm --prefix front run start -- --port 8081
npm --prefix back run start:dev
```

일반 닫기 두 버튼 및 Android 뒤로 가기, 구매 성공 후 닫힘과 재생 순서, 버튼·안내·회차·가격·잔액·오류 유지, 닫은 후 재오픈을 확인한다. 기존 상세·추천 push 및 프리뷰·회차 replace 회귀도 확인한다. 실제 구매는 개발 포인트·권한을 변경할 수 있으며 기존 사용 가능한 데이터를 사용한다. DB 초기화·시드 재실행은 계획하지 않는다. 브라우저/기기/데이터가 없으면 해당 실제 동작을 미검증으로 명시하고 자동 테스트와 구분한다.

## 검증 결과

- 계획 생성 단계: 제품 코드 수정 및 제품 검증은 수행하지 않았다.
