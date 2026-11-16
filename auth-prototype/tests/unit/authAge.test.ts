import { ageOn, checkBirthDate, kstToday } from '@/features/auth/authAge';

const today = { year: 2026, month: 11, day: 13 };

test('kstToday uses the Korean date even when UTC is still on the previous day', () => {
  expect(kstToday(new Date('2026-11-12T14:59:59Z'))).toEqual({ year: 2026, month: 11, day: 12 });
  expect(kstToday(new Date('2026-11-12T15:00:00Z'))).toEqual(today);
  expect(kstToday(new Date('2026-12-31T15:00:00Z'))).toEqual({ year: 2027, month: 1, day: 1 });
});

test('ageOn counts full years and turns over on the birthday', () => {
  expect(ageOn({ year: 2012, month: 11, day: 13 }, today)).toBe(14);
  expect(ageOn({ year: 2012, month: 11, day: 14 }, today)).toBe(13);
  expect(ageOn({ year: 2012, month: 12, day: 1 }, today)).toBe(13);
  expect(ageOn({ year: 2026, month: 11, day: 13 }, today)).toBe(0);
  expect(ageOn({ year: 2026, month: 11, day: 14 }, today)).toBe(-1);
});

test('a 2/29 birthday is reached on 3/1 in common years', () => {
  const birth = { year: 2012, month: 2, day: 29 };
  expect(ageOn(birth, { year: 2026, month: 2, day: 28 })).toBe(13);
  expect(ageOn(birth, { year: 2026, month: 3, day: 1 })).toBe(14);
  expect(ageOn(birth, { year: 2028, month: 2, day: 29 })).toBe(16);
});

test('checkBirthDate returns the age for real past dates, accepting single-digit month and day', () => {
  expect(checkBirthDate('2008', '5', '12', today)).toEqual({ ok: true, age: 18 });
  expect(checkBirthDate('2012', '02', '29', today)).toEqual({ ok: true, age: 14 });
  expect(checkBirthDate('2026', '11', '13', today)).toEqual({ ok: true, age: 0 });
  expect(checkBirthDate('1906', '11', '13', today)).toEqual({ ok: true, age: 120 });
  expect(checkBirthDate('1905', '11', '14', today)).toEqual({ ok: true, age: 120 });
});

test('checkBirthDate rejects incomplete, impossible, future and too-old dates', () => {
  const incomplete = { ok: false, error: '연도 4자리와 월, 일을 모두 입력해 주세요.' };
  expect(checkBirthDate('', '', '', today)).toEqual(incomplete);
  expect(checkBirthDate('208', '5', '12', today)).toEqual(incomplete);
  expect(checkBirthDate('2008', '', '12', today)).toEqual(incomplete);

  const impossible = { ok: false, error: '달력에 없는 날짜예요. 다시 확인해 주세요.' };
  for (const [month, day] of [['2', '30'], ['2', '29'], ['4', '31'], ['13', '1'], ['0', '10'], ['5', '0']]) {
    expect(checkBirthDate('2011', month, day, today)).toEqual(impossible);
  }

  expect(checkBirthDate('2026', '11', '14', today)).toEqual({ ok: false, error: '오늘 이후 날짜는 입력할 수 없어요.' });
  expect(checkBirthDate('2030', '01', '01', today)).toEqual({ ok: false, error: '오늘 이후 날짜는 입력할 수 없어요.' });
  expect(checkBirthDate('1905', '11', '13', today)).toEqual({ ok: false, error: '만 120세 이하로 입력해 주세요.' });
  expect(checkBirthDate('0099', '01', '01', today)).toEqual({ ok: false, error: '만 120세 이하로 입력해 주세요.' });
});
