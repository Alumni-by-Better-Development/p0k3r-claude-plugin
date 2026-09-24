import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  MAX_IDLE_MS,
  MAX_RUN_MS,
  endedMarker,
  shouldStop,
} from '../plugins/p0k3r/scripts/keepalive.mjs';

const running = { ended: false, parentAlive: true, transcriptIdleMs: 0, runningMs: 0 };

test('segue enquanto a sessão existe, mesmo parada', () => {
  assert.equal(shouldStop(running), false);
  assert.equal(shouldStop({ ...running, transcriptIdleMs: 60 * 60 * 1000 }), false);
  assert.equal(shouldStop({ ...running, parentAlive: null }), false); // Windows: sem PID
});

test('para quando a sessão acaba ou some', () => {
  assert.equal(shouldStop({ ...running, ended: true }), true);
  assert.equal(shouldStop({ ...running, parentAlive: false }), true);
  assert.equal(shouldStop({ ...running, transcriptIdleMs: MAX_IDLE_MS + 1 }), true);
  assert.equal(shouldStop({ ...running, runningMs: MAX_RUN_MS + 1 }), true);
});

test('marca de encerramento fica em ~/.p0k3r/state', () => {
  assert.equal(endedMarker('ab/c', { P0K3R_HOME: '/h' }), '/h/state/ended-abc');
});
