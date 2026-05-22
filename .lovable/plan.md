## Diagnóstico — por que "Termo assinado" não foi reconhecido

### Evidências reais coletadas

**1. Estado da troca KOU6D37 (DB)**
`solicitacoes_troca_titularidade.id = af5d46d0-0c9a-4e16-9b3b-9e6346bc72d1`:
- `status = 'aguardando_termo_cancelamento'`
- `termo_cancelamento_assinado_em = NULL`
- `termo_cancelamento_autentique_id = '75cf74d5d3191db2d7ebd47af20b7f82eb4d1331935a72ce6'`
- `termo_cancelamento_enviado_em = 2026-05-22 15:47:10`
- `termo_whatsapp_status = 'falhou'`

Autentique confirma assinatura via biometria SERPRO às 12:47 (print), mas DB nunca foi atualizado.

**2. Webhook Autentique não chegou**
`function_edge_logs` filtrando `url like '%autentique-webhook%'` nas últimas 48h retorna **zero requisições**. Apenas `autentique-sync-contrato` (polling do front) aparece. Conclusão objetiva: **o webhook Autentique não está fazendo POST para `/autentique-webhook`** — nenhum evento (signature.viewed, accepted, updated) chegou.

**3. Por que contratos ficam "assinado" e trocas não**
- `supabase/functions/autentique-sync-contrato/index.ts` é polling acionado pelo front quando o associado volta do Autentique. Cobre **apenas `contratos`** (busca por `autentique_documento_id` em `contratos`, linhas 188-210, 285).
- Não existe equivalente para `solicitacoes_troca_titularidade`. Busca por `rg "sync.*troca|sincronizar.*termo|sync-termo"` em `supabase/functions` e `src` retorna vazio.
- Resultado: contratos "se salvam" pelo polling; trocas dependem 100% do webhook, que não está chegando.

**4. Branch da troca no webhook (existe e está correto)**
`supabase/functions/autentique-webhook/index.ts` linhas 305-327:
```
.from('solicitacoes_troca_titularidade')
.eq('termo_cancelamento_autentique_id', documentId)
```
Atualizaria `termo_cancelamento_assinado_em` + `status='cotacao_em_andamento'`. Lógica está OK — só não é executada porque o webhook não dispara.

**5. Formato do ID (não é o bug)**
Tanto `solicitacoes_troca_titularidade.termo_cancelamento_autentique_id` (49 chars hex) quanto `contratos.autentique_documento_id` (49 chars hex, todos os registros) têm o mesmo formato. É o ID que o Autentique retorna em `createDocument.id` (`supabase/functions/enviar-termo-cancelamento-troca/index.ts:284`). Não há mismatch de formato — descartado.

**6. Telefone falhou também**
`termo_whatsapp_status='falhou'` → o titular antigo não recebeu o link por WhatsApp. Operador teve que enviar manualmente. Não bloqueia assinatura, mas reforça que o canal "automático" não está fechado.

### Escopo da contaminação

Query em `solicitacoes_troca_titularidade where termo_cancelamento_autentique_id is not null`: **2 trocas, ambas com `termo_cancelamento_assinado_em = NULL`** (KOU6D37 e 65d581ba-..., criada em 20/05). Toda troca recente está nessa situação — o pipeline automatizado nunca fechou nenhuma desde que o módulo entrou no ar; o que o usuário lembra como "finalizamos diversas vezes" foi via efetivação manual/contornos, não pelo webhook.

`solicitacoes_substituicao` provavelmente tem o mesmo gap (mesma arquitetura, mesma ausência de polling) — vai entrar no plano de correção.

## Plano de correção

### 1. Edge function nova: `autentique-sync-troca-termo`
- Espelho do `autentique-sync-contrato`, mas para troca.
- Entrada: `solicitacaoId` (ou `documentId`).
- Carrega `solicitacoes_troca_titularidade` pelo `termo_cancelamento_autentique_id`.
- Faz a mesma GraphQL `query GetDocument($id: UUID!) { document(id) { signatures { signed { created_at } biometric_approved { created_at } viewed { created_at } rejected { created_at } } } }`.
- Reusa a regra de `isEffectivelySigned` (signed.created_at OU biometric_approved.created_at + viewed) já implementada em `autentique-sync-contrato:362-364`.
- Quando detecta assinatura, faz **a mesma atualização** que o webhook faria (linhas 320-478 do `autentique-webhook`):
  - `UPDATE solicitacoes_troca_titularidade SET termo_cancelamento_assinado_em, status='cotacao_em_andamento'`
  - Marca `veiculos.em_troca_titularidade=true`
  - Auto-vincula cotação por `dados_extras.veiculo_origem_id` quando faltar
  - Envia WhatsApp ao novo titular (template `liberacao_link_troca`)
