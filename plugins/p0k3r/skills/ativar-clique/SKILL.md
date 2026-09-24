---
description: Ativa o botão "Abrir no Claude Code" das mãos heads-up do P0K3R neste computador — registra o link p0k3r:// para abrir o terminal na pasta da mesa com um clique.
argument-hint: "[remover]"
disable-model-invocation: true
allowed-tools: Bash(node:*)
---

# Ativar o clique do P0K3R

Rode exatamente um destes comandos, sem alterar nada:

- se `$ARGUMENTS` estiver vazio: `node "${CLAUDE_PLUGIN_ROOT}/scripts/register-protocol.mjs"`
- se `$ARGUMENTS` for `remover`: `node "${CLAUDE_PLUGIN_ROOT}/scripts/register-protocol.mjs" --remove`

Depois explique em poucas linhas, em português:

- **Ativado:** a partir de agora, o botão **Abrir no Claude Code** da mão abre um terminal com o Claude Code na pasta ligada àquela mesa. Na primeira vez de cada mesa, o computador pergunta qual é a pasta do projeto. O navegador pode pedir confirmação para abrir o "P0K3R Launcher"; marque para sempre permitir. No macOS, na primeira vez, o sistema pode pedir permissão para o launcher controlar o Terminal.
- **Removido:** o botão volta a só mostrar o comando para copiar.
- **Se o comando falhar:** mostre a mensagem de erro e não tente outra forma de registrar.
