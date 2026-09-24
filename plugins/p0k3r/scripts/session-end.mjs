#!/usr/bin/env node
/**
 * SessionEnd do plugin p0k3r: se a sessão abriu uma mão heads-up (chamou a
 * ferramenta open_hand do MCP p0k3r), envia o transcript para essa mão. O
 * P0K3R converte, grava como transcrição e apaga a presença do K0D3.
 *
 * Nunca falha a saída do Claude Code: qualquer problema vira aviso no stderr.
 */
import { readFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';

const DEFAULT_API_URL = 'https://house.p0k3r.com.br';
const OPEN_HAND_TOOL = /^mcp__.*p0k3r.*__open_hand$/;

/** A última mão aberta na sessão, lida das chamadas de ferramenta do transcript. */
export function findOpenedHandId(jsonl) {
  let handId = null;
  for (const line of jsonl.split('\n')) {
    if (!line.includes('open_hand')) continue;
    let entry;
    try {
      entry = JSON.parse(line);
    } catch {
      continue;
    }
    const content = entry?.message?.content;
    if (entry?.type !== 'assistant' || !Array.isArray(content)) continue;
    for (const block of content) {
      if (block?.type !== 'tool_use' || !OPEN_HAND_TOOL.test(String(block.name))) continue;
      const id = Number(block.input?.handId);
      if (Number.isInteger(id) && id > 0) handId = id;
    }
  }
  return handId;
}

/** Opções do plugin chegam como CLAUDE_PLUGIN_OPTION_<CHAVE>. */
export function pluginConfig(env) {
  const option = (key) =>
    env[`CLAUDE_PLUGIN_OPTION_${key.toUpperCase()}`] ?? env[`CLAUDE_PLUGIN_OPTION_${key}`];
  const apiUrl = (option('api_url') || env.P0K3R_API_URL || DEFAULT_API_URL).replace(/\/+$/, '');
  const token = option('token') || env.P0K3R_TOKEN || '';
  return { apiUrl, token };
}

async function readStdin() {
  const chunks = [];
  for await (const chunk of process.stdin) chunks.push(chunk);
  return Buffer.concat(chunks).toString('utf8');
}

async function main() {
  const input = JSON.parse((await readStdin()) || '{}');
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

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  main().catch((error) => {
    console.error(`[p0k3r] transcript não enviado: ${error?.message ?? error}`);
  });
}
