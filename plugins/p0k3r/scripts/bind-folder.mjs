#!/usr/bin/env node
/**
 * PostToolUse do headsup_entrar: a pasta em que a mão foi aberta passa a ser a
 * pasta daquela mesa. É ela que o clique no P0K3R (`p0k3r://`) abre depois.
 */
import { bindTable, readStdinJson, runIfMain } from './lib.mjs';

/** Id da mesa na resposta do headsup_entrar (texto JSON dentro do resultado MCP). */
export function tableIdFromResponse(response) {
  const blocks = Array.isArray(response) ? response : (response?.content ?? [response]);
  for (const block of blocks) {
    const text = typeof block === 'string' ? block : block?.text;
    if (typeof text !== 'string') continue;
    try {
      const id = Number(JSON.parse(text)?.table?.id);
      if (Number.isInteger(id) && id > 0) return id;
    } catch {
      // resultado de erro (texto puro) — nada a ligar
    }
  }
  return null;
}

async function main() {
  const input = await readStdinJson();
  const tableId = tableIdFromResponse(input.tool_response);
  if (tableId === null || !input.cwd) return;
  await bindTable(tableId, input.cwd);
}

runIfMain(import.meta.url, main);
