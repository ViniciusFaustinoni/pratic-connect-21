# Substituição com débito SGA — Assumir responsabilidade + Análises do Relacionamento

## Problema

No `StepElegibilidade` (fluxo de Substituição), quando o associado tem débitos no SGA o card "Adimplência" fica vermelho e o botão **Próximo** é desabilitado (`canProceed = adimplente && ...`). Consultor trava no caso `RJN2A96 / PATRICK FARIAS / R$ 218,70`.

Regra correta (mesma lógica das outras Análises de Relacionamento): o consultor pode **assumir a responsabilidade** ciente do débito, prosseguir, e isso gera um registro em `analises_relacionamento` (tipo `substituicao`, status `pendente`). O Relacionamento confere na aba **/relacionamento/analises**, marca ciente / cobra / resolve — exatamente como já faz hoje para Troca e Cancelamento Voluntário.

**A substituição segue o fluxo canônico inteiro normalmente até o fim** — assinatura do termo de substituição, agendamento de instalação + retirada, vistoria, aprovação Cadastro, Monitoramento, ativação via `ativar-associado`. A análise de débito é uma trilha paralela do Relacionamento, **não bloqueia nenhuma etapa posterior**.

## Mudanças

### 1. UI — `src/components/substituicao/StepElegibilidade.tsx`
- Quando `adimplente=false`, em vez de só bloquear, mostrar abaixo do card vermelho de Adimplência:
  - Checkbox: **"Estou ciente do débito de R$ X,XX e assumo a responsabilidade por prosseguir. Esta substituição será enviada ao Relacionamento para análise."**
  - Textarea **Justificativa** (obrigatória, ≥10 chars) quando checkbox marcado.
- `canProceed = (adimplente || debitoAssumido) && rastreador_devolvido && (regras de evento atuais inalteradas)`.
- `onNext` propaga payload extra: `{ assumiuDebito: boolean; justificativa?: string; valorDebito?: number; debitosSnapshot?: any[] }`.

### 2. Página/Hook — `src/pages/cadastro/SubstituicaoVeiculoPage.tsx` + `useSubstituicaoVeiculo`
- Recebe o payload e, ao criar a `substituicoes_veiculo` (status `iniciada`), grava em `metadata`/`observacoes` o flag `debito_sga_assumido`.
- Imediatamente após criar a substituição, chama `supabase.rpc('fn_criar_analise_relacionamento', …)` com:
  - `p_tipo='substituicao'`, `p_status='pendente'`
  - `p_origem_tabela='substituicoes_veiculo'`, `p_origem_id=<id>`
  - `p_associado_id`, `p_veiculo_id` (antigo), `p_justificativa`
  - `p_metadata = { motivo:'debito_sga_assumido', valor_debito, assumido_por:<profile_id>, debitos_snapshot:[…] }`
- Idempotência garantida pelo `UNIQUE (origem_tabela, origem_id)` já existente.

### 3. Análises do Relacionamento (`/relacionamento/analises`)
- Garantir que o filtro/aba liste `tipo='substituicao'` (se hoje só mostra troca/cancelamento, adicionar aba ou incluir no "Todas").
- Renderizar `metadata.motivo='debito_sga_assumido'` com chip âmbar "Débito SGA assumido pelo consultor", mostrar valor e link "Ver financeiro" do associado. Ações já existentes (Assumir / Resolver / Justificar) inalteradas.

### 4. Fluxo canônico depois disso — INALTERADO
- Substituição segue: assinar termo → agendar retirada+instalação no link público → vistoria → Cadastro → Monitoramento → `ativar-associado`.
- **Nenhum guard novo, nenhum bloqueio adicional.** A análise pendente do Relacionamento é informativa/operacional e **não trava** Cadastro, Monitoramento nem ativação.

## Fora de escopo
- Nada de mudança em elegibilidade de planos, SGA, regras de débito do Cadastro (que continuam aplicáveis em outros fluxos), ou nos demais bloqueios do `StepElegibilidade` (`rastreador_devolvido`, `evento_proprio`).
- Sem migração: enum `tipo='substituicao'` já existe e `fn_criar_analise_relacionamento` já está pronta.

## Critério de aceite
1. Substituição `RJN2A96` (R$ 218,70 em aberto): consultor marca ciente + justifica + clica **Próximo** e segue todas as etapas até o fim sem novos bloqueios.
2. Surge 1 linha em `analises_relacionamento` (`tipo='substituicao'`, `status='pendente'`) visível em **/relacionamento/analises** com chip "Débito SGA assumido".
3. Marcar Resolvido / Ciente no Relacionamento usa o mesmo fluxo de hoje, sem regressão nas trilhas Troca/Cancelamento.
4. Fluxo canônico da substituição (termo → agendamento → vistoria → Cadastro → Monitoramento → ativação) roda até o fim mesmo com a análise ainda pendente.
