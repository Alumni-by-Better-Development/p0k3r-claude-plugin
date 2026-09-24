#!/usr/bin/env node
/**
 * Manipulador do `p0k3r://abrir-mao?mao=<id>&mesa=<id>`, chamado pelo sistema
 * operacional quando alguém clica em "Abrir no Claude Code" na mão.
 *
 * Abre um terminal na pasta ligada àquela mesa (se ainda não houver, pergunta
 * qual) e roda `claude "/p0k3r:abrir-mao <id>"`. Qualquer site pode chamar um
 * `p0k3r://`, então só números passam do link para o comando — a pasta vem
 * sempre do que a pessoa escolheu.
 */
import { spawn, spawnSync } from 'node:child_process';
import { appendFile, mkdir, stat } from 'node:fs/promises';
import { join } from 'node:path';
import { bindTable, p0k3rHome, readBindings, runIfMain } from './lib.mjs';

const PICK_PROMPT = 'P0K3R: escolha a pasta do projeto desta mesa heads-up';

/** `{ handId, tableId }` de um link válido, ou `null`. */
export function parseLaunchUrl(raw) {
  let url;
  try {
    url = new URL(raw);
  } catch {
    return null;
  }
  if (url.protocol !== 'p0k3r:' || url.hostname !== 'abrir-mao') return null;
  const hand = url.searchParams.get('mao') ?? '';
  const table = url.searchParams.get('mesa') ?? '';
  if (!/^\d{1,10}$/.test(hand) || !/^\d{1,10}$/.test(table)) return null;
  return { handId: Number(hand), tableId: Number(table) };
}

const appleString = (value) => `"${value.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`;
const shellQuote = (value) => `'${value.replace(/'/g, `'\\''`)}'`;

/** Como abrir o terminal com o Claude Code na pasta, por sistema. */
export function launchSpec(platform, cwd, handId, { windowsTerminal = false } = {}) {
  const claude = `claude "/p0k3r:abrir-mao ${handId}"`;
  if (platform === 'darwin') {
    const script = `do script "cd " & quoted form of ${appleString(cwd)} & " && claude '/p0k3r:abrir-mao ${handId}'"`;
    return {
      file: 'osascript',
      args: ['-e', 'tell application "Terminal"', '-e', 'activate', '-e', script, '-e', 'end tell'],
    };
  }
  if (platform === 'win32') {
    const line = windowsTerminal
      ? `start "" wt.exe -d "${cwd}" cmd /k ${claude}`
      : `start "P0K3R" /D "${cwd}" cmd /k ${claude}`;
    return { file: line, args: [], shell: true };
  }
  return {
    file: 'x-terminal-emulator',
    args: ['-e', 'bash', '-lc', `cd ${shellQuote(cwd)} && claude '/p0k3r:abrir-mao ${handId}'; exec bash`],
  };
}

/** Janela nativa de "escolher pasta", por sistema. */
export function pickFolderSpec(platform) {
  if (platform === 'darwin') {
    return {
      file: 'osascript',
      args: ['-e', `POSIX path of (choose folder with prompt ${appleString(PICK_PROMPT)})`],
    };
  }
  if (platform === 'win32') {
    const ps = [
      'Add-Type -AssemblyName System.Windows.Forms',
      '$d = New-Object System.Windows.Forms.FolderBrowserDialog',
      `$d.Description = '${PICK_PROMPT}'`,
      "if ($d.ShowDialog() -eq 'OK') { $d.SelectedPath }",
    ].join('; ');
    return { file: 'powershell.exe', args: ['-NoProfile', '-STA', '-Command', ps] };
  }
  return {
    file: 'zenity',
    args: ['--file-selection', '--directory', `--title=${PICK_PROMPT}`],
  };
}

function hasWindowsTerminal() {
  return spawnSync('where', ['wt.exe'], { stdio: 'ignore', shell: true }).status === 0;
}

async function isDirectory(path) {
  try {
    return (await stat(path)).isDirectory();
  } catch {
    return false;
  }
}

async function log(message) {
  const home = p0k3rHome();
  await mkdir(home, { recursive: true });
  await appendFile(join(home, 'handler.log'), `${new Date().toISOString()} ${message}\n`);
}

async function main() {
  const target = parseLaunchUrl(process.argv[2] ?? '');
  if (!target) {
    await log(`link ignorado: ${JSON.stringify(process.argv[2] ?? '')}`);
    return;
  }

  const bindings = await readBindings();
  let cwd = bindings[String(target.tableId)]?.cwd;
  if (!cwd || !(await isDirectory(cwd))) {
    const pick = pickFolderSpec(process.platform);
    const picked = spawnSync(pick.file, pick.args, { encoding: 'utf8' });
    cwd = (picked.stdout ?? '').trim().replace(/\/$/, '');
    if (!cwd || !(await isDirectory(cwd))) {
      await log(`mesa ${target.tableId}: nenhuma pasta escolhida`);
      return;
    }
    await bindTable(target.tableId, cwd);
  }

  const spec = launchSpec(process.platform, cwd, target.handId, {
    windowsTerminal: process.platform === 'win32' && hasWindowsTerminal(),
  });
  if (process.env.P0K3R_DRY_RUN) {
    console.log(JSON.stringify({ cwd, ...spec }));
    return;
  }
  const child = spawn(spec.file, spec.args, {
    detached: true,
    stdio: 'ignore',
    shell: spec.shell ?? false,
  });
  child.unref();
  await log(`mão ${target.handId} (mesa ${target.tableId}) aberta em ${cwd}`);
}

runIfMain(import.meta.url, main);
