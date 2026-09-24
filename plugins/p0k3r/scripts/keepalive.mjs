#!/usr/bin/env node
/**
 * Sinal de fundo do plugin p0k3r. Os hooks só disparam quando há mensagem ou
 * ferramenta; com a sessão parada, a presença do K0D3 cairia em 15 min e a
 * mão mostraria "Abrir no Claude Code" com a sessão aberta.
 *
 * SessionStart roda este script sem argumentos: ele sobe um processo
 * separado (`--loop`) e sai na hora. O processo avisa o P0K3R a cada
 * INTERVAL_MS enquanto a sessão tiver uma mão aberta, e para quando:
 *  - o Claude Code que o iniciou morreu (macOS/Linux);
 *  - o SessionEnd marcou a sessão como encerrada;
 *  - o transcript ficou MAX_IDLE_MS sem mudar, ou passou MAX_RUN_MS.
 */
import { spawn, spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { findOpenedHandId, p0k3rHome, pluginConfig, readStdinJson, runIfMain } from './lib.mjs';

export const INTERVAL_MS = Number(process.env.P0K3R_KEEPALIVE_MS) || 4 * 60 * 1000;
export const MAX_IDLE_MS = 3 * 60 * 60 * 1000;
export const MAX_RUN_MS = 12 * 60 * 60 * 1000;

const safe = (sessionId) => String(sessionId).replace(/[^\w-]/g, '');

export function stateDir(env = process.env) {
  return join(p0k3rHome(env), 'state');
}

/** Marca de sessão encerrada, gravada pelo SessionEnd. */
export function endedMarker(sessionId, env = process.env) {
  return join(stateDir(env), `ended-${safe(sessionId)}`);
}

function pidFile(sessionId, env = process.env) {
  return join(stateDir(env), `keepalive-${safe(sessionId)}.pid`);
}

export function shouldStop({ ended, parentAlive, transcriptIdleMs, runningMs }) {
  return ended || parentAlive === false || transcriptIdleMs > MAX_IDLE_MS || runningMs > MAX_RUN_MS;
}

function isAlive(pid) {
  if (!pid) return null;
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

/** PID do processo `claude` acima deste hook (macOS/Linux); `null` se não achar. */
function claudeAncestor() {
  if (process.platform === 'win32') return null;
  let pid = process.ppid;
  for (let depth = 0; depth < 6 && pid > 1; depth++) {
    const out = spawnSync('ps', ['-o', 'ppid=,comm=', '-p', String(pid)], { encoding: 'utf8' });
    const [ppid, ...comm] = (out.stdout ?? '').trim().split(/\s+/);
    if (/claude/i.test(comm.join(' '))) return pid;
    pid = Number(ppid);
  }
  return null;
}

async function start() {
  const input = await readStdinJson();
  if (!input.session_id || !input.transcript_path) return;
  mkdirSync(stateDir(), { recursive: true });
  // Sessão retomada: a marca do fechamento anterior não vale mais.
  rmSync(endedMarker(input.session_id), { force: true });
  const existing = existsSync(pidFile(input.session_id))
    ? Number(readFileSync(pidFile(input.session_id), 'utf8'))
    : null;
  if (isAlive(existing)) return; // já tem um sinal rodando pra esta sessão

  const child = spawn(
    process.execPath,
    [
      fileURLToPath(import.meta.url),
      '--loop',
      String(input.session_id),
      String(input.transcript_path),
      String(claudeAncestor() ?? 0),
    ],
    { detached: true, stdio: 'ignore', windowsHide: true, env: process.env }
  );
  child.unref();
  writeFileSync(pidFile(input.session_id), String(child.pid));
}

async function loop(sessionId, transcriptPath, parentPid) {
  const startedAt = Date.now();
  const { apiUrl, token } = pluginConfig(process.env);
  for (;;) {
    // O transcript só nasce na primeira mensagem: até lá, conta desde o início.
    const exists = existsSync(transcriptPath);
    const transcriptIdleMs = Date.now() - (exists ? statSync(transcriptPath).mtimeMs : startedAt);
    const stop = shouldStop({
      ended: existsSync(endedMarker(sessionId)),
      parentAlive: isAlive(parentPid),
      transcriptIdleMs,
      runningMs: Date.now() - startedAt,
    });
    if (stop) return;

    const handId = exists ? findOpenedHandId(readFileSync(transcriptPath, 'utf8')) : null;
    if (handId !== null && token) {
      await fetch(`${apiUrl}/api/v1/mcp/hands/${handId}/heartbeat`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        signal: AbortSignal.timeout(10_000),
      }).catch(() => {});
    }
    await new Promise((resolve) => setTimeout(resolve, INTERVAL_MS));
  }
}

runIfMain(import.meta.url, () => {
  const [flag, sessionId, transcriptPath, parentPid] = process.argv.slice(2);
  return flag === '--loop' ? loop(sessionId, transcriptPath, Number(parentPid) || null) : start();
});
