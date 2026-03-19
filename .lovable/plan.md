

# Implementação Completa do Fluxo de Substituição de Placa

## Visão Geral

O sistema já possui um wizard de substituição funcional (`SubstituicaoVeiculoPage`) com 6 etapas e uma edge function de efetivação. Porém, faltam 5 comportamentos críticos descritos pelo usuário. Este plano abrange todas as partes.

---

## PARTE 1 — Identificação no Cotador

**Problema**: O cotador (`Cotacao.tsx` e `CotacaoFormDialog.tsx`) não verifica se o CPF já tem veículo ativo na Praticcar.

**Arquivos modificados**:
- `src/components/cotacao/EtapaDadosAssociado.tsx` — Adicionar campo CPF opcional. Ao preencher, consultar `associados` + `veiculos` (ativo=true). Se encontrar, exibir dialog perguntando "Substituição ou inclusão de segundo veículo?"
- `src/pages/vendas/Cotacao.tsx` — Adicionar estado `tipoOperacao` ('nova_adesao' | 'substituicao'). Se substituição, redirecionar para `/cadastro/substituicao-veiculo/{associadoId}` após confirmação
- `src/components/cotacoes/CotacaoFormDialog.tsx` — Adicionar mesma verificação de CPF com veículo ativo no formulário de cotação formal. Exibir dialog de escolha antes de prosseguir

**Novo componente**:
- `src/components/cotacao/DialogTipoOperacao.tsx` — Dialog reutilizável com as opções "Substituir veículo atual" e "Incluir segundo veículo (nova adesão)"

**Novo hook**:
- `src/hooks/useVerificarVeiculoAtivoCpf.ts` — Query que recebe CPF e retorna associado com veículo ativo (id, nome, placa, modelo) ou null

---

## PARTE 2 — Verificações de Elegibilidade Expandidas

**Problema**: O `StepElegibilidade` atual só verifica adimplência binária, rastreador e eventos. Faltam: cálculo de repasse maior, autorização FIPE alto valor, restrições absolutas (blindado, depreciação, mudança de linha).

**Arquivos modificados**:
- `src/hooks/useSubstituicaoVeiculo.ts` — Expandir `useVerificarElegibilidade` para:
  1. Calcular valor mínimo de adimplência usando regra do repasse maior (parâmetros de `comissoes_parametros`)
  2. Retornar `valor_minimo_quitar` quando houver boleto em aberto
  3. Retornar dados de FIPE do veículo atual para comparação posterior

- `src/components/substituicao/StepElegibilidade.tsx` — Redesenhar para exibir verificações expandidas:
  1. Card de adimplência com valor mínimo a pagar (regra repasse maior)
  2. Não bloquear completamente — exibir valor e orientação

- `src/components/substituicao/StepNovoVeiculo.tsx` — Adicionar verificações pós-consulta FIPE:
  1. **FIPE alto valor**: Se acima do limite, criar solicitação em `aprovacoes_fipe_limite` (reutilizar `useCriarSolicitacaoFipeLimite` existente) e bloquear avanço até aprovação
  2. **Blindado**: Bloquear sem exceção (`limites.blindadoPolicy` ignorado — sempre bloqueia em substituição)
  3. **Depreciação + 100% FIPE**: Verificar categoria do veículo e cobertura do plano atual — bloquear se incompatível
  4. **Mudança de linha de produto**: Comparar linha do plano atual com linhas elegíveis do novo veículo — bloquear se diferente

- `src/hooks/useSubstituicaoVeiculo.ts` — Novo hook `useVerificacoesSubstituicao` que registra resultados das verificações na tabela `substituicoes_veiculo` (campo `metadata` ou nova coluna `verificacoes_resultado`)

**Migração SQL**:
```sql
ALTER TABLE substituicoes_veiculo
ADD COLUMN IF NOT EXISTS verificacoes_resultado jsonb DEFAULT '{}';
```

---

## PARTE 3 — Rastreador do Veículo Antigo

**Problema**: O step atual verifica `pendencia_rastreador` no associado, mas não cria automaticamente a ordem de retirada nem bloqueia o avanço até confirmação.

**Arquivos modificados**:
- `src/components/substituicao/StepElegibilidade.tsx` ou novo step intermediário — Após elegibilidade OK:
  1. Verificar se veículo antigo tem rastreador instalado (consultar `rastreadores` ou `servicos` com tipo retirada pendente)
  2. Se tem rastreador: criar automaticamente serviço de retirada (`servicos` table, tipo='retirada') vinculado ao veículo
  3. Atualizar `substituicoes_veiculo.servico_retirada_id`
  4. Bloquear avanço para Step 3 até `servico.status = 'concluido'`
  5. Se não tem rastreador: pular automaticamente

