import assert from 'node:assert/strict';
import { test } from 'node:test';
import { findOpenedHandId, pluginConfig, spokenOnly } from '../plugins/p0k3r/scripts/lib.mjs';

const call = (name, input) =>
  JSON.stringify({ type: 'assistant', message: { content: [{ type: 'tool_use', name, input }] } });

test('acha a última mão aberta pelo MCP do plugin', () => {
  const jsonl = [
    JSON.stringify({ type: 'user', message: { content: 'abre a mão' } }),
    call('mcp__plugin_p0k3r_p0k3r__open_hand', { handId: 10 }),
    call('mcp__plugin_p0k3r_p0k3r__get_timeline', { handId: 10 }),
    call('mcp__plugin_p0k3r_p0k3r__open_hand', { handId: 12 }),
  ].join('\n');
  assert.equal(findOpenedHandId(jsonl), 12);
});

test('reconhece headsup_entrar, o nome do toolkit original', () => {
  assert.equal(findOpenedHandId(call('mcp__plugin_p0k3r_p0k3r__headsup_entrar', { handId: 21 })), 21);
});

test('também reconhece o MCP adicionado à mão (claude mcp add)', () => {
  assert.equal(findOpenedHandId(call('mcp__p0k3r__open_hand', { handId: 7 })), 7);
});

test('sessão sem mão do P0K3R não envia nada', () => {
  const jsonl = [call('mcp__outro__open_hand_x', { handId: 3 }), '{quebrado'].join('\n');
  assert.equal(findOpenedHandId(jsonl), null);
});

test('configuração vem das opções do plugin, com padrão de produção', () => {
  assert.deepEqual(pluginConfig({ CLAUDE_PLUGIN_OPTION_TOKEN: 't' }), {
    apiUrl: 'https://house.p0k3r.com.br',
    token: 't',
  });
  assert.deepEqual(
    pluginConfig({ CLAUDE_PLUGIN_OPTION_API_URL: 'http://localhost:3334/', P0K3R_TOKEN: 'x' }),
    { apiUrl: 'http://localhost:3334', token: 'x' }
  );
});

test('envia só as falas: resultado de ferramenta e meta ficam de fora', () => {
  const jsonl = [
    JSON.stringify({ type: 'user', timestamp: 't1', message: { content: 'lê o .env' } }),
    JSON.stringify({
      type: 'assistant',
      timestamp: 't2',
      message: { content: [{ type: 'text', text: 'Lendo.' }, { type: 'tool_use', name: 'Read', input: {} }] },
    }),
    JSON.stringify({
      type: 'user',
      timestamp: 't3',
      message: { content: [{ type: 'tool_result', content: 'DB_PASSWORD=segredo' }] },
    }),
    JSON.stringify({ type: 'user', isMeta: true, message: { content: 'meta' } }),
    JSON.stringify({ type: 'system', message: { content: 'x' } }),
  ].join('\n');
  const out = spokenOnly(jsonl);
  assert.doesNotMatch(out, /segredo|tool_use|meta/);
  const lines = out.split('\n').map((line) => JSON.parse(line));
  assert.deepEqual(
    lines.map((line) => [line.type, line.message.content]),
    [
      ['user', 'lê o .env'],
      ['assistant', 'Lendo.'],
    ]
  );
});
