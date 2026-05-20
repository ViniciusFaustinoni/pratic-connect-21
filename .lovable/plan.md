# Bug Troca de Titularidade — KOU6D37

## Diagnóstico

### Bug #1 — "Termo pendente" mesmo após assinar
- A solicitação atual `637e3fea-7622…` (KOU6D37, criada 14:50) está com `termo_cancelamento_assinado_em = NULL`. Existe uma anterior cancelada (`e4cc9691…`, mesma placa) com termo assinado às 14:07 — provavelmente é a que o usuário "lembrou" de ter assinado, mas pertence a uma solicitação que já foi cancelada e refeita.
- Causa estrutural: `criar-solicitacao-troca-titularidade` (linha 263) já cria a solicitação com `status='cotacao_em_andamento'` independente do termo. A UI exibe a etiqueta "Termo pendente" apenas com base em `termo_cancelamento_assinado_em IS NULL`. Resultado: status interno e badge ficam dessincronizados, e o botão "Realizar Cotação" fica clicável antes do termo voltar assinado — contradiz a regra canônica `mem://logic/operations/troca-titularidade-promocao-cadastro-canonica` ("Termo assinado → `cotacao_em_andamento`").

### Bug #2 — "Não foi possível vincular a cotação à troca de titularidade"
- Toast genérico (sem `code`), originado do `catch` da chamada a `vincular-cotacao-troca` no `CotacaoFormDialog.tsx`.
- Verificações já feitas:
  - Nenhum POSTGRES ERROR no INSERT de `cotacoes` no intervalo do teste.
  - Nenhum log da edge `vincular-cotacao-troca` no período — a função NÃO foi invocada.
  - RLS de INSERT em `cotacoes` permite o admin (`is_gerencia=true`).
  - Nenhuma `cotacao` com a placa KOU6D37 foi gravada (rollback funcionou OU INSERT falhou silenciosamente antes de chegar lá).
- Hipótese mais provável: a chamada `fetch` para `vincular-cotacao-troca` está caindo em `TRANSPORTE` (CORS/abort/rede) — por isso não aparece nos edge logs e o toast cai no `else` genérico. Pode também ser falha do `createCotacao.mutateAsync` lançando exceção que está sendo tratada como "vincular" por engano. Sem o `error_code`/`error_status` do console no momento da repro, é impossível afirmar com 100%.

## Plano

### Passo 1 — Coletar evidência precisa do Bug #2 (5 min, sem código)
Pedir ao usuário para reproduzir com o console aberto e copiar a linha `[vincular-cotacao-troca] FALHA — iniciando rollback {...}` (já existe — ver `CotacaoFormDialog.tsx:1894`). O objeto traz `error_code`, `error_status`, `error_message`, `payload`. Sem isso o fix é chute. Em paralelo, observar a aba Network: existe um POST para `/functions/v1/vincular-cotacao-troca`? Status?

Decisão baseada no resultado:
- Se `code='TRANSPORTE'` → problema de rede/CORS no preflight da edge; trocar `fetch` direto por `supabase.functions.invoke` ou alinhar headers CORS.
- Se `status=409 JA_VINCULADA` → solicitação já tem cotação ligada (race).
- Se `status=403 COTACAO_NAO_PERTENCE` → `dados_extras.solicitacao_troca_id` não está sendo gravado (bug na escrita do `dados_extras`).
- Se erro 4xx/5xx genérico → analisar payload.

### Passo 2 — Corrigir Bug #1 (status segue o termo)
Tornar o estado consistente com a regra canônica:

1. Em `criar-solicitacao-troca-titularidade/index.ts` (linha 263): trocar o status inicial de `'cotacao_em_andamento'` por `'aguardando_termo_cancelamento'` (criar enum/value se não existir).
2. Em `autentique-webhook/index.ts` (linha 324): manter a promoção para `'cotacao_em_andamento'` no momento em que o termo é marcado como assinado (já faz, só precisa ser o ÚNICO caminho).
3. No `ModalDetalhesTroca` / fila "Outros Processos": badge "Termo pendente" passa a ler `status='aguardando_termo_cancelamento'` (mesmo critério do backend). Botão "Realizar Cotação" só fica habilitado quando `status='cotacao_em_andamento'` E `termo_cancelamento_assinado_em IS NOT NULL`.
4. Cron `cron-expirar-trocas-titularidade`: incluir `aguardando_termo_cancelamento` na lista de status expiráveis (mesma janela atual).
5. Atualizar memória `mem://logic/operations/troca-titularidade-promocao-cadastro-canonica` reforçando o invariante.

Saneamento histórico: para solicitações abertas com `cotacao_em_andamento` + `termo_cancelamento_assinado_em IS NULL` (provavelmente só a 637e3fea hoje), rebobinar status para `aguardando_termo_cancelamento` num script único — ou cancelar/refazer caso o termo já tenha expirado.

### Passo 3 — Corrigir Bug #2 conforme diagnóstico do Passo 1
Aplicar a correção decidida acima. Em paralelo, independente do diagnóstico, endurecer a mensagem de erro do `catch` em `CotacaoFormDialog.tsx:1934`:
- Incluir o `error_code` real no toast (não só categoria), facilitando suporte futuro.
- Quando `code='TRANSPORTE'`, oferecer botão "Tentar novamente vincular" antes de rollback automático — hoje a cotação é apagada e o usuário precisa preencher tudo de novo, o que é frustrante quando a falha foi puramente de rede.

### Passo 4 — Verificação
- Rodar fluxo E2E com a credencial admin@teste.com: criar solicitação → ver badge "Termo pendente" → simular assinatura via webhook → status promove a `cotacao_em_andamento` → botão "Realizar Cotação" habilita → criar cotação → vincular OK → solicitação fica `aguardando_cadastro`.
- Validar query: zero solicitações com `cotacao_em_andamento` + termo NULL após o saneamento.

## Pergunta antes de implementar
1. **Confirmar o `error_code` no console** (Passo 1) — é o que define exatamente o fix do Bug #2. Pode reproduzir e colar o objeto do log `[vincular-cotacao-troca] FALHA`?
2. Concorda com o invariante do Passo 2 (status só vira `cotacao_em_andamento` quando o termo voltar assinado)? Isso muda o comportamento atual da UI imediatamente após criar a solicitação.