- Idempotente (verifica `termo_cancelamento_assinado_em IS NULL` antes).

### 2. Polling no front (modal Detalhes da Troca)
- Em `src/components/troca-titularidade/ModalDetalhesTroca.tsx`: enquanto `!solicitacao.termo_cancelamento_assinado_em && status === 'aguardando_termo_cancelamento'`, abrir um `useQuery` com `refetchInterval` de 15 s que chama a nova edge.
- Botão "Verificar assinatura agora" como fallback manual (mesmo padrão de Cotação pública atual).
- Hook `useSolicitacoesTroca` revalida sozinho via React Query invalidate ao receber sinal.

### 3. Cron de segurança (opcional mas recomendado)
- Edge `cron-sync-trocas-pendentes` rodando 5/5 min: lista `solicitacoes_troca_titularidade WHERE termo_cancelamento_assinado_em IS NULL AND termo_cancelamento_enviado_em < now() - interval '2 min'` e chama a sync para cada uma.
- Garante que, mesmo sem operador olhando o modal, trocas se desbloqueiem sozinhas.

### 4. Saneamento dos contaminados
- Migration de saneamento: para os 2 registros atuais, rodar a sync uma única vez (script seed) consultando o Autentique. Se o documento estiver assinado, gravar `termo_cancelamento_assinado_em` retroativo + `status='cotacao_em_andamento'` + replicar marcações de `em_troca_titularidade` no veículo + auto-vinculação de cotação.
- Loga auditoria em `associados_historico` com `via='saneamento_2026-05-22'`.

### 5. Reaplicar mesmo padrão a Substituição
- Verificar `solicitacoes_substituicao` (não tem polling, só webhook). Replicar `autentique-sync-substituicao-termo` + polling no `ModalDetalhesSubstituicao.tsx`. Mesmo cron pode varrer as duas tabelas.

### 6. Investigar a raiz do webhook Autentique
- Documentar (sem corrigir agora) que o webhook não está chegando: validar no painel Autentique se `https://<project>.supabase.co/functions/v1/autentique-webhook` está configurado e o secret esperado bate. Sem acesso ao painel Autentique, isso fica como tarefa do usuário — o sync acima já garante o fluxo independente do webhook.

### 7. Memória canônica
- Atualizar `mem://logic/operations/troca-titularidade-promocao-cadastro-canonica` adicionando: "Detecção de assinatura tem 2 caminhos canônicos: (a) webhook Autentique em `autentique-webhook` e (b) polling `autentique-sync-troca-termo` (front + cron). Idem para substituição. Webhook sozinho NÃO é confiável — sempre manter o sync."

## Detalhes técnicos
- Arquivos a criar:
  - `supabase/functions/autentique-sync-troca-termo/index.ts`
  - `supabase/functions/autentique-sync-substituicao-termo/index.ts`
  - `supabase/functions/cron-sync-trocas-pendentes/index.ts`
  - Migration de saneamento dos 2 registros + agendamento do cron (`pg_cron`).
- Arquivos a editar:
  - `src/components/troca-titularidade/ModalDetalhesTroca.tsx` (polling + botão manual)
  - `src/components/substituicao/ModalDetalhesSubstituicao.tsx` (idem)
  - `src/hooks/useSolicitacoesTroca.ts` (invalidar ao receber update)
  - `mem://logic/operations/troca-titularidade-promocao-cadastro-canonica`
  - `mem://index.md` (one-liner atualizado)
- Arquivos preservados (lógica do webhook está correta):
  - `supabase/functions/autentique-webhook/index.ts` (mantido — quando o webhook voltar, complementa o sync sem conflito por causa do guard `IS NULL`)
  - `supabase/functions/enviar-termo-cancelamento-troca/index.ts`

## Fora de escopo
- Reconfigurar o webhook no painel Autentique (depende do usuário).
- Reescrever o módulo de envio do termo (`enviar-termo-cancelamento-troca`) — está OK.
- Alterar formato do `autentique_documento_id` — formato 49 chars é o padrão Autentique, não é bug.