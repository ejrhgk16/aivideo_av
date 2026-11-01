/// <reference types="node" />

import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createSavedVideoState } from '../../src/features/playback/savedVideoState';

function deferred() {
  let resolve!: () => void;
  let reject!: (error: Error) => void;
  const promise = new Promise<void>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, resolve, reject };
}

test('saved-video state updates only after success and restores the current value on failure', async () => {
  const calls: Array<{ videoUuid: string; nextSaved: boolean }> = [];
  let fail = false;
  const state = createSavedVideoState(async (videoUuid, _contentType, nextSaved) => {
    calls.push({ videoUuid, nextSaved });
    if (fail) throw new Error('network');
  }, () => true);

  const startedRevision = state.getSnapshot().revision;
  assert.equal(await state.toggle('video-1', 'EPISODE', false), true);
  assert.deepEqual(state.getSnapshot().videos['video-1'], { isSaved: true, pending: false });
  assert.equal(state.getSnapshot().revision, startedRevision + 1);

  fail = true;
  await assert.rejects(state.toggle('video-1', 'EPISODE', true), /network/);
  assert.deepEqual(state.getSnapshot().videos['video-1'], { isSaved: true, pending: false });
  assert.equal(state.getSnapshot().revision, startedRevision + 2);
  assert.deepEqual(calls, [
    { videoUuid: 'video-1', nextSaved: true },
    { videoUuid: 'video-1', nextSaved: false },
  ]);
});

test('saved-video state reserves a duplicate toggle synchronously while allowing other videos', async () => {
  const firstWrite = deferred();
  const calls: string[] = [];
  const state = createSavedVideoState(async (videoUuid) => {
    calls.push(videoUuid);
    if (videoUuid === 'video-1') await firstWrite.promise;
  }, () => true);

  const first = state.toggle('video-1', 'PREVIEW', false);
  assert.deepEqual(state.getSnapshot().videos['video-1'], { isSaved: false, pending: true });
  assert.equal(await state.toggle('video-1', 'PREVIEW', false), false);
  assert.equal(await state.toggle('video-2', 'EPISODE', false), true);
  assert.deepEqual(calls, ['video-1', 'video-2']);
  firstWrite.resolve();
  assert.equal(await first, true);
  assert.deepEqual(state.getSnapshot().videos['video-1'], { isSaved: true, pending: false });
});

test('saved-video observations reject stale reads and do not overwrite a pending write', async () => {
  const write = deferred();
  const state = createSavedVideoState(async () => write.promise, () => true);
  const startedRevision = state.getSnapshot().revision;
  assert.equal(state.accept([{ videoUuid: 'video-1', isSaved: true }], startedRevision), true);
  assert.equal(state.getSnapshot().videos['video-1'].isSaved, true);

  const pendingWrite = state.toggle('video-1', 'PREVIEW', true);
  assert.equal(state.accept([{ videoUuid: 'video-1', isSaved: false }], startedRevision), true);
  assert.equal(state.getSnapshot().videos['video-1'].isSaved, true);
  write.resolve();
  await pendingWrite;

  assert.equal(state.accept([{ videoUuid: 'video-1', isSaved: true }], startedRevision), false);
  assert.equal(state.getSnapshot().videos['video-1'].isSaved, false);
});

test('saved-video snapshots are stable until data changes and subscriptions can be removed', () => {
  const state = createSavedVideoState(async () => {}, () => true);
  let updates = 0;
  const unsubscribe = state.subscribe(() => { updates += 1; });
  assert.equal(state.accept([{ videoUuid: 'video-1', isSaved: false }], 0), true);
  const first = state.getSnapshot();
  assert.equal(updates, 1);
  assert.equal(state.getSnapshot(), first);
  assert.equal(state.accept([{ videoUuid: 'video-1', isSaved: false }], 0), true);
  assert.equal(state.getSnapshot(), first);
  assert.equal(updates, 1);
  assert.equal(state.accept([{ videoUuid: 'video-1', isSaved: true }], 0), true);
  assert.notEqual(state.getSnapshot(), first);
  assert.equal(updates, 2);
  unsubscribe();
});

test('saved-video state refuses obsolete observations and writes after its session changes', async () => {
  const response = deferred();
  let current = true;
  const oldState = createSavedVideoState(async () => response.promise, () => current, () => current);
  const oldWrite = oldState.toggle('video-1', 'EPISODE', false);
  current = false;
  assert.equal(oldState.accept([{ videoUuid: 'video-1', isSaved: true }], 0), false);
  response.resolve();
  assert.equal(await oldWrite, false);

  const newState = createSavedVideoState(async () => {}, () => true);
  assert.deepEqual(newState.getSnapshot().videos, {});
});

test('anonymous saved-video state can accept false observations but cannot write', async () => {
  let writes = 0;
  const state = createSavedVideoState(async () => { writes += 1; }, () => true, () => false);
  assert.equal(state.accept([{ videoUuid: 'video-1', isSaved: false }], 0), true);
  assert.deepEqual(state.getSnapshot().videos['video-1'], { isSaved: false, pending: false });
  assert.equal(await state.toggle('video-1', 'PREVIEW', false), false);
  assert.equal(writes, 0);
});
