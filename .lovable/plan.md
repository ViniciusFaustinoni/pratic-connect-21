

## Plano: Vincular aviso FIPE alto valor exclusivamente à regra de dupla aprovação da diretoria

### Problema
Atualmente existem dois sistemas separados de aprovação FIPE:
1. **Aprovação do analista** (`aprovacoes_fipe_limite`) — sempre ativo, mostra aviso "aprovação final dependerá de autorização do analista"
2. **Aprovação da diretoria** (`aprovacoes_fipe_diretoria`) — controlado pelo toggle `dupla_aprovacao_fipe_diretoria_ativa`

O usuário quer que **apenas a diretoria** participe desse fluxo. Quando a regra está desativada, nenhum aviso de FIPE alto valor deve aparecer. Quando ativada, o aviso deve aparecer mas mencionando apenas que depende de aprovação interna (sem mencionar analista nem diretores).

Além disso, quando os diretores **recusam**, a área pública deve exibir aviso de recusa.

### Alterações

**1. `CotacaoFormDialog.tsx` — Condicionar aviso e solicitação ao toggle da diretoria**
- No bloco de exibição do alerta FIPE (linhas ~1740-1800): só renderizar o alerta se `configDuplaAprovacao?.ativa === true`
- No bloco de criação de solicitação ao salvar (linhas ~1263-1300): só criar `criarSolicitacaoFipeLimite` se `configDuplaAprovacao?.ativa === true`
- Alterar texto do aviso de "autorização do analista" para "aprovação interna" (neutro)

**2. `EtapaAssinaturaContrato.tsx` — Adicionar tratamento de recusa**
- Além de verificar `fipe_diretoria_aprovado === false` (pendente), verificar se existem votos de recusa suficientes na tabela `aprovacoes_fipe_diretoria` (ou verificar campo de recusa na cotação)
- Se recusado: exibir mensagem informando que a cotação não foi aprovada internamente, sem mencionar diretores
- Manter o bloqueio atual para "pendente" e a liberação quando aprovado

**3. `StepNovoVeiculo.tsx` (substituição)** — Condicionar aviso ao toggle
- Mesmo padrão: só exibir o alerta FIPE se a regra de dupla aprovação estiver ativa

### Escopo
- 3 arquivos editados (`CotacaoFormDialog.tsx`, `EtapaAssinaturaContrato.tsx`, `StepNovoVeiculo.tsx`)
- Sem migrations, sem Edge Functions

