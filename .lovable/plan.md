## Objetivo

Após `fn_cancelar_associado_se_orfao` cancelar o titular antigo localmente, espelhar essa inativação na Hinova. Falha remota não aborta a troca — só vai pra fila de retry com prefixo identificável.

## Escopo

Apenas `supabase/functions/efetivar-troca-titularidade/index.ts`, no bloco "8.1 Cancelar antigo proprietário se ficou sem vínculos ativos" (linhas ~910-948), logo após o read-back confirmar `statusReal === 'cancelado'`.

Nada mais é tocado:
- `fn_cancelar_associado_se_orfao` continua igual
- Lógica de decisão de órfão continua igual
- Outras integrações (Softruck, Rede, etc.) intocadas
- Etapa SGA do novo titular (linhas 1415+) intocada

## Mudança no `efetivar-troca-titularidade/index.ts`

Dentro do `else` (cancErr ausente), depois do bloco que valida `statusReal === 'cancelado'`:

1. Só entra no novo bloco quando `cancelado === true && statusReal === 'cancelado'` (ou seja, o local realmente cancelou).
2. Busca `codigo_hinova` do antigo associado (`associados` por `solicitacao.associado_id`).
3. Se não houver `codigo_hinova`: loga warn `[INATIVAR_ANTIGO_SEM_CODIGO_HINOVA]`, sai (nada a fazer remoto — associado nunca foi sincronizado).
4. Resolve `codigoSituacaoInativo`: `Number.parseInt(Deno.env.get('HINOVA_CODIGO_SITUACAO_INATIVO') || '', 10)`; se inválido, fallback `2` (padrão Hinova: 1=ativo, 2=inativo, 3=pendente). Mesmo padrão de `codigoSituacaoPendente` em `sga-hinova-sync`.
5. Try/catch ao redor de `alterarSituacaoAssociadoHinova(supabase, codigoHinova, codigoSituacaoInativo)`:
   - Sucesso (`rs.ok`): `console.log('[efetivar-troca][inativar-antigo] ✅ ...')` e `insertAuditLog` com `acao:'criar'`, `descricao: '[INATIVAR_ANTIGO_OK] ...'`.
   - `!rs.ok` ou throw: tratar como falha (item 6).
6. Falha (não bloqueante):
   - `console.error('[FALHA_INATIVAR_ASSOCIADO_ANTIGO] ...', msg)`
   - `insertAuditLog` com `descricao: '[FALHA_INATIVAR_ASSOCIADO_ANTIGO] ...'` carregando `solicitacao_id`, `associado_antigo_id`, `codigo_hinova`, `status` HTTP e `errors`.
   - Enfileira em `sga_sync_queue` com:
     ```
     associado_id: solicitacao.associado_id,
     veiculo_id: null,
     status: 'pendente',
     etapa_parou: 'troca_titularidade:inativar_associado_antigo',
     erro_ultimo: msg,
     origem: 'troca_titularidade',
     codigo_associado_hinova: codigoHinova,
     ```
   - Não altera nem retorna do handler — fluxo segue para etapa SGA do novo titular e marcação de `efetivada`.

## Tratamento do cron de retry

`cron-sga-retry` hoje processa `origem='troca_titularidade'` com base no associado novo. Precisamos garantir que a nova etapa (`etapa_parou='troca_titularidade:inativar_associado_antigo'`) seja reconhecida — caso contrário, o item fica pendente sem ser drenado.

Decisão: o suporte real ao retry desta etapa específica fica **fora deste prompt** (a fila já recebe o item, garantindo rastreabilidade e ação manual). Vou apenas adicionar comentário `TODO[retry-inativar-antigo]` no enqueue, deixando explícito que o cron ainda não consome essa etapa. Se quiser que eu implemente o consumo nesta mesma rodada, me avise antes de aprovar.

## Validação interna

Testes Deno em `supabase/functions/efetivar-troca-titularidade/inativar_antigo_test.ts` com mock do client Supabase e mock do helper `alterarSituacaoAssociadoHinova` via import map override (ou injection helper local). Como o módulo hoje importa o helper diretamente, vou:

1. Refatorar o bloco novo para chamar via variável local `const inativar = (globalThis as any).__inativarAssociadoHinovaOverride ?? alterarSituacaoAssociadoHinova;` (hook de teste mínimo, único acoplamento permitido).
2. Escrever 3 cenários (Deno.test):
   - **C1 Órfão + sucesso Hinova**: ordem das chamadas registradas no mock = `cadastrar novo → alterar veículo → ... → inativar antigo`; `solicitacao.status === 'efetivada'`; nenhuma linha em `sga_sync_queue` com etapa `inativar_associado_antigo`.
   - **C2 Órfão + falha Hinova**: mock lança; `solicitacao.status === 'efetivada'`; log com prefixo `[FALHA_INATIVAR_ASSOCIADO_ANTIGO]` registrado; `sga_sync_queue` recebeu insert com `etapa_parou='troca_titularidade:inativar_associado_antigo'`.
   - **C3 Não-órfão**: `fn_cancelar_associado_se_orfao` retorna false; mock de `inativar` **não** é chamado; troca segue normal.

Como rodar: `supabase--test_edge_functions` com `name_pattern: 'inativar_antigo'`. Reporto resultado bruto (passou/lista de chamadas/estado final) por cenário.

Se algum cenário não puder rodar (ex.: mock do Supabase complexo demais para a edge testável), reporto qual e o motivo, sem inventar resultado.

## Memória

Após implementar, atualizar `mem://logic/operations/troca-titularidade-cancela-titular-orfao` adicionando: "Quando cancela localmente, também chama `alterarSituacaoAssociadoHinova` (inativo=2) não-bloqueante; falha → log `[FALHA_INATIVAR_ASSOCIADO_ANTIGO]` + `sga_sync_queue` etapa `inativar_associado_antigo` (consumo pelo cron pendente)."

## Decisão pendente antes de implementar

Confirmar fallback `codigoSituacaoInativo=2`. Se a sua regional usa outro código, me passa o número (ou setamos só via env `HINOVA_CODIGO_SITUACAO_INATIVO` sem fallback, abortando se ausente).