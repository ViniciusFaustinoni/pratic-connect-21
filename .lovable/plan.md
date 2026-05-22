## Objetivo

Na cotação tipo **Substituição de Placa**, permitir que o operador escolha **qualquer uma das 6 opções de dia de vencimento do sistema** (5, 10, 15, 20, 25, 30), em vez de herdar fixo o `dia_vencimento` do associado.

Hoje a Etapa Financeira (`StepFinanceiro`) só **exibe** "Dia X" como rótulo somente-leitura, e o contrato novo é criado pelo `efetivar-substituicao` reaproveitando o dia do contrato anterior / associado.

## Mudanças

### 1. Banco — nova coluna em `substituicoes_veiculo`
Migration adicionando:
- `dia_vencimento smallint NULL` com `CHECK (dia_vencimento IN (5,10,15,20,25,30))`

Sem backfill (substituições existentes seguem usando o fallback atual).

### 2. UI — `src/components/substituicao/StepFinanceiro.tsx`
- Trocar o bloco somente-leitura "Dia {proRata.diaVenc}" por um `Select` com as 6 opções fixas: 5, 10, 15, 20, 25, 30.
- Valor inicial: prop `diaVencimento` recebida (que continua vindo do associado).
- Ao mudar, chamar `useAtualizarSubstituicao` para persistir `dia_vencimento` na linha de `substituicoes_veiculo` e propagar via callback (`onDiaVencimentoChange`) para o pai recalcular pro-rata.
- Pro-rata (`useMemo`) passa a depender do estado local em vez da prop estática.

### 3. Container — `src/pages/cadastro/SubstituicaoVeiculoPage.tsx`
- Adicionar state `diaVencimentoSubstituicao` (default: `associado?.dia_vencimento || 10`).
- Passar `diaVencimento` + `onDiaVencimentoChange` para `<StepFinanceiro>`.

### 4. Edge — `supabase/functions/efetivar-substituicao/index.ts`
- Ler `substituicao.dia_vencimento` e usá-lo no `insert` do contrato novo com prioridade máxima:
  `substituicao.dia_vencimento ?? contratoAnterior?.dia_vencimento ?? associado?.dia_vencimento ?? 10`.

## Fora do escopo
- Outros fluxos (Nova Cotação, Troca de Titularidade, Migração) continuam com a regra atual (2 opções calculadas por data corrente).
- Não altera `dia_vencimento` do associado nem de contratos pré-existentes — só do novo contrato gerado pela substituição.
- Sem mudança no link público, no SGA ou em geração de boletos (já leem `contratos.dia_vencimento`).

## Riscos
- Boletos: o ASAAS/SGA usam `contratos.dia_vencimento` na criação do contrato novo — como gravamos a escolha lá, fica consistente.
- Pro-rata: o cálculo continua client-side e atualiza ao trocar o dia.