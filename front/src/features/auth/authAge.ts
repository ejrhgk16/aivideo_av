/** A calendar date as people write it (month 1-12). */
export type CalendarDate = { year: number; month: number; day: number };

/** Under this 만 나이 a guardian must consent (개인정보 보호법 제22조의2, spec 03 §1-1). */
export const GUARDIAN_CONSENT_AGE = 14;
const MAX_AGE = 120;
const KST_OFFSET_MS = 9 * 60 * 60 * 1000; // Korea has no daylight saving time.

export function kstToday(now: Date): CalendarDate {
  const kst = new Date(now.getTime() + KST_OFFSET_MS);
  return { year: kst.getUTCFullYear(), month: kst.getUTCMonth() + 1, day: kst.getUTCDate() };
}

/** 만 나이. A 2/29 birthday is reached on 3/1 in common years. Negative when birth is after today. */
export function ageOn(birth: CalendarDate, today: CalendarDate): number {
  const beforeBirthday = today.month < birth.month || (today.month === birth.month && today.day < birth.day);
  return today.year - birth.year - (beforeBirthday ? 1 : 0);
}

export type BirthDateCheck = { ok: true; age: number } | { ok: false; error: string };

export function checkBirthDate(year: string, month: string, day: string, today: CalendarDate): BirthDateCheck {
  if (!/^\d{4}$/.test(year) || !/^\d{1,2}$/.test(month) || !/^\d{1,2}$/.test(day)) {
    return { ok: false, error: '연도 4자리와 월, 일을 모두 입력해 주세요.' };
  }
  const birth = { year: Number(year), month: Number(month), day: Number(day) };
  const probe = new Date(0);
  probe.setUTCFullYear(birth.year, birth.month - 1, birth.day); // Rolls 2/30 over to March; unlike Date.UTC, keeps years < 100.
  if (probe.getUTCFullYear() !== birth.year || probe.getUTCMonth() !== birth.month - 1 || probe.getUTCDate() !== birth.day) {
    return { ok: false, error: '달력에 없는 날짜예요. 다시 확인해 주세요.' };
  }
  const age = ageOn(birth, today);
  if (age < 0) return { ok: false, error: '오늘 이후 날짜는 입력할 수 없어요.' };
  if (age > MAX_AGE) return { ok: false, error: `만 ${MAX_AGE}세 이하로 입력해 주세요.` };
  return { ok: true, age };
}
