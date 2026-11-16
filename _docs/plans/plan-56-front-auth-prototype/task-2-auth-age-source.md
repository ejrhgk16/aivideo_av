# task-2-auth-age-source

## 기본 입력
- 이 task 문서와 index.json의 task-2 항목.
- 컨텍스트로 전달된 적용 지침과 task-1 완료 요약.
- 다른 worker와 같은 저장소를 사용한다. 다른 사람의 변경을 되돌리지 않고 수용한다.

## 읽어야 할 파일
- auth-prototype/src/features/auth/authAge.ts (이식할 순수 함수 전체)

## 필요 시 참고할 문서
- 전달된 프로젝트 지침이 누락되거나 변경됐을 때만 루트 AGENTS.md를 확인한다.
- 구조·파일 책임 판단이 필요할 때만 _docs/ARCHITECTURE.md의 Frontend 및 Documentation and tooling 섹션을 확인한다.
- 아래 계약이 누락되거나 충돌할 때만 plan.md의 AUTH-AGE 섹션을 확인하고 메인에 보고한다. 임의로 계약을 변경하지 않는다.
- 테스트 API/SDK 차이가 있을 때만 설치 패키지 타입 및 적용 스킬의 해당 reference를 확인한다. 이미 전달된 전체 공통 문서를 다시 읽을 필요는 없다.

## 실패 시 참고할 파일
- front/tests/unit/authAge.test.ts (실패한 날짜 시나리오)

## 작업
원본 순수 함수와 타입을 그대로 이식해 AUTH-AGE를 구현한다. 서비스·설정·환경변수·저장소를 추가하지 않는다.

### 역할과 완료 조건
- 역할: 소스 구현 및 검증.
- 선행 task: task-1.
- 수정 허용 files:
- `front/src/features/auth/authAge.ts`
- checks:
```powershell
npm --prefix front run test -- tests/unit/authAge.test.ts
```
- 선언한 checks를 실제 실행·통과하고 결과를 보고해야 완료한다.
- 비목표: OAuth/가입 API·실제 저장·인증 권한·관리자·무관한 설정·공용 runner 변경.
- 먼저 직접 실패한 관련 검사로 수정하고 마지막에 위 선언 검사를 모두 통과한다. 범위 밖 테스트를 수정하거나 기대값을 약화하지 않는다. 결함 발견 시 계약 근거를 메인에 보고하고 공통 reset 절차를 따른다.
- 이 task는 전체 회귀 검사를 선언하지 않는다. 전체 typecheck/test/export는 finish 단계에서 수행한다.

### 적용 계약
아래 발췌의 원본은 plan.md의 동일 ID 섹션이다. 충돌 시 작업을 보류하고 메인에서 일치시킨다.

### AUTH-AGE: 생년월일과 만 나이
정의 담당 task-2, 테스트 소비 task-1, 화면 소비 task-4. 정의 경로 `front/src/features/auth/authAge.ts`. named export:
```ts
export type CalendarDate = { year: number; month: number; day: number };
export type BirthDateCheck = { ok: true; age: number } | { ok: false; error: string };
export const GUARDIAN_CONSENT_AGE = 14;
export function kstToday(now: Date): CalendarDate;
export function ageOn(birth: CalendarDate, today: CalendarDate): number;
export function checkBirthDate(year: string, month: string, day: string, today: CalendarDate): BirthDateCheck;
```
프로토타입의 순수 함수를 이식한다. 월은 1~12. KST 자정에 날짜가 바뀌며 만 나이는 생일 당일 증가한다. 평년의 2/29 생일은 3/1에 증가한다. 연도 4자리, 월·일 1~2자리 숫자만 받는다. 실제 달력 날짜, 미래 여부, 만 120세 이하를 순서대로 검증한다. 오류 문구는 각각 '연도 4자리와 월, 일을 모두 입력해 주세요.', '달력에 없는 날짜예요. 다시 확인해 주세요.', '오늘 이후 날짜는 입력할 수 없어요.', '만 120세 이하로 입력해 주세요.'를 유지한다.
검증 데이터: 기준일 2026-11-13, 2012-11-13은 14세, 2012-11-14는 13세, 1906-11-13은 120세 허용, 1905-11-13은 거부. KST 경계는 2026-11-12T14:59:59Z와 15:00:00Z. tests/unit/authAge.test.ts로 검증한다.

### 반복 작업 위임
불가. 날짜 경계 또는 UI/Router 시나리오의 일관된 판단이 필요하고 기계적 대량 반복이 아니다. 자식 슬롯은 0개이며 worker가 직접 통합·검증한다.

### 주요 로직 코드 또는 변경 예시

```ts
export function kstToday(now: Date): CalendarDate {
  const kst = new Date(now.getTime() + 9 * 60 * 60 * 1000);
  return { year: kst.getUTCFullYear(), month: kst.getUTCMonth() + 1, day: kst.getUTCDate() };
}
export function ageOn(birth: CalendarDate, today: CalendarDate): number {
  const beforeBirthday = today.month < birth.month ||
    (today.month === birth.month && today.day < birth.day);
  return today.year - birth.year - (beforeBirthday ? 1 : 0);
}
export function checkBirthDate(year: string, month: string, day: string, today: CalendarDate): BirthDateCheck {
  if (!/^\d{4}$/.test(year) || !/^\d{1,2}$/.test(month) || !/^\d{1,2}$/.test(day)) {
    return { ok: false, error: '연도 4자리와 월, 일을 모두 입력해 주세요.' };
  }
  const birth = { year: Number(year), month: Number(month), day: Number(day) };
  const probe = new Date(0);
  probe.setUTCFullYear(birth.year, birth.month - 1, birth.day);
  if (probe.getUTCFullYear() !== birth.year || probe.getUTCMonth() !== birth.month - 1 || probe.getUTCDate() !== birth.day) {
    return { ok: false, error: '달력에 없는 날짜예요. 다시 확인해 주세요.' };
  }
  const age = ageOn(birth, today);
  if (age < 0) return { ok: false, error: '오늘 이후 날짜는 입력할 수 없어요.' };
  if (age > 120) return { ok: false, error: '만 120세 이하로 입력해 주세요.' };
  return { ok: true, age };
}
```

