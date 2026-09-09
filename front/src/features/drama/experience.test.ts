/// <reference types="node" />

import assert from 'node:assert/strict';
import { test } from 'node:test';
import { getDrama } from './catalog';
import {
  credit,
  initialExperience,
  isEpisodeOpen,
  readExperience,
  recordProgress,
  remainingAds,
  setPreference,
  today,
  toggleSaved,
  unlock,
} from './experience';

const day = new Date(2026, 8, 9, 12);
const nextDay = new Date(2026, 8, 10, 12);

test('free episodes stay free and unknown drama IDs never become another drama', () => {
  const state = initialExperience(day);
  assert.equal(getDrama('missing'), undefined);
  assert.deepEqual(unlock(state, 'signal', 7, day), { state, ok: true });
  assert.deepEqual(unlock(state, 'season', 10, day), { state, ok: true });
  assert.deepEqual(unlock(state, 'missing', 1, day), { state, ok: false });
  assert.equal(state.balance, 4);
  assert.equal(state.ledger.length, 0);
});

test('insufficient balance and invalid episode inputs do not spend points', () => {
  const state = initialExperience(day);
  for (const ep of [0, -1, 1.5, 37, NaN, Infinity, 8]) {
    assert.deepEqual(unlock(state, 'signal', ep, day), { state, ok: false });
  }
  assert.equal(isEpisodeOpen(state, 'signal', 0), false);
  assert.equal(isEpisodeOpen(state, 'signal', 8), false);
});

test('one ad opens one paid episode and repeat unlocks do not charge again', () => {
  const start = initialExperience(day);
  const credited = credit(start, 'ad', 10, day);
  const first = unlock(credited, 'signal', 8, day);
  assert.equal(credited.balance, 14);
  assert.equal(first.ok, true);
  assert.equal(first.state.balance, 4);
  assert.deepEqual(first.state.opened, ['signal:8']);
  assert.deepEqual(first.state.ledger.map((entry) => entry.amount), [-10, 10]);
  assert.notEqual(first.state.ledger[0].id, first.state.ledger[1].id);
  assert.equal(unlock(first.state, 'signal', 8, day).state, first.state);
  assert.equal(unlock(first.state, 'signal', 9, day).ok, false);
  assert.equal(start.balance, 4);
  assert.equal(start.opened.length, 0);
});

test('reward cap is five per local day and resets on the next day', () => {
  let state = initialExperience(day);
  for (let count = 0; count < 5; count++) state = credit(state, 'ad', 10, day);
  assert.equal(state.balance, 54);
  assert.equal(state.ads, 5);
  assert.equal(remainingAds(state, day), 0);
  assert.equal(credit(state, 'ad', 10, day), state);
  assert.equal(remainingAds(state, nextDay), 5);
  const reset = credit(state, 'ad', 10, nextDay);
  assert.equal(reset.balance, 64);
  assert.equal(reset.ads, 1);
  assert.equal(reset.adDay, today(nextDay));
  assert.equal(readExperience(JSON.stringify(state), nextDay).ads, 0);
});

test('only documented reward and pack amounts can add points', () => {
  const state = initialExperience(day);
  for (const amount of [0, -100, 10, 99, 100.5, NaN, Infinity]) {
    assert.equal(credit(state, 'pack', amount, day), state);
  }
  assert.equal(credit(state, 'ad', 100, day), state);
  for (const amount of [100, 300, 600]) {
    assert.equal(credit(state, 'pack', amount, day).balance, 4 + amount);
  }
  assert.equal(credit({ ...state, balance: Number.MAX_SAFE_INTEGER }, 'pack', 100, day).balance, Number.MAX_SAFE_INTEGER);
});

test('broken storage falls back safely and ignores fields outside the schema', () => {
  const base = initialExperience(day);
  for (const raw of [null, '{', 'null', '[]', '{}', JSON.stringify({ ...base, balance: -1 })]) {
    assert.deepEqual(readExperience(raw, day), base);
  }
  const restored = readExperience(JSON.stringify({
    ...base,
    balance: 24,
    saved: ['signal', 'unknown', null, 'signal'],
    opened: ['signal:8', 'signal:8:extra', 'signal:08', 'unknown:1', 'moon:99', 'signal:8'],
    history: [
      null,
      { id: 'signal', ep: 8, time: 32 },
      { id: 'signal', ep: 7, time: 4 },
      { id: 'season', ep: 11, time: 2 },
      { id: 'moon', ep: 1, time: 61 },
    ],
    ledger: [null, { id: 'entry', label: '광고 보상 체험', amount: 10, at: day.toISOString() }, { id: 'broken', amount: 1 }],
    ads: 99,
    captions: 'false',
    autoNext: false,
    extra: 'discard',
  }), day);
  assert.deepEqual(restored.saved, ['signal']);
  assert.deepEqual(restored.opened, ['signal:8']);
  assert.deepEqual(restored.history, [{ id: 'signal', ep: 8, time: 32 }]);
  assert.equal(restored.ledger.length, 1);
  assert.equal(restored.ads, 5);
  assert.equal(restored.captions, true);
  assert.equal(restored.autoNext, false);
  assert.equal('extra' in restored, false);
});

test('progress updates one entry per drama and rejects locked or invalid episodes', () => {
  const base = initialExperience(day);
  const first = recordProgress(base, 'signal', 1, 14);
  const second = recordProgress(first, 'season', 2, 22);
  const resumed = recordProgress(second, 'signal', 2, 65);
  assert.deepEqual(resumed.history, [
    { id: 'signal', ep: 2, time: 60 },
    { id: 'season', ep: 2, time: 22 },
  ]);
  assert.equal(recordProgress(resumed, 'signal', 2, 60), resumed);
  for (const [id, ep, time] of [['missing', 1, 1], ['signal', 8, 0], ['signal', 37, 0], ['signal', 1, NaN]] as const) {
    assert.equal(recordProgress(resumed, id, ep, time), resumed);
  }
  assert.equal(base.history.length, 0);
});

test('saved dramas and preferences survive a storage round trip', () => {
  const base = initialExperience(day);
  const saved = toggleSaved(base, 'moon');
  const state = setPreference(saved, 'captions', false);
  assert.deepEqual(readExperience(JSON.stringify(state), day), state);
  assert.equal(toggleSaved(state, 'missing'), state);
  assert.deepEqual(toggleSaved(state, 'moon').saved, []);
  assert.equal(setPreference(state, 'captions', false), state);
});
