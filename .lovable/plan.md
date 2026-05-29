## Problema

A IA Maya está chamando o lead de "cliente" em vez do nome real. Investigação:

- O telefone do caso (5521985791044, "Julia Gurgel") **não está cadastrado em `associados`** → a Maya cai no fluxo "número desconhecido / lead".
- Hoje, quando `isAssociado=false`, o `systemPrompt` de `agente-consultor-ia` não recebe nenhum nome — por isso o modelo recorre a "cliente".
- O nome existe em dois lugares confiáveis: `data.pushName` no payload Evolution e `whatsapp_mensagens.nome_contato` (preenchido pelo `chatwoot-webhook` a partir de `meta.sender.name`). Nenhum dos dois é propagado para o agente.

> Obs.: o texto "Olá Cliente, há uma atualização no seu atendimento Atualização PRATIC: Oii. Acompanhe pelo app." no print é um template HSM disparado pelo Chatwoot (não pela Maya) — ajuste do template é no painel do Chatwoot. O escopo desta tarefa é só o fallback de nome na IA, conforme você escolheu.

## Mudanças

### 1. `supabase/functions/agente-consultor-ia/index.ts`
- Aceitar `nome_contato` opcional no body.
- Resolver `nomeCliente` (apenas quando `!isDiretor && !isAssociado`) na ordem:
  1. `body.nome_contato` (pushName ou nome do Chatwoot)
  2. `leads.nome` do telefone (já é buscado em outro trecho — reaproveitar)
  3. `whatsapp_mensagens.nome_contato` mais recente com `direcao='entrada'` para esse telefone (fallback para o caminho Chatwoot → fila → webhook sintético, que não carrega pushName)
- Extrair primeiro nome (`nomeCliente.split(' ')[0]`) e, no `systemPrompt` de lead/desconhecido, instruir a Maya a tratar a pessoa por esse nome. Onde hoje cai em "cliente", passa a usar o primeiro nome quando disponível; mantém "cliente" como fallback final.
- Não alterar fluxo de associado nem de diretor.

### 2. `supabase/functions/whatsapp-webhook/index.ts`
- Nos 3 `fetch` para `/functions/v1/agente-consultor-ia` (linhas ~3424, ~3504, ~3652), adicionar `nome_contato: data?.pushName || nomeContato || null` no body.

## Fora de escopo
- Template HSM "Olá Cliente…" do Chatwoot (ajuste é no painel do Chatwoot, não no nosso código).
- Sincronizar o nome do contato no Chatwoot via API.
- Mexer no prompt de associados.
