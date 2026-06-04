## O que aconteceu no caso do THIAGO (+55 21 96890-7520)

Trilha real das mensagens:

```
10:00  → template confirmacao_manha_v1 (Pratic) — "Responda SIM para confirmar ou REAGENDAR"
11:02  ← "Reagendamento" (cliente)
11:02  ← "Reagendamento" (cliente, 9s depois)
11:02  → IA respondeu: "informe o seu CPF" 😵 (gate de identificação)
11:15  → operador disparou manualmente template `reagendamento_servico` com link
```

Diagnóstico:

1. Existia `confirmacoes_agendamento` pendente (status `enviada`, servico `ab10299d…`) para o telefone `21968907520`. O handler de confirmação no `whatsapp-webhook` (Evolution) DEVERIA ter capturado a palavra "Reagendamento" e disparado o fluxo de reagendamento — não disparou (provavelmente normalização de telefone OU a mensagem caiu numa branch anterior que decidiu rotear pra IA).
2. Mesmo se o handler tivesse falhado, a IA recebeu a mensagem **sem nenhum contexto** de que havia uma confirmação pendente para aquele número. Sem esse contexto, ela aplicou o gate canônico de saudação+identificação (CPF/nome) e ignorou completamente a intenção "reagendar".
3. A habilidade `relacionamento` ativa só tem 2 ferramentas (`consultar_boletos_associado`, `solicitar_atendente_humano`) — ela não tem como enviar link de reagendamento mesmo que entendesse a intenção.

## Como corrigir (em ordem de prioridade)

### 1. Injetar CONTEXTO DE AGENDAMENTO PENDENTE no agente-consultor-ia

Espelhar o padrão já existente de `cobrancaContextoTxt` (linhas 881-907 de `agente-consultor-ia/index.ts`). Antes de montar o system prompt:

- Consultar `confirmacoes_agendamento` das últimas 48h pelo telefone, status `in ('enviada','reagendando','aguardando_confirmacao_vespera','aguardando_confirmacao_manha','aguardando_confirmacao_encaixe')`.
- Para cada uma, carregar o `servico` vinculado (data, período, endereço, tipo, `reagendamento_token`) e o nome do associado.
- Injetar bloco no system prompt:

  ```
  ## CONTEXTO DE AGENDAMENTO PENDENTE
  Foi enviado a este contato em <dataEnvio> um pedido de confirmação para:
  - Serviço: <tipo> (id <servico_id>)
  - Quando: <data> <período>
  - Endereço: <logradouro>, <bairro>, <cidade>
  - Cliente: <nome>
  Use isto como verdade. Se o cliente pedir para reagendar / não puder / outro dia, chame a tool enviar_link_reagendamento.
  Se confirmar (SIM), chame confirmar_agendamento. Não invente datas nem endereços.
  ```

### 2. Bypass do gate de CPF quando houver agendamento pendente

No bloco de identificação canônica (gate saudação+CPF), pular o pedido de CPF quando `contextoAgendamentoPendente` existir — o telefone já está identificado pelo `servico/associado_id` vinculado. Atualizar `agente_ia_contatos` com nome do associado do servico.

### 3. Adicionar ferramentas na habilidade `relacionamento`

Acrescentar duas tools (e habilitá-las em `ia_habilidades.ferramentas_habilitadas` via migration):

- `enviar_link_reagendamento(servico_id: string)` → invoca a edge existente `enviar-link-reagendamento`. Resposta da IA fica: "Tudo bem, *Thiago*! Te enviei o link para escolher uma nova data. 📅" — o link em si vai via template Meta `reagendamento_servico` que essa edge já dispara.
- `confirmar_agendamento(servico_id: string)` → marca `confirmacoes_agendamento.status='confirmada'` + `servicos.confirmacao_whatsapp='confirmada'` + push pro profissional (mesma lógica que o Meta webhook já tem em `processarRespostaConfirmacaoMeta`).

Regras absolutas da habilidade ganham linha:
> Quando houver CONTEXTO DE AGENDAMENTO PENDENTE e o cliente disser qualquer variante de "reagendar/outro dia/não posso", chame `enviar_link_reagendamento` antes de qualquer outra resposta. Nunca prometa que "alguém entrará em contato" — envie o link direto.

### 4. Defesa em profundidade no webhook (Evolution)

Em `whatsapp-webhook/index.ts` linhas 3631-3644, adicionar log claro quando há confirmação pendente mas `tipoPrincipal !== 'texto'` OU quando `telefonesBusca` não casa, e quando o handler local de reagendar for invocado e detectar intent `REAGENDAR`, substituir o "em breve entrará em contato" (linha 2528) por invocação direta de `enviar-link-reagendamento` (mesma edge), para não depender mais da IA pra esse caso.

## Arquivos afetados

- `supabase/functions/agente-consultor-ia/index.ts` — injetar contexto, bypass de CPF, registrar 2 tools novas e seu handler.
- `supabase/functions/whatsapp-webhook/index.ts` — log + chamada direta da edge `enviar-link-reagendamento` no branch REAGENDAR (linha ~2525-2606).
- `supabase/migrations/<nova>.sql` — `UPDATE ia_habilidades SET ferramentas_habilitadas = ferramentas_habilitadas || array['enviar_link_reagendamento','confirmar_agendamento']::text[], regras_absolutas = regras_absolutas || E'\nQuando houver agendamento pendente…' WHERE slug='relacionamento'`.

## Resultado esperado no mesmo caso

```
10:00 → template confirmacao_manha_v1
11:02 ← "Reagendamento"
11:02 → IA (contexto pendente injetado) chama enviar_link_reagendamento
11:02 → template reagendamento_servico com link app.praticcar.org/reagendar/<token>
       + "Tudo bem, Thiago! Te enviei o link pra escolher nova data."
```

Sem CPF gate, sem operador manual, sem 1h13min de gap.
