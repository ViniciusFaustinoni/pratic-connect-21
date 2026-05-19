## Diagnóstico

Contrato `0a6b82f1` (MARCOS VINICIUS — Ford Fiesta KOU6D37, FIPE R$ 30.835, plano Select Basic R$ 166,70):

- FIPE acima do mínimo (R$ 30k) → Cadastro avalia **apenas documentos** (não há autovistoria; instalação será presencial).
- Banco confirma o fluxo canônico funcionando: `cadastro_aprovado=true` só é gravado quando o analista clica o botão; `aprovado_em` será preenchido pela edge `aprovar-proposta`; promoção a `status='ativo'` continua restrita ao `ativar-associado` pós‑Monitoramento.
- A edge `aprovar-proposta` e o hook `resolverEscopoAnaliseCadastro` já estão corretos: retornam `aprovarApenasDocumentos=true` / `aguardandoMonitoramentoVistoria=true`, e o botão final do Cadastro já diz "Aprovar documentação e liberar para Monitoramento".

**Raiz do problema relatado pelo usuário é só de UI / rotulagem:**

No componente `src/components/cadastro/proposta/PropostaApprovalStepper.tsx`:

- Os passos `STEP_FINAL_2` e `STEP_FINAL_3` ainda chamam‑se **"Aprovação Final"** com descrição **"Confirme a liberação da cobertura"** (linhas 68‑77).
- O título do resumo é **"Resumo da Análise"** (linha 315) — neutro, mas reforça a impressão de decisão final.

Isso confunde o analista de Cadastro e contradiz a regra canônica (`mem://logic/operations/cadastro-escopo-canonico`): Cadastro só avalia documentação + autovistoria enxuta acima FIPE. A aprovação **final** pertence ao Monitoramento.

Nenhuma mudança de fluxo, backend, banco ou edge function é necessária — o fluxo já está correto. Apenas o rótulo da etapa precisa refletir a regra.

## Correção (UI somente)

Arquivo único: `src/components/cadastro/proposta/PropostaApprovalStepper.tsx`

1. Renomear `STEP_FINAL_2` e `STEP_FINAL_3`:
  - `label`: **"Aprovação Final"** → **"Liberar para Monitoramento"**
  - `shortLabel`: **"Aprovar"** → **"Liberar"**
  - `description`: **"Confirme a liberação da cobertura"** → **"Aprovar documentação e encaminhar ao Monitoramento"**
  - Exceção: quando `isAutovistoria && planoTemRouboFurto && cadastroAvaliaFotos` (autovistoria enxuta acima FIPE, que de fato libera R&F), manter rótulo **"Liberar Cobertura R&F"** — usar um terceiro preset `STEP_LIBERAR_RF` selecionado dinamicamente.
2. Trocar título do bloco resumo (linha 315) de **"Resumo da Análise"** → **"Resumo do Cadastro"** para reforçar escopo.
3. Reforçar banner informativo (`aguardandoMonitoramentoVistoria`, linha 452): mover para ser exibido **sempre** que `aprovarApenasDocumentos` for true (não só quando `aguardandoMonitoramentoVistoria`), garantindo que toda proposta acima FIPE sem autovistoria mostre "Cadastro avalia apenas a documentação. A aprovação final é do Monitoramento."
  - Requer expor `aprovarApenasDocumentos` na prop (adicionar à interface) e passá‑la de `PropostaAnalise.tsx`.

## Detalhes técnicos

- Interface `PropostaApprovalStepperProps`: adicionar `aprovarApenasDocumentos?: boolean`.
- `PropostaAnalise.tsx` linha ~635: passar `aprovarApenasDocumentos={aprovarApenasDocumentos}` (já vem do `resolverEscopoAnaliseCadastro`).
- Lógica de escolha do step final:

```ts
const stepFinal = (isAutovistoria && planoTemRouboFurto && cadastroAvaliaFotos)
  ? STEP_LIBERAR_RF
  : STEP_LIBERAR_MONITORAMENTO;
```

- Botão (linhas 483‑489) já tem texto correto — manter como está.

## Fora de escopo

- Nenhuma mudança em `aprovar-proposta`, `ativar-associado`, triggers, escopo canônico, ou rotas.
- Nenhuma migração.
- Nenhum impacto em propostas sub‑FIPE, troca de titularidade ou substituição (o stepper já trata via flags existentes).