#!/usr/bin/env node
/**
 * Registra o `p0k3r://` neste computador, para o botão "Abrir no Claude Code"
 * da mão funcionar com um clique. Só mexe na conta do usuário, sem
 * administrador:
 *  - Windows: chave em HKCU\Software\Classes\p0k3r;
 *  - macOS: app invisível "P0K3R Launcher" em ~/Applications;
 *  - Linux: entrada .desktop em ~/.local/share/applications.
 *
 * O manipulador é copiado para ~/.p0k3r/bin (o caminho do plugin muda a cada
 * atualização). `--remove` desfaz tudo.
 */
import { spawnSync } from 'node:child_process';
import { copyFile, mkdir, rm, writeFile } from 'node:fs/promises';
import { homedir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { p0k3rHome, runIfMain } from './lib.mjs';

const WINDOWS_KEY = 'HKCU\\Software\\Classes\\p0k3r';
const MAC_APP = join(homedir(), 'Applications', 'P0K3R Launcher.app');
const LINUX_DESKTOP = join(homedir(), '.local', 'share', 'applications', 'p0k3r-launcher.desktop');
const LSREGISTER =
  '/System/Library/Frameworks/CoreServices.framework/Frameworks/LaunchServices.framework/Support/lsregister';

const appleString = (value) => `"${value.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`;

/** Comandos `reg add` do Windows (HKCU, sem administrador). */
export function windowsRegCommands(node, handler) {
  return [
    ['add', WINDOWS_KEY, '/ve', '/d', 'URL:P0K3R', '/f'],
    ['add', WINDOWS_KEY, '/v', 'URL Protocol', '/d', '', '/f'],
    ['add', `${WINDOWS_KEY}\\shell\\open\\command`, '/ve', '/d', `"${node}" "${handler}" "%1"`, '/f'],
  ];
}

/** AppleScript do app do macOS: recebe o link e chama o manipulador. */
export function macAppleScript(node, handler) {
  return [
    'on open location theURL',
    `\tdo shell script quoted form of ${appleString(node)} & " " & quoted form of ${appleString(handler)} & " " & quoted form of theURL & " >/dev/null 2>&1 &"`,
    'end open location',
    '',
    'on run',
    'end run',
    '',
  ].join('\n');
}

/** Entrada .desktop do Linux para o esquema `x-scheme-handler/p0k3r`. */
export function linuxDesktopEntry(node, handler, icon) {
  return [
    '[Desktop Entry]',
    'Type=Application',
    'Name=P0K3R Launcher',
    `Exec="${node}" "${handler}" %u`,
    ...(icon ? [`Icon=${icon}`] : []),
    'NoDisplay=true',
    'MimeType=x-scheme-handler/p0k3r;',
    '',
  ].join('\n');
}

function run(file, args) {
  const result = spawnSync(file, args, { encoding: 'utf8' });
  if (result.status !== 0) {
    throw new Error(`${file} ${args.join(' ')}: ${(result.stderr || result.stdout || '').trim()}`);
  }
}

const ASSETS = join(dirname(fileURLToPath(import.meta.url)), '..', 'assets');

/** Copia o manipulador para ~/.p0k3r/bin e devolve o caminho dele. */
async function installHandler() {
  const here = dirname(fileURLToPath(import.meta.url));
  const bin = join(p0k3rHome(), 'bin');
  await mkdir(bin, { recursive: true });
  for (const file of ['protocol-handler.mjs', 'lib.mjs']) {
    await copyFile(join(here, file), join(bin, file));
  }
  return join(bin, 'protocol-handler.mjs');
}

async function registerMac(node, handler) {
  const source = join(p0k3rHome(), 'launcher.applescript');
  await writeFile(source, macAppleScript(node, handler));
  await rm(MAC_APP, { recursive: true, force: true });
  await mkdir(dirname(MAC_APP), { recursive: true });
  run('osacompile', ['-o', MAC_APP, source]);
  const plist = join(MAC_APP, 'Contents', 'Info.plist');
  const buddy = (command) => run('/usr/libexec/PlistBuddy', ['-c', command, plist]);
  spawnSync('/usr/libexec/PlistBuddy', ['-c', 'Delete :CFBundleIdentifier', plist]);
  buddy('Add :CFBundleIdentifier string br.com.p0k3r.launcher');
  buddy('Add :LSUIElement bool true');
  buddy('Add :CFBundleURLTypes array');
  buddy('Add :CFBundleURLTypes:0 dict');
  buddy('Add :CFBundleURLTypes:0:CFBundleURLName string P0K3R');
  buddy('Add :CFBundleURLTypes:0:CFBundleURLSchemes array');
  buddy('Add :CFBundleURLTypes:0:CFBundleURLSchemes:0 string p0k3r');
  // Ícone do P0K3R: o applet traz um catálogo (Assets.car + CFBundleIconName)
  // que tem prioridade sobre o .icns — sai o catálogo, entra o nosso .icns.
  await copyFile(join(ASSETS, 'P0K3R.icns'), join(MAC_APP, 'Contents', 'Resources', 'applet.icns'));
  await rm(join(MAC_APP, 'Contents', 'Resources', 'Assets.car'), { force: true });
  spawnSync('/usr/libexec/PlistBuddy', ['-c', 'Delete :CFBundleIconName', plist]);
  // Mexer no Info.plist quebra a assinatura do applet; sem reassinar, o macOS
  // recusa abrir ("app danificado").
  run('codesign', ['--force', '--deep', '--sign', '-', MAC_APP]);
  run(LSREGISTER, ['-f', MAC_APP]);
  return MAC_APP;
}

async function registerLinux(node, handler) {
  const icon = join(p0k3rHome(), 'p0k3r.png');
  await copyFile(join(ASSETS, 'p0k3r-256.png'), icon);
  await mkdir(dirname(LINUX_DESKTOP), { recursive: true });
  await writeFile(LINUX_DESKTOP, linuxDesktopEntry(node, handler, icon));
  run('xdg-mime', ['default', 'p0k3r-launcher.desktop', 'x-scheme-handler/p0k3r']);
  return LINUX_DESKTOP;
}

async function register() {
  const node = process.execPath;
  const handler = await installHandler();
  let where;
  if (process.platform === 'win32') {
    for (const args of windowsRegCommands(node, handler)) run('reg', args);
    where = WINDOWS_KEY;
  } else if (process.platform === 'darwin') {
    where = await registerMac(node, handler);
  } else {
    where = await registerLinux(node, handler);
  }
  console.log(`p0k3r:// ativado neste computador (${where}).`);
  console.log(`Manipulador: ${handler}`);
}

async function remove() {
  if (process.platform === 'win32') {
    spawnSync('reg', ['delete', WINDOWS_KEY, '/f'], { stdio: 'ignore' });
  } else if (process.platform === 'darwin') {
    spawnSync(LSREGISTER, ['-u', MAC_APP], { stdio: 'ignore' });
    await rm(MAC_APP, { recursive: true, force: true });
  } else {
    await rm(LINUX_DESKTOP, { force: true });
  }
  await rm(join(p0k3rHome(), 'bin'), { recursive: true, force: true });
  console.log('p0k3r:// removido deste computador.');
}

runIfMain(import.meta.url, () => (process.argv.includes('--remove') ? remove() : register()));
