## Problema

A Maya IA não respondeu à mensagem "Preciso do meu boleto" do Marcos Dativo. A causa raiz é que o branch de associado em `agente-consultor-ia/index.ts` **só tem uma tool** (`solicitar_atendente_humano`) — não existe ferramenta para consultar boletos no SGA. Como o prompt do associado proíbe inventar dados e ainda manda escalar quando o pedido for operacional, o modelo silenciou (ou tentou prometer ação humana, o que também é proibido).

Já existe a edge `sga-listar-boletos-associado` que enumera boletos por CPF (com veículos do SGA + locais + histórico). Falta apenas plugá-la como tool da IA.

## O que vai mudar

### 1) Nova tool no agente — `consultar_boletos_associado`
- Adicionar em `supabase/functions/agente-consultor-ia/index.ts` (branch `isAssociado`).
- Parâmetros: nenhum obrigatório do modelo — internamente o handler usa `cpf` do contato (já capturado pelo CPF gate) ou `codigo_hinova` do associado vinculado.
- Handler invoca `sga-listar-boletos-associado` via `supabase.functions.invoke` com o CPF do contato.
- Retorna para o modelo um JSON enxuto: `{ encontrados: N, boletos: [{vencimento, valor, status, placa, linha_digitavel, link_pdf?}], erro_transitorio?: bool, motivo? }`.
- Limite: até 5 boletos mais relevantes (abertos primeiro, depois vencidos recentes).

### 2) Prompt do associado — instruir uso da nova tool
- Adicionar bloco "QUANDO CHAMAR `consultar_boletos_associado`":
  - Sempre que o associado pedir boleto, 2ª via, valor a pagar, linha digitável, código de barras, vencimento, "quanto devo", "minha fatura".
- Atualizar a regra de transbordo: **remover "segunda via" e "boleto errado"** da lista que força transbordo automático. Substituir por:
  - Chamar `consultar_boletos_associado` primeiro.
  - Se retornar `erro_transitorio=true`, **aí sim** chamar `solicitar_atendente_humano` (motivo `duvida_complexa`, resumo "SGA fora — cliente pediu boleto").
  - Se boleto retornar com status divergente do que o cliente alega ("paguei", "valor errado"), chamar `solicitar_atendente_humano`.
- Reforçar: nunca inventar valores/datas — só repassar o que a tool devolver.

### 3) Formatação da resposta ao cliente
Instruir o modelo a responder em formato WhatsApp (negrito `*texto*`), 1 boleto por bloco:
```
*Boleto Mar/26* — R$ 89,90
Vencimento: 10/03/2026 (em aberto)
Placa: KRH3I99
Linha digitável: 34191.79001 01043...
```
Sem markdown `**` nem `##`.

## Fora do escopo

- Não alterar a edge `sga-listar-boletos-associado`.
- Não mexer no fluxo de transbordo já existente.
- Não trocar a tool de envio de PDF / não anexar boleto na conversa (apenas texto + linha digitável; envio de PDF fica para iteração seguinte se o usuário pedir).
- Não tocar no branch de leads.

## Arquivos

- `supabase/functions/agente-consultor-ia/index.ts` (única alteração — nova tool + prompt + handler do tool call).

## Critérios de aceite

- "Preciso do meu boleto" → IA chama `consultar_boletos_associado` → responde com lista real do SGA em formato WhatsApp.
- SGA fora do ar → IA chama `solicitar_atendente_humano` com motivo correto (não fica calada).
- Sem boletos abertos → IA responde "Você está em dia, *Marcos*! Nenhum boleto em aberto no momento." sem inventar dados.
- Nenhuma promessa do tipo "vou pedir para te enviarem" sem chamar tool.
