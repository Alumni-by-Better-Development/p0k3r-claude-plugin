#!/usr/bin/env node
/**
 * SessionEnd do plugin p0k3r: se a sessão abriu uma mão heads-up (chamou a
 * ferramenta open_hand do MCP p0k3r), envia o transcript para essa mão. O
 * P0K3R converte, grava como transcrição e apaga a presença do K0D3. O id da
 * sessão vai junto: uma sessão retomada substitui o transcript, não duplica.
 *
 * Nunca falha a saída do Claude Code: qualquer problema vira aviso no stderr.
 */
import { readFile } from 'node:fs/promises';
import { findOpenedHandId, pluginConfig, readStdinJson, runIfMain } from './lib.mjs';

async function main() {
  const input = await readStdinJson();
  if (!input.transcript_path) return;

  const jsonl = await readFile(input.transcript_path, 'utf8');
  const handId = findOpenedHandId(jsonl);
  if (handId === null) return; // sessão sem mão do P0K3R

  const { apiUrl, token } = pluginConfig(process.env);
  if (!token) {
    console.error('[p0k3r] token não configurado — transcript não enviado.');
    return;
  }

  const form = new FormData();
  if (input.session_id) form.append('sessionId', String(input.session_id));
  form.append(
    'transcript',
    new Blob([jsonl], { type: 'application/x-ndjson' }),
    `claude-code-${input.session_id ?? 'sessao'}.jsonl`
  );
  const res = await fetch(`${apiUrl}/api/v1/mcp/hands/${handId}/transcript`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    body: form,
    signal: AbortSignal.timeout(20_000),
  });
  if (!res.ok) {
    console.error(`[p0k3r] envio do transcript da mão ${handId} falhou: HTTP ${res.status}`);
    return;
  }
  console.error(`[p0k3r] transcript enviado para a mão ${handId}.`);
}

runIfMain(import.meta.url, main);
