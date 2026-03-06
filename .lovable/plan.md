

# Item 5: Veículo Blindado — Autorização da Diretoria

## Situação Atual

Hoje, "blindado" é tratado como um **aditivo contratual** no sistema de termos (`useAvaliarAditivos.ts`). Quando detectado via observações do CRLV ou flag `blindado`, o sistema apenas anexa um termo aditivo ao contrato. Não há nenhum bloqueio ou fluxo de aprovação.

A detecção ocorre em 3 pontos:
- `useAvaliarAditivos.ts` (frontend — geração de termo)
- `template-utils.ts` (edge function — geração de documentos)
- `GerarTermo.tsx` (sempre passa `blindado: false` — bug)

## O que muda

Blindado deixa de ser aditivo e passa a exigir **autorização da diretoria** antes de prosseguir com o cadastro/substituição. O fluxo é análogo ao de FIPE alta, que já existe no `SubstituicaoDetalhePage.tsx` (alerta + checkbox de confirmação + botões aprovar/rejeitar).

## Plano de Implementação

### 1. Criar flag `requer_autorizacao_blindado` na tabela `configuracoes`
- Chave: `aceitar_blindado` com valor `autorizar` (permite futuro valor `bloquear` se o V11 for aplicado)
- Lido pelo hook `useConfigLimitesVeiculo` existente

### 2. Detectar blindado nos formulários de entrada de veículo
- **`StepNovoVeiculo.tsx`** (substituição): adicionar alerta similar ao de FIPE alta quando o veículo for identificado como blindado (via observações do CRLV ou campo manual)
- **Fluxo de proposta/contratação**: mesma lógica nos pontos de entrada de veículo

### 3. Fluxo de autorização
- Na substituição: reutilizar o mesmo padrão do `SubstituicaoDetalhePage.tsx` — adicionar alerta "Veículo blindado — requer autorização da diretoria" com checkbox de confirmação, impedindo aprovação sem check
- No cadastro novo: marcar a proposta/contrato como pendente de autorização quando blindado for detectado

### 4. Remover `veiculo_blindado` do sistema de aditivos
- Remover a regra `veiculo_blindado` do tipo `RegraAditivo` em `useAditivos.ts`
- Remover o case `veiculo_blindado` de `useAvaliarAditivos.ts`
- Remover de `AditivoForm.tsx` (tipos de regra)
- Remover de `Aditivos.tsx` (labels)
- Remover de `template-utils.ts` (edge function)
- Corrigir `GerarTermo.tsx` que hardcoda `blindado: false`

### 5. Adicionar campo de detecção no veículo
- Garantir que o campo `blindado` (boolean) exista na tabela de veículos ou que a detecção via observações do CRLV seja confiável
- Adicionar switch/toggle "Veículo blindado?" no formulário de novo veículo para que o vendedor possa marcar manualmente

## Arquivos Impactados

| Arquivo | Ação |
|---------|------|
| `useConfigLimitesVeiculo.ts` | Adicionar leitura de `aceitar_blindado` |
| `StepNovoVeiculo.tsx` | Alerta + bloqueio para blindado |
| `SubstituicaoDetalhePage.tsx` | Alerta + checkbox similar ao de FIPE alta |
| `useAvaliarAditivos.ts` | Remover case `veiculo_blindado` |
| `useAditivos.ts` | Remover tipo `veiculo_blindado` do union |
| `AditivoForm.tsx` | Remover opção blindado dos tipos de regra |
| `Aditivos.tsx` | Remover label blindado |
| `template-utils.ts` | Remover case blindado (edge function) |
| `GerarTermo.tsx` | Corrigir `blindado: false` hardcoded |
| Migration SQL | Inserir chave `aceitar_blindado` em `configuracoes` |

## Ordem de Execução

1. Inserir config no banco + atualizar hook de limites
2. Adicionar detecção e alerta nos formulários de veículo
3. Adicionar bloqueio de aprovação na tela da diretoria
4. Remover blindado do sistema de aditivos
5. Atualizar edge function

