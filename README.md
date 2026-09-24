# p0k3r-claude-plugin

Marketplace privado da Better Development para o Claude Code. Traz o plugin **`p0k3r`**, com que o Claude Code joga como **K0D3**, o jogador de IA das mesas heads-up do P0K3R.

## Instalar

Uma vez por máquina. Sua conta do GitHub precisa de acesso à organização `Alumni-by-Better-Development`, porque o repositório é privado.

```bash
claude plugin marketplace add Alumni-by-Better-Development/p0k3r-claude-plugin
claude plugin install p0k3r@p0k3r
```

Na instalação, o Claude Code pede:

- **Token do P0K3R.** Gere na mão heads-up, no botão **Conectar Claude Code**. O Claude Code guarda o token como segredo. Gerar outro token invalida o anterior.
- **Servidor do P0K3R.** Deixe o padrão (`https://house.p0k3r.com.br`). Só muda para testar em outro ambiente.

## Usar

Na pasta do projeto em que você vai trabalhar:

```bash
claude "/p0k3r:abrir-mao 123"
```

- A skill abre a mão pelo MCP do P0K3R. Isso faz o check-in do K0D3 e acende o avatar dele na mesa.
- Depois, a skill apresenta o briefing: fase, afordâncias e apostas em aberto.
- Enquanto vocês trabalham, o K0D3 aposta (`place_bet`) e entrega em Markdown (`deliver`). A entrega fica esperando o veredito do líder, que é humano.
- Ao sair do Claude Code, um hook de fim de sessão envia a conversa para a mão como transcrição, e o P0K3R processa essa transcrição.

## O que tem aqui

| peça | arquivo | papel |
|---|---|---|
| MCP remoto | `plugins/p0k3r/.mcp.json` | conecta em `<servidor>/api/v1/mcp` com o seu token |
| skill | `plugins/p0k3r/skills/abrir-mao/SKILL.md` | `/p0k3r:abrir-mao <id>`: abre a mão e dá o briefing |
| hook | `plugins/p0k3r/hooks/hooks.json` + `scripts/session-end.mjs` | no `SessionEnd`, envia o transcript da sessão para a mão aberta |

## Privacidade

O hook só envia algo quando a sessão abriu uma mão do P0K3R, ou seja, quando chamou a ferramenta `open_hand`. Nesse caso, ele envia **a sessão inteira**, incluindo o código e os caminhos que apareceram nela. Se a sessão tratou de algo que não deve ir para a mão, abra outra sessão para isso.

## Desenvolvimento

```bash
npm test                          # testes do hook (node --test)
claude plugin validate .          # manifesto do marketplace
claude plugin validate plugins/p0k3r
```

Para testar contra outro servidor, informe a URL dele em **Servidor do P0K3R** na instalação, ou rode o hook à mão com `P0K3R_API_URL` e `P0K3R_TOKEN`.
