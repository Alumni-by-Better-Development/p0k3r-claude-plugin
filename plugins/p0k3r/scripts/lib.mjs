/** Funções comuns aos hooks e scripts do plugin p0k3r. */
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { homedir } from 'node:os';
import { dirname, join } from 'node:path';
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

export async function readStdinJson() {
  const chunks = [];
  for await (const chunk of process.stdin) chunks.push(chunk);
  return JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}');
}

/** Roda `main` só quando o arquivo é executado direto (não quando importado nos testes). */
export function runIfMain(metaUrl, main) {
  if (metaUrl !== pathToFileURL(process.argv[1] ?? '').href) return;
  main().catch((error) => {
    console.error(`[p0k3r] ${error?.message ?? error}`);
  });
}

/**
 * Pasta local do P0K3R (`~/.p0k3r`): estado dos hooks, as pastas ligadas a
 * cada mesa e o manipulador do `p0k3r://`. Fora da pasta do plugin, que muda
 * de caminho a cada atualização.
 */
export function p0k3rHome(env = process.env) {
  return env.P0K3R_HOME || join(homedir(), '.p0k3r');
}

/** Pasta de projeto ligada a cada mesa heads-up: `{ [tableId]: { cwd, at } }`. */
export function bindingsFile(env = process.env) {
  return join(p0k3rHome(env), 'bindings.json');
}

export async function readBindings(env = process.env) {
  try {
    return JSON.parse(await readFile(bindingsFile(env), 'utf8'));
  } catch {
    return {};
  }
}

export async function bindTable(tableId, cwd, env = process.env) {
  const bindings = await readBindings(env);
  bindings[String(tableId)] = { cwd, at: new Date().toISOString() };
  const file = bindingsFile(env);
  await mkdir(dirname(file), { recursive: true });
  await writeFile(file, JSON.stringify(bindings, null, 2));
}
