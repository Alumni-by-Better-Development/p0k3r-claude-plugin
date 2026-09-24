import assert from 'node:assert/strict';
import { test } from 'node:test';
import { INTERVAL_MS, isDue, stateFile } from '../plugins/p0k3r/scripts/heartbeat.mjs';

test('avisa no primeiro sinal e depois só a cada intervalo', () => {
  assert.equal(isDue(undefined, 1000), true);
  assert.equal(isDue(1000, 1000 + INTERVAL_MS - 1), false);
  assert.equal(isDue(1000, 1000 + INTERVAL_MS), true);
});

test('estado por sessão fica na pasta de dados do plugin', () => {
  const { dir, file } = stateFile({ CLAUDE_PLUGIN_DATA: '/dados' }, 'abc-123/../x');
  assert.equal(dir, '/dados');
  assert.equal(file, '/dados/heartbeat-abc-123x.json');
});