- `src/pages/cadastro/SubstituicaoVeiculoPage.tsx` — Adicionar lógica de verificação de rastreador entre steps 1→3. Possível novo step ou sub-step dentro do step 1

**Novo componente**:
- `src/components/substituicao/StepRastreador.tsx` — Card mostrando status da retirada do rastreador, com link para módulo de monitoramento e polling de status

**Stepper update**:
- `src/components/substituicao/SubstituicaoStepper.tsx` — Adicionar step "Rastreador" entre "Elegibilidade" e "Novo Veículo" (total: 7 steps)

---

## PARTE 4 — Adesão do Novo Veículo

**Problema**: O fluxo financeiro usa taxa de substituição mas não segue as mesmas regras de nova adesão (vistoria, instalação, prazos).

**Arquivos modificados**:
- `src/components/substituicao/StepFinanceiro.tsx` — Ajustar:
  1. Taxa usa `taxa_substituicao_percentual` e `taxa_substituicao_minimo` das configurações (não taxa de nova adesão)
  2. Registrar tipo_operacao='substituicao_placa' em toda cobrança e histórico
  3. Ao efetivar: encerrar cobertura do antigo no mesmo instante que ativa o novo (já implementado no edge function)

- `supabase/functions/efetivar-substituicao/index.ts` — Já implementa a lógica de ativação simultânea. Verificar que:
  1. O tipo de operação fica como 'substituicao_placa' (já está)
  2. A vistoria e instalação seguem o fluxo normal (vincular ao pipeline existente)

**Sem grandes mudanças** aqui — o edge function já faz a troca atômica. O ajuste principal é garantir que a taxa vem das configurações de substituição e que o tipo é correto em todas as inserções.

---

## PARTE 5 — Pontuação do Consultor

**Problema**: Já implementado no edge function `efetivar-substituicao` (step 12), que verifica pagamento integral vs parcial e usa `pontos_substituicao_placa` / `pontos_substituicao_placa_parcial` de `comissoes_parametros`.

**Verificação**: A lógica existente já:
- Verifica se pagamento foi integral ou parcial
- Aplica regra de repasse maior com parâmetros do banco
- Usa `getParametroPontuacao` para buscar pontos configuráveis
- Registra via `registrarEventoPontuacao`

**Ajuste necessário**: Na regra atual, pagamento parcial que passa no repasse maior TAMBÉM gera pontuação (`pontos_substituicao_placa_parcial`). O requisito diz que parcial NÃO gera pontuação. Corrigir:
- `supabase/functions/efetivar-substituicao/index.ts` — Se `pagamentoIntegral === false`, definir `pontosConsultor = 0` e não registrar evento de pontuação

---

## Resumo de Arquivos

| Arquivo | Partes | Ação |
|---------|--------|------|
| `src/hooks/useVerificarVeiculoAtivoCpf.ts` | 1 | Novo — query CPF → veículo ativo |
| `src/components/cotacao/DialogTipoOperacao.tsx` | 1 | Novo — dialog substituição vs inclusão |
| `src/components/cotacao/EtapaDadosAssociado.tsx` | 1 | Adicionar campo CPF e verificação |
| `src/pages/vendas/Cotacao.tsx` | 1 | Estado tipoOperacao, redirect |
| `src/components/cotacoes/CotacaoFormDialog.tsx` | 1 | Verificação CPF com veículo ativo |
| `src/hooks/useSubstituicaoVeiculo.ts` | 2 | Expandir elegibilidade, registrar verificações |
| `src/components/substituicao/StepElegibilidade.tsx` | 2 | UI expandida com repasse maior |
| `src/components/substituicao/StepNovoVeiculo.tsx` | 2 | Verificações FIPE, blindado, linha |
| `src/components/substituicao/StepRastreador.tsx` | 3 | Novo — gerenciar retirada do rastreador |
| `src/components/substituicao/SubstituicaoStepper.tsx` | 3 | Novo step "Rastreador" |
| `src/pages/cadastro/SubstituicaoVeiculoPage.tsx` | 3 | Integrar step rastreador |
| `src/components/substituicao/StepFinanceiro.tsx` | 4 | Ajustar tipo operação e taxa |
| `supabase/functions/efetivar-substituicao/index.ts` | 5 | Zerar pontos para pagamento parcial |
| Migration SQL | 2 | Coluna `verificacoes_resultado` |

