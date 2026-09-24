#!/usr/bin/env node
/**
 * Batimento do plugin p0k3r (UserPromptSubmit e PostToolUse): enquanto a
 * sessão tem uma mão aberta, avisa o P0K3R que o K0D3 continua na mesa — a
 * presença cai sozinha depois de 15 min sem sinal. No máximo um aviso a cada
 * INTERVAL_MS por sessão.
 *
 * Não escreve nada no stdout (o do UserPromptSubmit vira contexto do modelo)
 * e nunca atrasa a sessão além do timeout curto.
 */
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { findOpenedHandId, p0k3rHome, pluginConfig, readStdinJson, runIfMain } from './lib.mjs';

export const INTERVAL_MS = 2 * 60 * 1000;

/** Estado por sessão: a mão encontrada e o último aviso. */
export function stateFile(env, sessionId) {
  const dir = join(p0k3rHome(env), 'state');
  return { dir, file: join(dir, `heartbeat-${String(sessionId).replace(/[^\w-]/g, '')}.json`) };
}

export function isDue(lastPingAt, now) {
  return !lastPingAt || now - lastPingAt >= INTERVAL_MS;
}

async function main() {
  const input = await readStdinJson();
  if (!input.session_id || !input.transcript_path) return;

  const { dir, file } = stateFile(process.env, input.session_id);
  let state = {};
  try {
    state = JSON.parse(await readFile(file, 'utf8'));
  } catch {
    // primeira vez nesta sessão
  }
  const now = Date.now();
  if (!isDue(state.lastPingAt, now)) return;

  const handId = findOpenedHandId(await readFile(input.transcript_path, 'utf8'));
  if (handId === null) return; // sessão sem mão do P0K3R

  const { apiUrl, token } = pluginConfig(process.env);
  if (!token) return;

  await mkdir(dir, { recursive: true });
  await writeFile(file, JSON.stringify({ handId, lastPingAt: now }));
  await fetch(`${apiUrl}/api/v1/mcp/hands/${handId}/heartbeat`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    signal: AbortSignal.timeout(3000),
  });
}

runIfMain(import.meta.url, main);
