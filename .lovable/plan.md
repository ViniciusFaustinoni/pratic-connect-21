## Causas raiz dos 4 problemas

Levantamento direto no banco e no código da tela `AprovacaoInstalacaoDetalhe.tsx` para o caso `COT-…-563` (servico `622f57ee…`, vistoria `ee76355d…`):

| # | Sintoma | Causa raiz |
|---|---------|------------|
| 1 | "Fotos da Instalação (0)" mesmo com 32 fotos copiadas | A edge `finalizar-autovistoria-cotacao` cria a vistoria, mas **não preenche `servicos.vistoria_origem_id`**. A tela busca fotos por `servico.vistoria_origem_id` (ou `instalacao_origem_id`). Ambos = `NULL` → array vazio. |
| 2 | "Documentação do Associado" mostra só o Laudo | Os 4 documentos aprovados (CNH, CRLV, comprovante) ficam em **`contratos_documentos`** (vinculados por `cotacao_id`), enquanto a tela só lê `documentos` por `associado_id`. Conferido: `contratos_documentos` tem 4 linhas `aprovado`. |
| 3 | Status do associado "aguardando_instalacao" | `aprovar-proposta` aplica esse status sem distinguir o caso "vistoria sem rastreador". Não existe valor semântico no enum `status_associado` para "concluiu vistoria, aguarda aprovação do Monitoramento sem instalação". |
| 4 | Campo "Instalador" sempre visível | Label fixo no JSX (linhas 500-503 da página), independente do `servicos.tipo`. Para `vistoria_entrada` sem rastreador não há instalador. |

## O que vamos corrigir

### A. Edge `finalizar-autovistoria-cotacao`
- Ao criar o `servicos` (ou atualizar o existente para `concluida`), setar `vistoria_origem_id = vistoriaId`.
- Continua idempotente; quando a vistoria já existe, faz `update` no servico para garantir o vínculo.

### B. Migration de enum
- `ALTER TYPE status_associado ADD VALUE IF NOT EXISTS 'aguardando_aprovacao_monitoramento';`
- Esse valor representa: cadastro aprovado, autovistoria/presencial concluída, aguardando decisão do Monitoramento. Vale para qualquer veículo sem rastreador obrigatório.

### C. `aprovar-proposta` (`supabase/functions/aprovar-proposta/index.ts`)
- Já existe a flag `algumPrecisouRastreador`. Quando ela é `false` e existe vistoria materializada, definir `status_alvo = 'aguardando_aprovacao_monitoramento'` em vez de `aguardando_instalacao`.
- Atualizar `allowed_from` em `ativar-associado` (linha 567) para incluir esse novo valor.

### D. Tela `AprovacaoInstalacaoDetalhe.tsx`
1. **Documentos**: no hook `useServicoDetalheAprovacao`, em paralelo ao `documentos`, fazer `select` em `contratos_documentos` por `cotacao_id` (e por `contrato_id` como fallback) e mesclar no array `documentos`. Manter o mesmo shape (`tipo`, `arquivo_url`, `status`).
2. **Instalador**: trocar label/valor para condicional —
   - `servico.tipo === 'vistoria_entrada'` e sem `profissional`: ocultar o campo (renderizar bloco "Vistoria sem instalação de rastreador" com badge informativa).
   - Caso contrário, manter "Instalador".
3. **Status do associado**: mapear o novo valor para badge "Aguardando aprovação do Monitoramento" com cor neutra/primária.
4. **Header da seção "Fotos"**: trocar dinamicamente para "Fotos da Vistoria" quando `tipo='vistoria_entrada'` (label menor, mas evita confundir o operador).

### E. Backfill do caso atual (COT-…-563)
- `UPDATE servicos SET vistoria_origem_id = 'ee76355d-2b71-4bc4-bdac-a8b133d7dc8c' WHERE id = '622f57ee-669c-437d-8354-82000757ef9a';`
- `UPDATE associados SET status = 'aguardando_aprovacao_monitoramento' WHERE id = '2e8c514d-d835-4e4d-8db0-b375438a0985';`

### F. Atualizar memória
- Atualizar `mem://logic/operations/vistoria-sem-rastreador-flow` (ou criar `mem://logic/operations/autovistoria-materializa-vistoria`) registrando: vínculo `servicos.vistoria_origem_id`, leitura de `contratos_documentos` na fila de aprovação e o novo status `aguardando_aprovacao_monitoramento`.

## Fora de escopo
- Mudar set canônico de fotos da autovistoria (segue 2 fotos + 360°).
- Fluxo presencial (já materializa vistoria/instalação corretamente).
- Mexer em `documentos` × `contratos_documentos` em outros pontos do app (apenas mesclar leitura na tela de aprovação).