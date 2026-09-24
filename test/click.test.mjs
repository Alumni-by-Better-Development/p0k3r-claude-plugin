import assert from 'node:assert/strict';
import { mkdtemp, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import { tableIdFromResponse } from '../plugins/p0k3r/scripts/bind-folder.mjs';
import { bindTable, readBindings } from '../plugins/p0k3r/scripts/lib.mjs';
import {
  launchSpec,
  parseLaunchUrl,
  pickFolderSpec,
} from '../plugins/p0k3r/scripts/protocol-handler.mjs';
import {
  linuxDesktopEntry,
  macAppleScript,
  windowsRegCommands,
} from '../plugins/p0k3r/scripts/register-protocol.mjs';

test('link válido vira mão + mesa', () => {
  assert.deepEqual(parseLaunchUrl('p0k3r://abrir-mao?mao=1123&mesa=229'), {
    handId: 1123,
    tableId: 229,
  });
});

test('link com qualquer coisa além de números é ignorado', () => {
  for (const url of [
    'p0k3r://abrir-mao?mao=1123',
    'p0k3r://abrir-mao?mao=1;rm -rf ~&mesa=2',
    'p0k3r://abrir-mao?mao=1&mesa=2%22%26calc',
    'p0k3r://outra-coisa?mao=1&mesa=2',
    'https://abrir-mao?mao=1&mesa=2',
    'lixo',
  ]) {
    assert.equal(parseLaunchUrl(url), null, url);
  }
});

test('terminal por sistema, sempre com o comando do plugin', () => {
  const mac = launchSpec('darwin', '/Users/b/meu "projeto"', 7);
  assert.equal(mac.file, 'osascript');
  assert.ok(mac.args.join(' ').includes('quoted form of "/Users/b/meu \\"projeto\\""'));
  assert.ok(mac.args.join(' ').includes("claude '/p0k3r:abrir-mao 7'"));

  const win = launchSpec('win32', 'C:\\Users\\b\\proj', 7);
  assert.equal(win.file, 'start "P0K3R" /D "C:\\Users\\b\\proj" cmd /k claude "/p0k3r:abrir-mao 7"');
  const wt = launchSpec('win32', 'C:\\proj', 7, { windowsTerminal: true });
  assert.equal(wt.file, 'start "" wt.exe -d "C:\\proj" cmd /k claude "/p0k3r:abrir-mao 7"');

  const linux = launchSpec('linux', "/home/b/it's", 7);
  assert.equal(linux.args.at(-1), "cd '/home/b/it'\\''s' && claude '/p0k3r:abrir-mao 7'; exec bash");
});

test('janela de escolher pasta por sistema', () => {
  assert.equal(pickFolderSpec('darwin').file, 'osascript');
  assert.equal(pickFolderSpec('win32').file, 'powershell.exe');
  assert.equal(pickFolderSpec('linux').file, 'zenity');
});

test('registro do protocolo aponta para o manipulador com o link', () => {
  const reg = windowsRegCommands('C:\\node\\node.exe', 'C:\\Users\\b\\.p0k3r\\bin\\protocol-handler.mjs');
  assert.equal(reg[0][1], 'HKCU\\Software\\Classes\\p0k3r');
  assert.deepEqual(reg[1].slice(2, 5), ['/v', 'URL Protocol', '/d']);
  assert.equal(
    reg[2][4],
    '"C:\\node\\node.exe" "C:\\Users\\b\\.p0k3r\\bin\\protocol-handler.mjs" "%1"'
  );
  assert.ok(macAppleScript('/n/node', '/h.mjs').includes('on open location theURL'));
  assert.ok(linuxDesktopEntry('/n/node', '/h.mjs').includes('MimeType=x-scheme-handler/p0k3r;'));
});

test('a pasta fica ligada à mesa aberta', async () => {
  const env = { P0K3R_HOME: await mkdtemp(join(tmpdir(), 'p0k3r-')) };
  await bindTable(229, '/Users/b/proj', env);
  await bindTable(230, '/Users/b/outro', env);
  const bindings = await readBindings(env);
  assert.equal(bindings['229'].cwd, '/Users/b/proj');
  assert.equal(bindings['230'].cwd, '/Users/b/outro');
  assert.ok(JSON.parse(await readFile(join(env.P0K3R_HOME, 'bindings.json'), 'utf8'))['229']);
});

test('id da mesa sai da resposta do open_hand', () => {
  const briefing = JSON.stringify({ handId: 1, table: { id: 229, name: 'Mesa' } });
  assert.equal(tableIdFromResponse([{ type: 'text', text: briefing }]), 229);
  assert.equal(tableIdFromResponse({ content: [{ type: 'text', text: briefing }] }), 229);
  assert.equal(tableIdFromResponse([{ type: 'text', text: 'Mão 9 não encontrada' }]), null);
});
