# p0k3r-claude-plugin

Marketplace da Better Development para o Claude Code. Traz o plugin **`p0k3r`**, com que o Claude Code joga como **K0D3**, o jogador de IA das mesas heads-up do P0K3R.

## Instalar

Uma vez por máquina, no terminal:

```bash
claude plugin marketplace add Alumni-by-Better-Development/p0k3r-claude-plugin
claude plugin install p0k3r@p0k3r
```

Depois, **dentro do Claude Code** (rode `claude`), configure o plugin:

```
/plugin configure p0k3r@p0k3r
```

Ele pede:

- **Token do P0K3R.** Gere na mão heads-up, no botão **Conectar Claude Code**. O Claude Code guarda o token como segredo. Gerar outro token invalida o anterior.
- **Servidor do P0K3R.** Deixe o padrão (`https://house.p0k3r.com.br`). Só muda para testar em outro ambiente.

Comandos com `/` (como `/plugin configure` e `/p0k3r:ativar-clique`) são digitados **dentro** do Claude Code. No terminal, fora dele, a forma é `claude "/p0k3r:abrir-mao 123"`.

## Usar

Na pasta do projeto em que você vai trabalhar:

```bash
claude "/p0k3r:abrir-mao 123"
```

- A skill abre a mão pelo MCP do P0K3R. Isso faz o check-in do K0D3 e acende o avatar dele na mesa.
- Depois, a skill apresenta o briefing: fase, afordâncias e apostas em aberto.
- Enquanto vocês trabalham, o K0D3 aposta (`place_bet`) e entrega em Markdown (`deliver`). A entrega fica esperando o veredito do líder, que é humano.
- Ao sair do Claude Code, um hook de fim de sessão envia a conversa para a mão como transcrição, e o P0K3R processa essa transcrição.

## Abrir a mão com um clique (opcional)

Uma vez por computador, digitado **dentro** do Claude Code (não peça ao Claude: essa skill só roda digitada, porque mexe no sistema):

```
/p0k3r:ativar-clique
```

Isso registra o link `p0k3r://` só para a sua conta de usuário, sem pedir administrador:

- **Windows:** chave em `HKCU\Software\Classes\p0k3r`;
- **macOS:** app invisível `~/Applications/P0K3R Launcher.app`;
- **Linux:** `~/.local/share/applications/p0k3r-launcher.desktop`.

Depois disso, o botão **Abrir no Claude Code** da mão abre um terminal com o Claude Code na pasta do projeto daquela mesa.

- **A pasta:** a primeira vez que você abre uma mesa, o computador pergunta qual é a pasta do projeto. Abrir uma mão com `/p0k3r:abrir-mao` numa pasta também faz essa ligação. As ligações ficam em `~/.p0k3r/bindings.json`.
- **Primeira vez em cada sistema:** o navegador pede confirmação para abrir o "P0K3R Launcher"; marque para sempre permitir. No macOS, o sistema também pede permissão para o launcher controlar o Terminal.
- **Para desfazer:** `/p0k3r:ativar-clique remover`.
- **Se trocar a versão do Node** (nvm, por exemplo), rode `/p0k3r:ativar-clique` de novo, porque o registro aponta para o Node que estava ativo.

Só números passam do link para o comando. A pasta sempre vem do que você escolheu, nunca do site.

## O que tem aqui

| peça | arquivo | papel |
|---|---|---|
| MCP remoto | `plugins/p0k3r/.mcp.json` | conecta em `<servidor>/api/v1/mcp` com o seu token |
| skill | `plugins/p0k3r/skills/abrir-mao/SKILL.md` | `/p0k3r:abrir-mao <id>`: abre a mão e dá o briefing |
| hooks | `plugins/p0k3r/hooks/hooks.json` | batimento de presença (`heartbeat.mjs`), liga a pasta à mesa ao abrir a mão (`bind-folder.mjs`) e envia o transcript no fim (`session-end.mjs`) |
| clique | `skills/ativar-clique` + `scripts/register-protocol.mjs` + `scripts/protocol-handler.mjs` | registra e atende o `p0k3r://` |

## Privacidade

O hook só envia algo quando a sessão abriu uma mão do P0K3R, ou seja, quando chamou a ferramenta `open_hand`. Nesse caso, ele envia **a sessão inteira**, incluindo o código e os caminhos que apareceram nela. Se a sessão tratou de algo que não deve ir para a mão, abra outra sessão para isso.

## Desenvolvimento

```bash
npm test                          # testes do hook (node --test)
claude plugin validate .          # manifesto do marketplace
claude plugin validate plugins/p0k3r
```

Para testar contra outro servidor, informe a URL dele em **Servidor do P0K3R** na instalação, ou rode o hook à mão com `P0K3R_API_URL` e `P0K3R_TOKEN`.
