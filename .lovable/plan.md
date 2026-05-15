## Veredito atual

- O recurso de **excluir cotação já existe** no sistema (`delete-cotacao` + hooks/ações). Vou **reaproveitar esse fluxo**, não criar um mecanismo paralelo.
- As duas cotações com erro são:
  - `0f5e1db1-7b1d-4fe9-9ae1-30becdc18c90` → `COT-20260515-163104960-422`
  - `d54499fc-f325-4d3e-bf09-dffd88c35e40` → `COT-20260515-163244658-205`
- Ambas foram criadas com payload coerente para troca:
  - `tipo_entrada = troca_titularidade`
  - `dados_extras.solicitacao_troca_id = 06037fb8-84bb-4856-a723-2b2baea55c5d`
- O endpoint `vincular-cotacao-troca` **aceitou o mesmo payload quando reexecutei manualmente** e vinculou com sucesso a solicitação à cotação `d54499fc...`.
- Como não apareceram logs do edge function para as tentativas que falharam, o cenário mais provável é:
  1. a cotação foi criada no banco,
  2. a chamada do `invoke('vincular-cotacao-troca')` falhou **antes de chegar de fato ao edge** ou falhou de forma transitória no cliente,
  3. o rollback tentou apagar a cotação com `supabase.from('cotacoes').delete()` direto no frontend,
  4. essa limpeza não foi confiável sob RLS/permissões e deixou as duas cotações órfãs.

## O que vou implementar

### 1) Corrigir a limpeza de falha no fluxo de troca
- Trocar o rollback frágil do frontend (`from('cotacoes').delete()`) por exclusão via **edge function existente `delete-cotacao`**.
- Garantir que, se a vinculação falhar, a exclusão use o mesmo caminho seguro e auditável já usado pelo sistema.
- Melhorar a mensagem de erro para distinguir:
  - falha de vínculo,
  - falha de exclusão da órfã,
  - cotação já vinculada.

### 2) Expor ação para apagar cotações não vinculadas no fluxo de troca
- Adicionar ação visível no painel/lista de **Outros Processos / Troca de Titularidade** para excluir rascunhos órfãos da troca.
- Regras da ação:
  - disponível apenas quando a cotação estiver em `rascunho`
  - e quando a solicitação de troca ainda não tiver `cotacao_id` apontando para ela, ou quando for uma sobra órfã detectável
  - usando o fluxo seguro já existente de exclusão.

### 3) Melhorar observabilidade do erro
- Registrar melhor o erro do `supabase.functions.invoke('vincular-cotacao-troca')` no frontend:
  - `solicitacao_id`
  - `cotacao_id`
  - status/response da função quando houver
  - falha do rollback separadamente
- Isso evita novo caso “sem logs úteis”.

### 4) Limpar este caso específico
- Depois da correção, remover as duas cotações criadas com erro do associado usando o fluxo seguro.
- Preservar apenas o vínculo válido já restabelecido ou ajustar conforme o estado final correto da solicitação.

## Detalhes técnicos

- Arquivos prováveis:
  - `src/components/cotacoes/CotacaoFormDialog.tsx`
  - `src/components/cotacoes/OutrosProcessosPanel.tsx`
  - possivelmente `src/components/cotacoes/TrocaTimelineDrawer.tsx`
  - hook/ação já existente em `src/hooks/useCotacoes.ts`
- Não vou criar nova edge function de exclusão se a existente cobrir o caso.
- Não há evidência, até agora, de bug determinístico na regra de negócio do `vincular-cotacao-troca`; a evidência aponta mais para **falha de chamada/rollback no cliente** do que para rejeição do backend.

## Resultado esperado

- Se a vinculação falhar novamente, a cotação não fica mais em limbo.
- O admin consegue apagar rapidamente rascunhos órfãos de troca.
- Este caso específico fica saneado sem sobras duplicadas.